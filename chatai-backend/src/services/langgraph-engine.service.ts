import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ALL_TOOLS } from "../tools/langchain-tools";
import { db } from "../db";
import { runEmitter } from "./sse.service";
import { WorkflowAgent, AgentOutput } from "../types";

// Setup LLM using Mistral AI or Hugging Face Router
// IMPORTANT: @langchain/openai reads OPENAI_API_KEY from process.env internally,
// so we must inject the correct key before creating the ChatOpenAI instance.
function getLLM(_modelName?: string) {
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.mistral_api_key;
  const hfKey = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;

  if (mistralKey) {
    console.log("Using Mistral AI as primary LLM (Mistral-Large)...");
    process.env.OPENAI_API_KEY = mistralKey;
    return new ChatOpenAI({
      modelName: 'mistral-large-latest',
      temperature: 0.7,
      openAIApiKey: mistralKey,
      configuration: {
        baseURL: 'https://api.mistral.ai/v1',
      },
    });
  }

  if (!hfKey) throw new Error('No LLM API keys found (MISTRAL_API_KEY or HF_API_KEY)');

  console.log("Using Hugging Face Router as primary LLM...");
  process.env.OPENAI_API_KEY = hfKey;
  return new ChatOpenAI({
    modelName: 'Qwen/WebWorld-8B:featherless-ai',
    temperature: 0.7,
    openAIApiKey: hfKey,
    configuration: {
      baseURL: 'https://router.huggingface.co/v1',
    },
  });
}

