import { google } from 'googleapis'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { callLLM } from './base.agent'
import fs from 'fs'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
}

export class DriveAgent {
  private static approvedSessions = new Set<string>()

  private async getDriveClient(userId: string) {
    const token = await integrationRegistryService.getToken(userId, 'google-drive')
    if (!token || token.startsWith('mock-token-')) {
      return null
    }
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: token })
    return google.drive({ version: 'v3', auth: oauth2Client })
  }

  isPermissionApproved(userId: string): boolean {
    return DriveAgent.approvedSessions.has(userId)
  }

  approvePermission(userId: string): void {
    DriveAgent.approvedSessions.add(userId)
  }

  async uploadFile(
    userId: string,
    filePath: string,
    filename: string,
    mimeType: string,
    folderId?: string
  ): Promise<{ fileId: string; shareUrl: string }> {
    logger.info(`[DriveAgent] uploadFile called for user ${userId}, file: ${filename}`)
    try {
      const drive = await this.getDriveClient(userId)
      let fileId = `mock-file-${Date.now()}`
      let shareUrl = `https://drive.google.com/mock/file/${fileId}`

      if (drive) {
        const fileMetadata: any = {
          name: filename
        }
        if (folderId) {
          fileMetadata.parents = [folderId]
        }

        const media = {
          mimeType,
          body: fs.createReadStream(filePath)
        }

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: 'id, webViewLink'
        })

        fileId = response.data.id!
        shareUrl = response.data.webViewLink!

        // Make it shared/viewable if required (set public permission)
        try {
          await drive.permissions.create({
            fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone'
            }
          })
        } catch (permErr: any) {
          logger.warn(`[DriveAgent] Could not set public permission on upload: ${permErr.message}`)
        }
      }

      // Log in Action Journal for rollback
      try {
        const { actionJournalService } = await import('../services/action-journal.service')
        await actionJournalService.logAction(userId, 'drive_upload', 'file_upload', { file_id: fileId })
      } catch (logErr: any) {
        logger.warn('Failed to log Drive action in journal:', logErr.message)
      }

      return { fileId, shareUrl }
    } catch (err: any) {
      logger.error('[DriveAgent] uploadFile failed:', err.message)
      throw err
    }
  }

  async listFiles(userId: string, folderId?: string, limit = 20): Promise<DriveFile[]> {
    logger.info(`[DriveAgent] listFiles called for folder: ${folderId || 'root'}`)
    try {
      const drive = await this.getDriveClient(userId)
      if (!drive) {
        return [
          { id: 'file-101', name: 'Q3 Plan.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/mock/file-101' },
          { id: 'file-102', name: 'Sales Data.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', webViewLink: 'https://drive.google.com/mock/file-102' }
        ]
      }

      let q = "trashed = false"
      if (folderId) {
        q += ` and '${folderId}' in parents`
      }

      const response = await drive.files.list({
        q,
        pageSize: limit,
        fields: 'files(id, name, mimeType, webViewLink)'
      })

      return (response.data.files || []).map(f => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        webViewLink: f.webViewLink || undefined
      }))
    } catch (err: any) {
      logger.error('[DriveAgent] listFiles failed:', err.message)
      throw err
    }
  }

  async getShareLink(userId: string, fileId: string): Promise<string> {
    logger.info(`[DriveAgent] getShareLink called for file: ${fileId}`)
    try {
      const drive = await this.getDriveClient(userId)
      if (!drive) {
        return `https://drive.google.com/mock/file/${fileId}`
      }

      const response = await drive.files.get({
        fileId,
        fields: 'webViewLink'
      })

      return response.data.webViewLink!
    } catch (err: any) {
      logger.error('[DriveAgent] getShareLink failed:', err.message)
      throw err
    }
  }

  async createFolder(userId: string, name: string, parentFolderId?: string): Promise<string> {
    logger.info(`[DriveAgent] createFolder called: "${name}"`)
    try {
      const drive = await this.getDriveClient(userId)
      let folderId = `mock-folder-${Date.now()}`

      if (drive) {
        const fileMetadata: any = {
          name,
          mimeType: 'application/vnd.google-apps.folder'
        }
        if (parentFolderId) {
          fileMetadata.parents = [parentFolderId]
        }

        const response = await drive.files.create({
          requestBody: fileMetadata,
          fields: 'id'
        })
        folderId = response.data.id!
      }

      return folderId
    } catch (err: any) {
      logger.error('[DriveAgent] createFolder failed:', err.message)
      throw err
    }
  }
}

export const driveAgent = new DriveAgent()

// Backwards-compatible runCloudStorageAgent wrapper
export async function runCloudStorageAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['drive_operations']
  const tenantId = agent.tenant_id

  logger.info(`[Agent: ${agent.name}] Starting runCloudStorageAgent...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''

    const systemPrompt = `You are a Cloud Storage Router.
    Analyze the user instruction and return JSON:
    {
      "action": "upload" | "share" | "list",
      "folderName": "target folder or empty",
      "fileName": "desired file name or empty",
      "emailToShare": "email to share with or empty"
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content: routerJson } = await callLLM(modelToUse, systemPrompt, `Prompt: ${prompt}`, 200, 1, runId, agent.name)
    const decision = JSON.parse(routerJson.replace(/```json/gi, '').replace(/```/g, '').trim())

    let resultData: any = {}
    if (decision.action === 'upload') {
      const filePath = input.user_inputs?.filePath || '/tmp/dummy.txt'
      const filename = decision.fileName || 'Report.txt'
      
      const uploadResult = await driveAgent.uploadFile(tenantId, filePath, filename, 'text/plain')
      resultData = { status: 'uploaded', ...uploadResult }
    } else {
      const files = await driveAgent.listFiles(tenantId)
      resultData = { files }
    }

    const output: AgentOutput = {
      success: true,
      data: resultData,
      summary: `Successfully completed Drive storage action.`,
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
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return {
      success: false,
      data: null,
      summary: `Drive operation failed: ${err.message}`,
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
  }
}
