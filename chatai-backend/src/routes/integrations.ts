import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { z } from 'zod'
import crypto from 'crypto'

const router = Router()

// List of supported integrations for the hub
const INTEGRATIONS_LIST = [
  { service_name: 'browser', display_name: 'Browser', icon: '🌐', description: 'Run tasks in your real browser with your own logged-in sessions.' },
  { service_name: 'gmail', display_name: 'Gmail', icon: '✉️', description: 'Draft replies, search inbox, and summarise threads instantly.' },
  { service_name: 'google-calendar', display_name: 'Google Calendar', icon: '📅', description: 'Manage events, find free slots, and send invites.' },
  { service_name: 'google-drive', display_name: 'Google Drive', icon: '📁', description: 'Access files, save artifacts, and organise documents.' },
  { service_name: 'slack', display_name: 'Slack', icon: '💬', description: 'Send messages, read channels, and post updates to your team.' },
  { service_name: 'notion', display_name: 'Notion', icon: '📝', description: 'Search workspace content, update notes, and automate flows.' },
  { service_name: 'github', display_name: 'GitHub', icon: '🐙', description: 'Manage repos, track code changes, and review pull requests.' },
  { service_name: 'linear', display_name: 'Linear', icon: '📈', description: 'Create issues, update priorities, and track project status.' },
  { service_name: 'hubspot', display_name: 'HubSpot', icon: '🧡', description: 'Access CRM contacts, deals, and log activity history.' },
  { service_name: 'stripe', display_name: 'Stripe', icon: '💳', description: 'View revenue, look up customers, and check subscriptions.' },
  { service_name: 'outlook', display_name: 'Outlook', icon: '📧', description: 'Read and send emails via Microsoft 365.' },
  { service_name: 'airtable', display_name: 'Airtable', icon: '📊', description: 'Query and update your bases and tables.' }
]

// GET /integrations - Retrieve connection status for current tenant
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const list = []
    for (const item of INTEGRATIONS_LIST) {
      const connected = await integrationRegistryService.hasIntegration(req.tenantId as string, item.service_name)
      list.push({
        ...item,
        service: item.service_name,
        connected
      })
    }
    res.json({ success: true, integrations: list })
  } catch (err: any) {
    logger.error('[Integrations Route] Error fetching connections:', err.message)
    res.status(500).json({ error: 'Failed to retrieve connection statuses.' })
  }
})

// GET /integrations/:service/auth-url - Generate OAuth url
router.get('/:service/auth-url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const service = req.params.service
    const authUrl = `${req.protocol}://${req.get('host')}/integrations/connect/${service}?tenantId=${req.tenantId}`
    res.json({ success: true, url: authUrl })
  } catch (err: any) {
    logger.error('[Integrations Route] Error generating auth URL:', err.message)
    res.status(500).json({ error: 'Failed to generate auth URL.' })
  }
})

