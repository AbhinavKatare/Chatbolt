import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { sandboxService } from '../services/sandbox.service'

function extractCode(text: string): string {
  const regex = /```(?:javascript|typescript|js|ts|python|py)?\n([\s\S]*?)```/gi;
  const matches = [...text.matchAll(regex)];
  if (matches.length > 0) {
    return matches.map(m => m[1]).join('\n');
  }
  return text;
}

export async function runCodeAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting code task...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const taskType = input.user_inputs?.task_type || 'write'
    const language = input.user_inputs?.language || 'typescript'
    const codeContext = input.user_inputs?.code || ''
    
    let prompt = ''
    if (taskType === 'write') {
      prompt = `Write high-quality ${language} code for: ${agent.description}. Context: ${codeContext}`
    } else if (taskType === 'debug') {
      const error = input.user_inputs?.error || 'Unknown error'
      prompt = `Debug this ${language} code: ${codeContext}\n\nError: ${error}`
    } else if (taskType === 'review') {
      prompt = `Review this ${language} code for best practices, performance, and security: ${codeContext}`
    } else if (taskType === 'test') {
      prompt = `Write unit tests for this ${language} code: ${codeContext}`
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Executing code ${taskType}...` })
    
    const model = agent.config?.model || ''
    const { content: result, confidence } = await callLLM(
      model,
      agent.system_prompt || 'You are an elite software engineer. Write clean, efficient, and well-documented code.',
      prompt,
      2000,
      1,
      runId,
      agent.name
    )

    let currentResult = result
    let attempt = 0
    const maxRepairAttempts = 3
    let executionSuccess = true
    let executionError = ''

    // Only self-validate if taskType is 'write', 'debug', or 'test' (not 'review')
    if (taskType === 'write' || taskType === 'debug' || taskType === 'test') {
      const isPython = language.toLowerCase() === 'python' || language.toLowerCase() === 'py'
      const isJsTs = ['javascript', 'typescript', 'js', 'ts'].includes(language.toLowerCase())

      if (isPython || isJsTs) {
        while (attempt < maxRepairAttempts) {
          const codeToRun = extractCode(currentResult)
          runEmitter.emitEvent(runId, 'agent_progress', { 
            message: `Validating generated code (Attempt ${attempt + 1}/${maxRepairAttempts})...` 
          })

          let sandboxRes;
          if (isPython) {
            sandboxRes = await sandboxService.runPython(codeToRun, runId)
            if (!toolsUsed.includes('python_sandbox')) toolsUsed.push('python_sandbox')
          } else {
            sandboxRes = await sandboxService.runNode(codeToRun, runId)
            if (!toolsUsed.includes('node_sandbox')) toolsUsed.push('node_sandbox')
          }

          if (sandboxRes.success) {
            executionSuccess = true
            executionError = ''
            break
          } else {
            attempt++
            executionSuccess = false
            executionError = sandboxRes.stderr || sandboxRes.stdout || 'Execution failed'
            
            if (attempt >= maxRepairAttempts) {
              break
            }

            runEmitter.emitEvent(runId, 'agent_progress', { 
              message: `Code execution failed. Attempting silent healing...` 
            })

            const healPrompt = `The previously generated code failed execution in the sandbox with the following error:\n\n${executionError}\n\nHere is the code that failed:\n\`\`\`${language}\n${codeToRun}\n\`\`\`\n\nPlease analyze the execution failure, identify the issue (e.g. syntax error, undefined reference, incorrect logic), and write the fully corrected version of the code. Output the corrected code inside a single markdown code block.`
            
            const healRes = await callLLM(
              model,
              agent.system_prompt || 'You are an elite software engineer. Fix the provided code and return the corrected version.',
              healPrompt,
              2000,
              1,
              runId,
              agent.name
            )
            currentResult = healRes.content
          }
        }
      }
    }

    if (!executionSuccess) {
      throw new Error(`Code self-validation failed: ${executionError}`)
    }

    const output: AgentOutput = {
      success: true,
      data: {
        result: currentResult,
        task_type: taskType,
        language
      },
      summary: `Code ${taskType} task completed and verified successfully.`,
      output_type: 'code',
      confidence,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: attempt
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output

  } catch (err: any) {
    console.error(`[Agent: ${agent.name}] Error:`, err.message)
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Code task failed',
      output_type: 'code',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return errorOutput
  }
}
