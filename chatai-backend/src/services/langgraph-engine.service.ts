import { logger } from './logger.service';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ALL_TOOLS } from "../tools/langchain-tools";
import { getArtifactTools } from "../tools/artifact-tools";
import { db } from "../db";
import { runEmitter } from "./sse.service";
import { WorkflowAgent, AgentOutput } from "../types";
import { transitionWorkflowRun } from "./workflow-state";
import { outcomeEngineService } from './outcome-engine.service';
import { executiveSwarmService } from './executive-swarm.service';
import { agentGovernanceService } from './agent-governance.service';
import { costIntelligenceService } from './cost-intelligence.service';
import { optimizationEngineService } from './optimization-engine.service';
import { supervisorService } from './supervisor.service';

import { cleanEnvVar } from "../agents/base.agent";

// Setup LLM using Mistral AI or Hugging Face Router
// IMPORTANT: @langchain/openai reads OPENAI_API_KEY from process.env internally,
// so we must inject the correct key before creating the ChatOpenAI instance.
function getLLM(_modelName?: string) {
  const mistralKey = cleanEnvVar('MISTRAL_API_KEY') || cleanEnvVar('mistral_api_key');
  const hfKey = cleanEnvVar('HUGGINGFACE_API_KEY') || cleanEnvVar('HF_API_KEY');

  if (mistralKey) {
    logger.info("Using Mistral AI as primary LLM (Mistral-Large)...");
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

  logger.info("Using Hugging Face Router as primary LLM...");
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

function pruneContext(previousOutputs: Record<string, AgentOutput>): string {
  const serialized = JSON.stringify(previousOutputs);
  if (serialized.length <= 8000) {
    return serialized;
  }
  // If too large, prune by keeping only standard fields and truncating heavy data strings
  const pruned: Record<string, Partial<AgentOutput>> = {};
  for (const [key, value] of Object.entries(previousOutputs)) {
    pruned[key] = {
      success: value.success,
      summary: value.summary,
      output_type: value.output_type,
      confidence: value.confidence,
      error: value.error,
      data: value.data
        ? typeof value.data === "string"
          ? value.data.slice(0, 1000) + "... [truncated due to context limit]"
          : { content: (value.data as any).content?.slice?.(0, 1000) }
        : undefined,
    };
  }
  return JSON.stringify(pruned);
}

export async function executeWorkflowLangGraph(
  workflowId: string,
  tenantId: string,
  userInputs: any,
  resumeRunId?: string
): Promise<{ run_id: string }> {
  logger.info(`🚀 Starting LangGraph workflow ${workflowId} for tenant ${tenantId} (Resume: ${resumeRunId || 'no'})`);

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

  let runId: string;
  let finalInputs = userInputs;

  if (resumeRunId) {
    runId = resumeRunId;
    const { rows: runs } = await db.query('SELECT input_data FROM workflow_runs WHERE id = $1', [resumeRunId]);
    if (runs.length === 0) throw new Error(`Run ${resumeRunId} to resume not found`);
    if (runs[0].input_data) {
      finalInputs = typeof runs[0].input_data === 'string' ? JSON.parse(runs[0].input_data) : runs[0].input_data;
    }
  } else {
    // 2. Create workflow run BEFORE background task
    const { rows: runs } = await db.query(
      `INSERT INTO workflow_runs 
       (workflow_id, tenant_id, input_data, status, started_at) 
       VALUES ($1, $2, $3, 'running', NOW()) 
       RETURNING id`,
      [workflowId, tenantId, JSON.stringify(userInputs)]
    );
    runId = runs[0].id;
  }

  // 3. Run execution in background
  setImmediate(async () => {
    const previousOutputs: Record<string, AgentOutput> = {};
    const startTime = Date.now();
    let totalCredits = 0;

    try {
      // 1. Transition to PLANNING stage
      await transitionWorkflowRun(runId, 'PLANNING', { workflowId });
      
      // ── C-Suite Swarm Approval & Goal Decomposition ──
      const goalStr = workflow.original_prompt || 'Autonomous Outcome Task';
      const swarmApproval = await executiveSwarmService.coordinateExecutiveSwarm(goalStr, tenantId);
      
      const structuredGoal = await outcomeEngineService.decomposeGoal(goalStr, tenantId);
      const goalId = await outcomeEngineService.createGoalInDb(structuredGoal, tenantId);
      
      logger.info(`[LangGraph] Goal ${goalId} and milestones established for outcome execution.`);
      await new Promise(r => setTimeout(r, 800)); // Short delay for planning trace

      // 2. Transition to EXECUTING stage
      await transitionWorkflowRun(runId, 'EXECUTING', { workflowId });

      // Execute each agent sequentially but using a full ReAct loop internally
      for (const agent of agents as WorkflowAgent[]) {
        const stepStartTime = Date.now();

        // Check if step is already completed (checkpoint resume)
        const stepCheck = await db.query(
          "SELECT id, status, output_data FROM workflow_steps WHERE run_id = $1 AND agent_id = $2",
          [runId, agent.id]
        );
        if (stepCheck.rows.length > 0 && stepCheck.rows[0].status === 'completed') {
          logger.info(`[LangGraph] Resuming run ${runId}: Skipping completed step ${agent.position} (${agent.name})`);
          const stepOutput = stepCheck.rows[0].output_data as AgentOutput;
          previousOutputs[agent.name] = stepOutput;
          previousOutputs[`agent_${agent.position}`] = stepOutput;
          previousOutputs[agent.role] = stepOutput;
          totalCredits += 1;
          continue;
        }

        // Cancellation checkpoint
        const checkRun = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId]);
        const currentStatus = (checkRun.rows[0]?.status || 'executing').toLowerCase();
        if (currentStatus === 'cancelled') {
          logger.info(`[LangGraph] Run ${runId} was cancelled by user. Aborting step ${agent.position}.`);
          await db.query(
            "UPDATE workflow_steps SET status = 'cancelled', completed_at = NOW() WHERE run_id = $1 AND status = 'pending'",
            [runId]
          );
          return;
        }

        runEmitter.emitEvent(runId, "agent_start", {
          agentId: agent.id,
          agent_name: agent.name,
          agent_role: agent.role,
          step: agent.position,
          total: agents.length,
          message: `${agent.name} is reasoning with LangGraph...`,
        });

        const progressVal = Math.round((agent.position / (agents.length + 1)) * 90);
        runEmitter.emitEvent(runId, 'workflow_progress', { progress: progressVal }, workflowId);

        const { rows: steps } = await db.query(
          `INSERT INTO workflow_steps 
           (run_id, agent_id, step_number, status, input_data, started_at)
           VALUES ($1, $2, $3, 'running', $4, NOW())
           RETURNING id`,
          [
            runId,
            agent.id,
            agent.position,
            JSON.stringify({ user_inputs: finalInputs, previous_outputs: previousOutputs }),
          ]
        );
        const stepId = steps[0].id;

        // Initialize the ReAct agent
        const llm = getLLM(agent.config?.model || "");
        
        // Combine system prompt, task, and previous context (with pruning)
        const contextStr = pruneContext(previousOutputs);
        const inputStr = JSON.stringify(finalInputs);
        
        const systemMessage = `You are a specialized AI agent named "${agent.name}" (Role: ${agent.role}).
        Your System Prompt: ${agent.system_prompt}
        
        Your specific task: ${agent.description || workflow.original_prompt}
        
        Context from previous steps: ${contextStr}
        User Inputs: ${inputStr}
        
        You have access to tools. Use them to accomplish your task. When you are done, provide a final comprehensive answer.`;

        const artifactTools = getArtifactTools(tenantId, workflowId, runId);
        const dynamicTools = [...ALL_TOOLS, ...artifactTools];

        const reactAgent = createReactAgent({
          llm,
          tools: dynamicTools,
          messageModifier: systemMessage,
        });

        let finalResponse = "";
        let agentOutput: AgentOutput;
        const toolsUsed: string[] = [];

        try {
          // Transition to TOOL_RUNNING for the duration of reactAgent invocation
          await transitionWorkflowRun(runId, 'TOOL_RUNNING', { workflowId });

          // 180 seconds Step Timeout Guard
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: Agent ${agent.name} exceeded maximum limit of 180s`)), 180000)
          );

          const streamPromise = (async () => {
            const stream = await reactAgent.stream(
              { messages: [["user", "Execute your task and provide the final output."]] },
              { streamMode: "values", recursionLimit: 10 } // Enforce max recursion depth cap of 10 loops
            );

            for await (const chunk of stream) {
              // Check cancellation inside streaming loop
              const innerCheck = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId]);
              if ((innerCheck.rows[0]?.status || '').toLowerCase() === 'cancelled') {
                throw new Error('Workflow cancelled by user');
              }

              const chunkObj = chunk as any;
              const lastMessage = chunkObj.messages?.[chunkObj.messages.length - 1];
              if (lastMessage) {
                if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls?.length > 0) {
                  const tc = (lastMessage as any).tool_calls[0];
                  runEmitter.emitEvent(runId, "agent_progress", { message: `Calling tool: ${tc.name}` });
                  if (!toolsUsed.includes(tc.name)) toolsUsed.push(tc.name);
                }
                if (lastMessage._getType() === "ai" && lastMessage.content) {
                  finalResponse = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
                }
              }
            }
          })();

          await Promise.race([
            streamPromise,
            timeoutPromise
          ]);

          // Transition back to EXECUTING
          await transitionWorkflowRun(runId, 'EXECUTING', { workflowId });

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
          
          if (execErr.message === 'Workflow cancelled by user') {
            throw execErr;
          }

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

        // ── Cost Intelligence Cost Logging (Phase 1.3) ──
        const promptTokens = (agentOutput?.metadata as any)?.prompt_tokens || 850
        const completionTokens = (agentOutput?.metadata as any)?.completion_tokens || 350
        const stepCost = await costIntelligenceService.logStepCost(
          runId,
          agent.id,
          agent.config?.model || 'Qwen/WebWorld-8B:featherless-ai',
          promptTokens,
          completionTokens,
          duration
        )

        // Log Governance Audit Trail & Heartbeat
        await agentGovernanceService.logAuditRecord(
          tenantId,
          agent.id,
          agentOutput.success ? 'AGENT_STEP_SUCCESS' : 'AGENT_STEP_FAILED',
          `Step ${agent.position} (${agent.name}) executed. Cost: $${stepCost.toFixed(4)}.`
        )
        await supervisorService.logComputeUsage(agent.id, stepCost)
        await supervisorService.registerHeartbeat(agent.id, agentOutput.success ? 'idle' : 'failed', runId)

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
           throw new Error(`Execution halted: Agent "${agent.name}" failed to complete successfully.`);
        }
      }

      // 3. Transition to VALIDATING stage
      await transitionWorkflowRun(runId, 'VALIDATING', { workflowId });
      await new Promise(r => setTimeout(r, 600)); // Small delay for validation trace

      // ── Outcome Engine Scoring & Optimization Tuning ──
      const finalOutcomeScore = await outcomeEngineService.scoreOutcome(runId, goalId);

      try {
        for (const ag of agents) {
          await optimizationEngineService.triggerSelfImprovementTuning(ag.id, runId);
        }
      } catch (err: any) {
        console.warn('[LangGraph] Optimization tuning failed:', err.message);
      }

      // ── Skills Harvesting Continuous Learning Loop (Phase 2.4) ──
      try {
        const { skillsHarvestingService } = await import('./skills-harvesting.service')
        await skillsHarvestingService.harvestSkill(runId, tenantId)
      } catch (harvestErr: any) {
        console.warn('[LangGraph] Skills harvesting failed:', harvestErr.message)
      }

      // 4. Final transition: COMPLETED
      await transitionWorkflowRun(runId, 'COMPLETED', {
        workflowId,
        outputData: {
          ...previousOutputs,
          outcome_score: finalOutcomeScore
        },
        creditsUsed: totalCredits,
      });

      await db.query(`UPDATE workflows SET last_run_at = NOW(), run_count = run_count + 1 WHERE id = $1`, [workflowId]);

    } catch (err: any) {
      console.error("[LangGraph] Workflow failed:", err);
      const checkRunFinal = await db.query('SELECT status FROM workflow_runs WHERE id = $1', [runId]);
      const finalStatus = checkRunFinal.rows[0]?.status || 'running';
      
      if (finalStatus !== 'cancelled') {
        await transitionWorkflowRun(runId, 'FAILED', {
          workflowId,
          errorMessage: err.message,
          creditsUsed: totalCredits,
        });
      }
    }
  });

  return { run_id: runId };
}
