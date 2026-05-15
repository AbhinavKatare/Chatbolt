import { readCsv, readExcel, analyzeData } from '../tools/spreadsheet.tool'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runDataProcessor(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['spreadsheet']
  
  console.log(`[Agent: ${agent.name}] Starting data processing...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    let data: any[] = []
    const filePath = input.user_inputs?.file_path
    
    if (filePath) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Loading and parsing file...' })
      if (filePath.endsWith('.csv')) {
        const res = await readCsv({ filePath })
        data = res.data
      } else if (filePath.endsWith('.xlsx')) {
        const res = await readExcel({ filePath })
        data = res.data
      }
    } else {
      // Try to get data from previous agent (e.g. scraper or api_caller)
      const previous = (Object.values(input.previous_outputs || {}) as any[]).find((o: any) => o.data?.results || o.data?.response_data)?.data
      data = previous?.results || previous?.response_data || []
    }

    if (data.length === 0) {
      throw new Error('No data found for processing.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Processing ${data.length} rows...` })
    
    // Simple cleaning: remove duplicates
    const cleanedData = Array.from(new Set(data.map(d => JSON.stringify(d)))).map(s => JSON.parse(s))

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing data with AI...' })
    const analysis = await analyzeData({ 
      data: cleanedData, 
      question: agent.description 
    })

    const output: AgentOutput = {
      success: true,
      data: {
        analysis: analysis.analysis,
        cleaned_data: cleanedData.slice(0, 100), // Return sample
        total_rows: cleanedData.length,
        insights: [] // Extracted from analysis text if needed
      },
      summary: `Data processing complete. Analyzed ${cleanedData.length} rows.`,
      output_type: 'data',
      confidence: 0.9,
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
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Data processing failed',
      output_type: 'data',
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
