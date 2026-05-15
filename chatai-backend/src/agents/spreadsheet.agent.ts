import { readCsv, writeCsv, readGoogleSheet, writeGoogleSheet } from '../tools/spreadsheet.tool'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runSpreadsheetAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['spreadsheet']
  
  console.log(`[Agent: ${agent.name}] Starting spreadsheet task...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const operation = input.user_inputs?.operation || 'read'
    const source = input.user_inputs?.source || 'csv'
    
    let result: any = {}

    if (source === 'google_sheets') {
      const sheetId = input.user_inputs?.sheet_id
      const range = input.user_inputs?.range
      
      if (operation === 'read') {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Reading from Google Sheets...' })
        result = await readGoogleSheet({ sheetId, range })
      } else {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Writing to Google Sheets...' })
        const values = input.user_inputs?.values || []
        result = await writeGoogleSheet({ sheetId, range, values })
      }
    } else {
      const filePath = input.user_inputs?.file_path
      if (operation === 'read') {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Reading CSV file...' })
        result = await readCsv({ filePath })
      } else {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Writing CSV file...' })
        const data = input.user_inputs?.data || []
        result = await writeCsv({ data, filePath })
      }
    }

    const output: AgentOutput = {
      success: true,
      data: result,
      summary: `Spreadsheet ${operation} operation complete.`,
      output_type: 'data',
      confidence: 1.0,
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
      summary: 'Spreadsheet operation failed',
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
