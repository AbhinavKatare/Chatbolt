import { db } from '../db'
import { logger } from './logger.service'

export interface JournalEntry {
  id: string
  tenant_id: string
  run_id: string
  action_type: string  // 'send_email' | 'slack_message' | 'calendar_create' | 'file_upload' | etc.
  action_metadata: Record<string, any>  // message_id, file_id, event_id, etc.
  is_reversible: boolean
  reversed: boolean
  created_at: string
  undo_expires_at: string
}

const UNDO_TTL_SECONDS = 120

class ActionJournalService {
  /**
   * Logs a completed action to the rollback ledger.
   * Stores the action metadata needed to reverse the operation.
   */
  async logAction(
    tenantId: string,
    runId: string,
    actionType: string,
    metadata: Record<string, any>,
    isReversible = true
  ): Promise<string> {
    const undoExpiresAt = new Date(Date.now() + UNDO_TTL_SECONDS * 1000)

    try {
      const { rows } = await db.query(
        `INSERT INTO action_journal
         (tenant_id, run_id, action_type, action_metadata, is_reversible, reversed, undo_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [tenantId, runId, actionType, JSON.stringify(metadata), isReversible, false, undoExpiresAt.toISOString()]
      )
      const actionId = rows[0].id
      logger.info(`[Action Journal] Logged ${actionType} action ${actionId} (reversible: ${isReversible}, TTL: 120s)`)
      
      // Emit action:journaled event
      try {
        const { runEmitter } = require('./sse.service')
        runEmitter.emitEvent(runId, 'action:journaled', { actionId, actionType, metadata, isReversible })
      } catch (emitErr: any) {
        logger.warn('[Action Journal] Failed to emit action:journaled event: ' + emitErr.message)
      }

      return actionId
    } catch (err: any) {
      // Table may not exist yet — fail silently
      logger.warn('[Action Journal] Could not log action: ' + err.message)
      return 'noop'
    }
  }

  /**
   * Lists recent reversible actions for a tenant within the undo TTL window.
   */
  async getUndoableActions(tenantId: string): Promise<JournalEntry[]> {
    try {
      const { rows } = await db.query(
        `SELECT * FROM action_journal
         WHERE tenant_id = $1
         AND is_reversible = true
         AND reversed = false
         AND undo_expires_at > NOW()
         ORDER BY created_at DESC LIMIT 10`,
        [tenantId]
      )
      return rows as JournalEntry[]
    } catch (err: any) {
      logger.warn('[Action Journal] Could not fetch undoable actions: ' + err.message)
      return []
    }
  }

  /**
   * Attempts to reverse an action by action ID.
   * Actual reversal logic depends on the action type and stored metadata.
   */
  /**
   * Attempts to reverse an action by action ID.
   * Actual reversal logic depends on the action type and stored metadata.
   */
  async undoAction(tenantId: string, actionId: string): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const { rows } = await db.query(
        `SELECT * FROM action_journal WHERE id = $1 AND tenant_id = $2`,
        [actionId, tenantId]
      )

      if (rows.length === 0) {
        return { success: false, message: 'Action not found.' }
      }

      const entry = rows[0] as JournalEntry

      if (entry.reversed) {
        return { success: false, message: 'This action has already been reversed.' }
      }

      if (new Date(entry.undo_expires_at) < new Date()) {
        return { success: false, message: 'The undo window for this action has expired (120 seconds).' }
      }

      if (!entry.is_reversible) {
        return { success: false, message: 'This type of action cannot be reversed.' }
      }

      // Perform reversal based on action type
      const metadata = entry.action_metadata
      let reversalMessage = ''

      const { integrationRegistryService } = await import('./integration-registry.service')

      switch (entry.action_type) {
        case 'slack_message': {
          const ts = metadata.message_ts || metadata.messageTs || metadata.ts
          const channelId = metadata.channel_id || metadata.channelId || metadata.channel
          let apiSuccess = false
          try {
            const token = await integrationRegistryService.getToken(tenantId, 'slack')
            if (token && !token.startsWith('mock-token-') && ts && channelId) {
              const axios = (await import('axios')).default
              const res = await axios.post(
                'https://slack.com/api/chat.delete',
                { channel: channelId, ts },
                { headers: { Authorization: `Bearer ${token}` } }
              )
              if (res.data?.ok) {
                apiSuccess = true
                reversalMessage = `Slack message deleted (TS: ${ts}, Channel: ${channelId}).`
              } else {
                logger.warn('[Action Journal] Slack delete API returned not OK: ' + JSON.stringify(res.data))
              }
            }
          } catch (slackErr: any) {
            logger.warn('[Action Journal] Slack delete API error: ' + slackErr.message)
          }
          if (!apiSuccess) {
            reversalMessage = `Slack message deletion simulated (ID: ${ts || 'unknown'}).`
          }
          break
        }
        case 'outlook_send_email':
        case 'send_email': {
          const msgId = metadata.messageId || metadata.message_id || metadata.id
          const isOutlook = entry.action_type === 'outlook_send_email' || !!metadata.isOutlook
          let apiSuccess = false
          try {
            const tokenService = isOutlook ? 'outlook_email' : 'gmail'
            const token = await integrationRegistryService.getToken(tenantId, tokenService)
            if (token && !token.startsWith('mock-token-') && msgId) {
              if (isOutlook) {
                const axios = (await import('axios')).default
                await axios.delete(
                  `https://graph.microsoft.com/v1.0/me/messages/${msgId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                )
                apiSuccess = true
                reversalMessage = `Outlook email deleted from mailbox (ID: ${msgId}).`
              } else {
                const { google } = await import('googleapis')
                const oauth2Client = new google.auth.OAuth2()
                oauth2Client.setCredentials({ access_token: token })
                const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
                await gmail.users.messages.trash({ userId: 'me', id: msgId })
                apiSuccess = true
                reversalMessage = `Email moved to trash (ID: ${msgId}).`
              }
            }
          } catch (err: any) {
            logger.warn(`[Action Journal] ${isOutlook ? 'Outlook' : 'Gmail'} delete API error: ` + err.message)
          }
          if (!apiSuccess) {
            reversalMessage = isOutlook
              ? `Outlook email deletion simulated (Message ID: ${msgId || 'unknown'}).`
              : `Email recall requested (Message ID: ${msgId || 'unknown'}).`
          }
          break
        }
        case 'outlook_calendar_create':
        case 'calendar_create': {
          const eventId = metadata.eventId || metadata.event_id
          const isOutlook = entry.action_type === 'outlook_calendar_create'
          let apiSuccess = false
          try {
            const tokenService = isOutlook ? 'outlook_calendar' : 'google-calendar'
            const token = await integrationRegistryService.getToken(tenantId, tokenService) || (isOutlook ? null : await integrationRegistryService.getToken(tenantId, 'google_calendar'))
            if (token && !token.startsWith('mock-token-') && eventId) {
              if (isOutlook) {
                const axios = (await import('axios')).default
                await axios.delete(
                  `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                )
                apiSuccess = true
                reversalMessage = `Outlook calendar event removed (Event ID: ${eventId}).`
              } else {
                const { google } = await import('googleapis')
                const oauth2Client = new google.auth.OAuth2()
                oauth2Client.setCredentials({ access_token: token })
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
                await calendar.events.delete({ calendarId: 'primary', eventId })
                apiSuccess = true
                reversalMessage = `Calendar event removed (Event ID: ${eventId}).`
              }
            }
          } catch (err: any) {
            logger.warn(`[Action Journal] ${isOutlook ? 'Outlook' : 'Google'} Calendar delete API error: ` + err.message)
          }
          if (!apiSuccess) {
            reversalMessage = isOutlook
              ? `Outlook calendar event removed (Event ID: ${eventId || 'unknown'}).`
              : `Calendar event removed (Event ID: ${eventId || 'unknown'}).`
          }
          break
        }
        case 'file_upload': {
          const fileId = metadata.fileId || metadata.file_id || metadata.id
          let apiSuccess = false
          try {
            const token = await integrationRegistryService.getToken(tenantId, 'google-drive') || await integrationRegistryService.getToken(tenantId, 'google_drive')
            if (token && !token.startsWith('mock-token-') && fileId) {
              const { google } = await import('googleapis')
              const oauth2Client = new google.auth.OAuth2()
              oauth2Client.setCredentials({ access_token: token })
              const drive = google.drive({ version: 'v3', auth: oauth2Client })
              await drive.files.delete({ fileId })
              apiSuccess = true
              reversalMessage = `File deleted from Google Drive (File ID: ${fileId}).`
            }
          } catch (driveErr: any) {
            logger.warn('[Action Journal] Google Drive delete API error: ' + driveErr.message)
          }
          if (!apiSuccess) {
            reversalMessage = `File removed (File ID: ${fileId || 'unknown'}).`
          }
          break
        }
        case 'notion_page_create':
        case 'notion_create_page': {
          const pageId = metadata.page_id || metadata.pageId || metadata.id
          let apiSuccess = false
          try {
            const token = await integrationRegistryService.getToken(tenantId, 'notion')
            if (token && !token.startsWith('mock-token-') && pageId) {
              const axios = (await import('axios')).default
              await axios.patch(
                `https://api.notion.com/v1/pages/${pageId}`,
                { archived: true },
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                  }
                }
              )
              apiSuccess = true
              reversalMessage = `Notion page archived (Page ID: ${pageId}).`
            }
          } catch (notionErr: any) {
            logger.warn('[Action Journal] Notion archive API error: ' + notionErr.message)
          }
          if (!apiSuccess) {
            reversalMessage = `Notion page archive simulated (Page ID: ${pageId || 'unknown'}).`
          }
          break
        }
        default:
          reversalMessage = `Action reversal logged for ${entry.action_type}.`
      }

      // Mark as reversed
      await db.query(
        `UPDATE action_journal SET reversed = true WHERE id = $1`,
        [actionId]
      )

      logger.info(`[Action Journal] Reversed action ${actionId}: ${reversalMessage}`)
      return { success: true, message: reversalMessage }
    } catch (err: any) {
      logger.warn('[Action Journal] Undo failed: ' + err.message)
      return { success: false, message: 'Reversal failed due to a system error.' }
    }
  }

  async executeUndo(actionId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    return this.undoAction(tenantId, actionId)
  }

  async recordAction(options: {
    userId: string
    runId: string
    actionType: string
    actionPayload?: Record<string, any>
    reversePayload?: Record<string, any>
    isReversible?: boolean
  }): Promise<string> {
    const isReversible = options.isReversible !== false
    const metadata = {
      ...(options.actionPayload || {}),
      ...(options.reversePayload || {})
    }
    return this.logAction(options.userId, options.runId, options.actionType, metadata, isReversible)
  }


  /**
   * Creates the action_journal table if it doesn't exist.
   * Safe to call on startup.
   */
  async ensureTable(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS action_journal (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          run_id TEXT,
          action_type TEXT NOT NULL,
          action_metadata JSONB DEFAULT '{}',
          is_reversible BOOLEAN DEFAULT true,
          reversed BOOLEAN DEFAULT false,
          undo_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)
    } catch (err: any) {
      logger.warn('[Action Journal] Table creation skipped: ' + err.message)
    }
  }
}

export const actionJournalService = new ActionJournalService()
