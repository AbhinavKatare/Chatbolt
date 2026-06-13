import { logger } from '../services/logger.service';
import { readCsv, readExcel, analyzeData } from '../tools/spreadsheet.tool'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'

export async function runDataProcessor(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['spreadsheet']
  
  logger.info(`[Agent: ${agent.name}] Starting data processing...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    let data: any[] = []
    const filePath = input.user_inputs?.file_path
    
    if (filePath) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Loading and parsing file...' })
      const toolStart = Date.now()
      await traceService.traceToolStart(runId, agent.name, 'read_file', { filePath })
      if (filePath.endsWith('.csv')) {
        const res = await readCsv({ filePath })
        data = res.data
      } else if (filePath.endsWith('.xlsx')) {
        const res = await readExcel({ filePath })
        data = res.data
      }
      await traceService.traceToolComplete(runId, agent.name, 'read_file', { rowCount: data.length }, Date.now() - toolStart)
    } else {
      // Try to get data from previous agent (e.g. scraper or api_caller)
      const outputs = Object.values(input.previous_outputs || {}) as any[]
      const prevObj = outputs.find((o: any) => o?.data?.results || o?.data?.response_data)
      const previous = prevObj?.data
      data = previous?.results || previous?.response_data || []
    }

    if (data.length === 0) {
      throw new Error('No data found for processing.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Processing ${data.length} rows...` })
    
    // Simple cleaning: remove duplicates
    const cleanedData = Array.from(new Set(data.map(d => JSON.stringify(d)))).map(s => JSON.parse(s))

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing data with Python Sandbox...' })
    const toolStart = Date.now()
    await traceService.traceToolStart(runId, agent.name, 'python_execution', { question: agent.description })
    
    // 1. Generate Python code for the analysis
    const { writeCode, executePython } = await import('../tools/code-executor.tool')
    
    // We pass the filePath to the LLM so it knows what file to load in pandas
    const pythonContext = `
    The user wants to analyze a dataset. 
    Task: ${agent.description}
    Data File Path: ${filePath || 'No file path provided. The data is in a variable named "data".'}
    
    Write a Python script using pandas to perform this analysis. 
    If a file path is provided, use pd.read_csv() or pd.read_excel() to load it. 
    Print the final insights to stdout using print() so we can capture the results.
    `
    
    const { code: pyCode } = await writeCode({ task: agent.description, language: 'python', context: pythonContext })
    
    // 2. Execute the Python code in the sandbox
    const pyResult = await executePython({ code: pyCode })
    
    await traceService.traceToolComplete(runId, agent.name, 'python_execution', { success: pyResult.success }, Date.now() - toolStart)

    let finalAnalysis = pyResult.stdout
    if (!pyResult.success) {
       finalAnalysis = `Python execution failed: ${pyResult.stderr}\nCode generated was:\n${pyCode}`
    }

    const output: AgentOutput = {
      success: pyResult.success,
      data: {
        analysis: finalAnalysis,
        code_executed: pyCode,
        cleaned_data: cleanedData.slice(0, 100), // Return sample
        total_rows: cleanedData.length,
        insights: []
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