export async function executeWorkflowLangGraph(
  workflowId: string,
  tenantId: string,
  userInputs: any
): Promise<{ run_id: string }> {
  console.log(`🚀 Starting LangGraph workflow ${workflowId} for tenant ${tenantId}`);

  // 1. Load workflow and agents (with fallback for demo/system workflows)
  let { rows: workflows } = await db.query(
    "SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2",
    [workflowId, tenantId]
  );
  
  if (workflows.length === 0) {
    console.warn(`[LangGraph] Workflow ${workflowId} not found for tenant ${tenantId}. Trying global lookup...`);
    const { rows: globalWorkflows } = await db.query(
      "SELECT * FROM workflows WHERE id = $1",
      [workflowId]
    );
    workflows = globalWorkflows;
  }

  const workflow = workflows[0];
  if (!workflow) throw new Error("Workflow not found");

  const { rows: agents } = await db.query(
    "SELECT * FROM workflow_agents WHERE workflow_id = $1 ORDER BY position ASC",
    [workflowId]
  );
  if (agents.length === 0) throw new Error("No agents found in workflow");

  // 2. Create workflow run BEFORE background task
  const { rows: runs } = await db.query(
    `INSERT INTO workflow_runs 
     (workflow_id, tenant_id, input_data, status, started_at) 
     VALUES ($1, $2, $3, 'running', NOW()) 
     RETURNING id`,
    [workflowId, tenantId, JSON.stringify(userInputs)]
  );
  const runId = runs[0].id;

  // 3. Run execution in background
  setImmediate(async () => {
    runEmitter.emitEvent(runId, "workflow_start", {
      workflowId,
      name: workflow.name,
      total_agents: agents.length,
    });

    const previousOutputs: Record<string, AgentOutput> = {};
    const startTime = Date.now();
    let totalCredits = 0;

    try {
      // Execute each agent sequentially but using a full ReAct loop internally
      for (const agent of agents as WorkflowAgent[]) {
        const stepStartTime = Date.now();

        runEmitter.emitEvent(runId, "agent_start", {
          agentId: agent.id,
          agent_name: agent.name,
          agent_role: agent.role,
          step: agent.position,
          total: agents.length,
          message: `${agent.name} is reasoning with LangGraph...`,
        });

        const { rows: steps } = await db.query(
          `INSERT INTO workflow_steps 
           (run_id, agent_id, step_number, status, input_data, started_at)
           VALUES ($1, $2, $3, 'running', $4, NOW())
           RETURNING id`,
          [
            runId,
            agent.id,
            agent.position,
            JSON.stringify({ user_inputs: userInputs, previous_outputs: previousOutputs }),
          ]
        );
        const stepId = steps[0].id;

        // Initialize the ReAct agent
        const llm = getLLM(agent.config?.model || "");
        
        // Combine system prompt, task, and previous context
        const contextStr = JSON.stringify(previousOutputs);
        const inputStr = JSON.stringify(userInputs);
        
        const systemMessage = `You are a specialized AI agent named "${agent.name}" (Role: ${agent.role}).
        Your System Prompt: ${agent.system_prompt}
        
        Your specific task: ${agent.description || workflow.original_prompt}
        
        Context from previous steps: ${contextStr}
        User Inputs: ${inputStr}
        
        You have access to tools. Use them to accomplish your task. When you are done, provide a final comprehensive answer.`;

        const reactAgent = createReactAgent({
          llm,
          tools: ALL_TOOLS,
          messageModifier: systemMessage,
        });

        let finalResponse = "";
        let agentOutput: AgentOutput;
        const toolsUsed: string[] = [];

        try {
          const stream = await reactAgent.stream(
            { messages: [["user", "Execute your task and provide the final output."]] },
            { streamMode: "values" }
          );

          for await (const chunk of stream) {
            const lastMessage = chunk.messages[chunk.messages.length - 1];
            if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls?.length > 0) {
              const tc = (lastMessage as any).tool_calls[0];
              runEmitter.emitEvent(runId, "agent_progress", { message: `Calling tool: ${tc.name}` });
              if (!toolsUsed.includes(tc.name)) toolsUsed.push(tc.name);
            }
            if (lastMessage._getType() === "ai" && lastMessage.content) {
              finalResponse = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
            }
          }

          agentOutput = {
            success: true,
            data: { content: finalResponse },
            summary: `Completed successfully using LangGraph. Tools used: ${toolsUsed.length}`,
            output_type: "text",
            confidence: 0.9,
            metadata: {
              duration_ms: Date.now() - stepStartTime,
              tokens_used: 0,
              tools_used: toolsUsed,
              retries: 0,
            },
          };
        } catch (execErr: any) {
          console.error(`[LangGraph] Error in ${agent.name}:`, execErr);
          agentOutput = {
            success: false,
            data: null,
            summary: "Failed during reasoning loop",
            output_type: "error",
            confidence: 0,
            error: execErr.message,
            metadata: {
              duration_ms: Date.now() - stepStartTime,
              tokens_used: 0,
              tools_used: toolsUsed,
              retries: 0,
            },
          };
        }

        const duration = Date.now() - stepStartTime;

        await db.query(
          `UPDATE workflow_steps 
           SET status = $1, output_data = $2, duration_ms = $3, completed_at = NOW()
           WHERE id = $4`,
          [agentOutput.success ? "completed" : "failed", JSON.stringify(agentOutput), duration, stepId]
        );

        await db.query(
          `UPDATE workflow_agents SET last_output = $1, status = 'idle' WHERE id = $2`,
          [JSON.stringify(agentOutput), agent.id]
        );

        runEmitter.emitEvent(runId, "agent_done", {
          agentId: agent.id,
          agent_name: agent.name,
          step: agent.position,
          total: agents.length,
          duration_ms: duration,
          success: agentOutput.success,
          output_summary: agentOutput.summary,
          message: agentOutput.success
            ? `✓ ${agent.name}: ${agentOutput.summary}`
            : `⚠ ${agent.name}: ${agentOutput.error}`,
        });

        previousOutputs[agent.name] = agentOutput;
        previousOutputs[`agent_${agent.position}`] = agentOutput;
        previousOutputs[agent.role] = agentOutput;
        totalCredits += 1;

        if (!agentOutput.success) {
           // We might want to break early if an agent fails
           console.warn(`[LangGraph] ${agent.name} failed, but continuing workflow...`);
        }
      }

      const totalDuration = Date.now() - startTime;

      await db.query(
        `UPDATE workflow_runs 
         SET status = 'completed', output_data = $1,
             duration_ms = $2, credits_used = $3, completed_at = NOW()
         WHERE id = $4`,
        [JSON.stringify(previousOutputs), totalDuration, totalCredits, runId]
      );

      await db.query(`UPDATE workflows SET last_run_at = NOW(), run_count = run_count + 1 WHERE id = $1`, [workflowId]);
      await db.query(`UPDATE tenants SET credits_remaining = GREATEST(credits_remaining - $1, 0) WHERE id = $2`, [totalCredits, tenantId]);

      runEmitter.emitEvent(runId, "workflow_done", {
        runId,
        outputs: previousOutputs,
        duration_ms: totalDuration,
        credits_used: totalCredits,
        agents_run: agents.length,
        message: `✅ LangGraph Workflow complete in ${(totalDuration / 1000).toFixed(1)}s`,
      });

    } catch (err: any) {
      console.error("[LangGraph] Workflow failed:", err);
      await db.query(
        `UPDATE workflow_runs SET status = 'failed', error_message = $1, duration_ms = $2, completed_at = NOW() WHERE id = $3`,
        [err.message, Date.now() - startTime, runId]
      );
      runEmitter.emitEvent(runId, "workflow_error", { runId, error: err.message, message: `✗ Workflow failed: ${err.message}` });
    }
  });

  return { run_id: runId };
}
