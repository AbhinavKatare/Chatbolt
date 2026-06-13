import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runDatabaseArchitectAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting Database Architecture Analysis...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const dbSchema = input.user_inputs?.schema || input.previous_outputs?.schema || ''
    const slowQueries = input.user_inputs?.slow_queries || input.previous_outputs?.queries || agent.description
    
    if (!slowQueries) {
      throw new Error('No slow queries or schema provided for analysis.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing query execution plans and schema...' })
    
    const prompt = `You are a Principal Database Architect and DBA.
Task: Analyze the provided slow query logs and (optional) schema. Suggest query optimizations, missing indexes, and schema improvements.

Schema (if provided):
${typeof dbSchema === 'string' ? dbSchema.substring(0, 10000) : JSON.stringify(dbSchema)}

Queries to Optimize:
${typeof slowQueries === 'string' ? slowQueries.substring(0, 10000) : JSON.stringify(slowQueries)}

Your output MUST be a JSON object with this structure:
{
  "performance_bottlenecks": ["Full table scan on Users table", "Missing composite index"],
  "optimizations": [
    {
      "original_query": "SELECT ...",
      "optimized_query": "SELECT ...",
      "suggested_index_ddl": "CREATE INDEX ...",
      "reason": "Why this improves performance"
    }
  ],
  "schema_recommendations": "General schema normalization or denormalization advice."
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Database Performance Expert.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'database_analysis', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse Database JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed Database analysis. Proposed ${(parsedData as any).optimizations?.length || 0} query optimizations.`,
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
      summary: 'Database analysis failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
