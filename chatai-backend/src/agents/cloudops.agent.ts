import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runCloudOpsAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []            // async function for cloudops agent callback properties added for mainly promises
  
  logger.info(`[Agent: ${agent.name}] Starting CloudOps Cost Optimization...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })          // we will use the agent name here 

  try {
    const usageData = input.user_inputs?.usage_data || input.previous_outputs || agent.description
    
    if (!usageData) {
      throw new Error('No cloud usage metrics provided for analysis.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing AWS/GCP architecture for cost bottlenecks...' })
    
    const prompt = `You are a Principal Cloud Architect and FinOps Expert.
Task: Analyze the following cloud infrastructure usage data/metrics and generate a highly detailed cost-saving optimization report.

Metrics/Usage Data:
${typeof usageData === 'string' ? usageData : JSON.stringify(usageData)}

Your output MUST be a JSON object with this structure:
{
  "estimated_savings_percentage": "10-30%",
  "current_inefficiencies": ["Over-provisioned EC2", "Unattached EBS volumes"],
  "recommendations": [
    {
      "resource": "EC2/RDS/S3",
      "action": "Downsize/Delete/Migrate",
      "reason": "Why this saves money",
      "risk_level": "Low/Medium/High"
    }
  ],
  "infrastructure_as_code": "Optional: Provide a Terraform or AWS CDK snippet to implement the changes."
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Cloud FinOps Expert.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'cloudops_analysis', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse CloudOps JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed CloudOps cost analysis. Proposed savings: ${(parsedData as any).estimated_savings_percentage || 'Unknown'}.`,
      output_type: 'data',
      confidence,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output

  } catch (err: any) {
    console.error(`[Agent: ${agent.name}] Error:`, err.message)
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return {
      success: false,
      data: null,
      summary: 'CloudOps analysis failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
