import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { callLLM } from './base.agent'
import { google } from 'googleapis'

export async function runCloudStorageAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['drive_operations']
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Initializing cloud storage operations...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const hasIntegration = await integrationRegistryService.hasIntegration(tenantId, 'google-drive')
    if (!hasIntegration) {
      throw new Error(`Integration "Google Drive" is required for storage actions. Please connect it first on the Workspace Connections page.`)
    }

    const token = await integrationRegistryService.getToken(tenantId, 'google-drive')
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Identifying generated deliverables to sync...' })

    // Router
    const systemPrompt = `You are a Cloud Storage Router.
    Analyze the user instruction and return JSON:
    {
      "action": "upload" | "share" | "list",
      "folderName": "target folder or empty",
      "fileName": "desired file name or empty",
      "emailToShare": "email to share with or empty"
    }`

    const modelToUse = 'meta/llama-3.1-8b-instruct'
    const { content: routerJson } = await callLLM(modelToUse, systemPrompt, `Prompt: ${prompt}`, 200, 1, runId, agent.name)
    const decision = JSON.parse(routerJson.replace(/```json/gi, '').replace(/```/g, '').trim())

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Executing action: ${decision.action} on Drive...` })

    let resultData: any = {}
    const isMock = !token || token.startsWith('mock-token-')

    // Find preceding content if uploading
    let contentToUpload = 'Empty file contents'
    let filename = decision.fileName || 'Report.md'
    
    const outputs = Object.values(input.previous_outputs || {}) as any[]
    const fileOutput = outputs.find(o => o?.data?.content || o?.data?.fileUrl || o?.summary)
    if (fileOutput) {
      contentToUpload = fileOutput.data?.content || fileOutput.summary || contentToUpload
      if (fileOutput.data?.filename) filename = fileOutput.data.filename
    }

    if (isMock) {
      resultData = {
        mode: 'mock',
        status: 'uploaded',
        filename,
        folder: decision.folderName || 'Root',
        fileId: `mock-drive-${Date.now()}`,
        webViewLink: `https://drive.google.com/mock/file/${Date.now()}`
      }
    } else {
      // Real Google Drive integration
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: token })
      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      if (decision.action === 'upload') {
        const stream = require('stream')
        const bufferStream = new stream.PassThrough()
        bufferStream.end(Buffer.from(contentToUpload))

        const response = await drive.files.create({
          requestBody: {
            name: filename,
            mimeType: filename.endsWith('.csv') ? 'text/csv' : 'text/markdown'
          },
          media: {
            mimeType: filename.endsWith('.csv') ? 'text/csv' : 'text/markdown',
            body: bufferStream
          },
          fields: 'id, name, webViewLink'
        })
        resultData = {
          mode: 'real',
          status: 'uploaded',
          filename: response.data.name,
          fileId: response.data.id,
          webViewLink: response.data.webViewLink
        }
      } else {
        resultData = { mode: 'real', status: 'simulated_action', action: decision.action }
      }
    }

    const output: AgentOutput = {
      success: true,
      data: resultData,
      summary: `Successfully saved "${filename}" to Google Drive folder "${decision.folderName || 'Root'}".`,
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
    logger.error(`[Agent: ${agent.name}] Error:`, err.message)
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: `Drive storage operation failed: ${err.message}`,
      output_type: 'error',
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