// GET /integrations/connect/:service - Redirect to mock OAuth Consent Screen
router.get('/connect/:service', async (req: Request, res: Response) => {
  const service = req.params.service
  let tenantId = req.query.tenantId as string || ''
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!tenantId || !uuidRegex.test(tenantId)) {
    try {
      const { queryOne } = await import('../db')
      const tenantRow = await queryOne('SELECT id FROM tenants LIMIT 1')
      if (tenantRow) {
        tenantId = tenantRow.id
      } else {
        tenantId = '00000000-0000-0000-0000-000000000000'
      }
    } catch {
      tenantId = '00000000-0000-0000-0000-000000000000'
    }
  }
  
  const matched = INTEGRATIONS_LIST.find(i => i.service_name === service)
  if (!matched) {
    return res.status(404).send('Service not supported')
  }

  // Render a premium, dark-themed simulated OAuth Authorization Screen
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authorize ${matched.display_name} Connection</title>
      <style>
        body {
          background-color: #050507;
          color: #EDEDED;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background-color: #09090B;
          border: 1px border;
          border-color: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 30px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .icon-pair {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
        }
        .icon {
          font-size: 32px;
          width: 60px;
          height: 60px;
          background: #141418;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .glow {
          box-shadow: 0 0 15px rgba(0, 229, 153, 0.25);
          border-color: rgba(0, 229, 153, 0.3);
        }
        h2 {
          font-size: 16px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 10px 0;
        }
        p {
          font-size: 12px;
          color: #A1A1AA;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn-connect {
          background: #00E599;
          color: #000;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 11px;
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 229, 153, 0.2);
        }
        .btn-connect:hover {
          background: #00f7cc;
          transform: translateY(-1px);
        }
        .btn-cancel {
          background: transparent;
          color: #71717A;
          font-size: 11px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          margin-top: 15px;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-pair">
          <div class="icon">⚡</div>
          <div class="icon glow">${matched.icon}</div>
        </div>
        <h2>Connect ${matched.display_name}</h2>
        <p>Chatbolt requests permission to access your ${matched.display_name} workspace account. This will enable agents to search threads, read content, and take actions on your behalf.</p>
        <form action="/integrations/callback/${service}" method="GET">
          <input type="hidden" name="tenantId" value="${tenantId}">
          <input type="hidden" name="code" value="mock_oauth_code_xyz_789">
          <button type="submit" class="btn-connect">Authorize Connection</button>
        </form>
        <button class="btn-cancel" onclick="window.close()">Cancel Connection</button>
      </div>
    </body>
    </html>
  `)
})

// GET /integrations/callback/:service - Handle OAuth Authorization callback
router.get('/callback/:service', async (req: Request, res: Response) => {
  const service = req.params.service
  const code = req.query.code as string
  let tenantId = req.query.tenantId as string

  if (!tenantId || !code) {
    return res.status(400).send('Missing tenant ID or authorization code.')
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(tenantId)) {
    try {
      const { queryOne } = await import('../db')
      const tenantRow = await queryOne('SELECT id FROM tenants LIMIT 1')
      if (tenantRow) {
        tenantId = tenantRow.id
      } else {
        tenantId = '00000000-0000-0000-0000-000000000000'
      }
    } catch {
      tenantId = '00000000-0000-0000-0000-000000000000'
    }
  }

  const matched = INTEGRATIONS_LIST.find(i => i.service_name === service)
  if (!matched) {
    return res.status(404).send('Service not supported')
  }

  try {
    // Generate a mock secure token representing the connection
    const mockToken = `mock-token-${service}-${crypto.randomUUID()}`
    
    // Save to the registry vault
    await integrationRegistryService.saveToken(tenantId, service, mockToken, matched.display_name)
    
    // Render success message and trigger popup window message closing
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Connection Successful</title>
        <style>
          body {
            background-color: #050507;
            color: #EDEDED;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.05);
            border-top: 3px solid #00E599;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h2 { color: #00E599; font-size: 18px; margin-bottom: 8px; }
          p { color: #A1A1AA; font-size: 12px; }
        </style>
        <script>
          window.onload = function() {
            if (window.opener) {
              window.opener.postMessage({ type: 'oauth_success', service: '${service}' }, '*');
            }
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        </script>
      </head>
      <body>
        <div>
          <div class="spinner"></div>
          <h2>Account Connected</h2>
          <p>Syncing integration parameters. Closing authorization popup...</p>
        </div>
      </body>
      </html>
    `)
  } catch (err: any) {
    logger.error(`[Integrations Route] Callback failed for ${service}:`, err.message)
    res.status(500).send('OAuth callback processing failed.')
  }
})

// POST /integrations/disconnect/:service - Remove connection
router.post('/disconnect/:service', authMiddleware, async (req: Request, res: Response) => {
  const service = req.params.service
  try {
    await integrationRegistryService.deleteToken(req.tenantId as string, service)
    res.json({ success: true, message: `Successfully disconnected ${service}.` })
  } catch (err: any) {
    logger.error(`[Integrations Route] Disconnect failed for ${service}:`, err.message)
    res.status(500).json({ error: 'Failed to delete integration.' })
  }
})

// DELETE /integrations/:service - Revoke connection
router.delete('/:service', authMiddleware, async (req: Request, res: Response) => {
  const service = req.params.service
  try {
    await integrationRegistryService.deleteToken(req.tenantId as string, service)
    res.json({ success: true, message: `Successfully revoked ${service}.` })
  } catch (err: any) {
    logger.error(`[Integrations Route] Revoke failed for ${service}:`, err.message)
    res.status(500).json({ error: 'Failed to revoke integration.' })
  }
})

// POST /integrations/undo/:actionId - Rollback a logged action within the TTL window
router.post('/undo/:actionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { actionJournalService } = await import('../services/action-journal.service')
    const result = await actionJournalService.undoAction(req.tenantId as string, req.params.actionId)
    if (result.success) {
      res.json({ success: true, message: result.message })
    } else {
      res.status(400).json({ success: false, error: result.message })
    }
  } catch (err: any) {
    logger.error('[Integrations Route] Undo failed:', err.message)
    res.status(500).json({ error: 'Failed to reverse action.' })
  }
})

// GET /integrations/undo - List undoable actions within TTL window
router.get('/undo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { actionJournalService } = await import('../services/action-journal.service')
    const actions = await actionJournalService.getUndoableActions(req.tenantId as string)
    res.json({ success: true, actions })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch undoable actions.' })
  }
})

// GET /integrations/briefing - Generate morning briefing for tenant
router.get('/briefing', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { briefingService } = await import('../services/briefing.service')
    const briefing = await briefingService.generateMorningBriefing(req.tenantId as string)
    res.json({ success: true, briefing })
  } catch (err: any) {
    logger.error('[Integrations Route] Briefing generation failed:', err.message)
    res.status(500).json({ error: 'Failed to generate briefing.' })
  }
})

export default router
