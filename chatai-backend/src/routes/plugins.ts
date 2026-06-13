import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { encrypt, hash } from '../lib/crypto'
import { z } from 'zod'

const router = Router()

// Static Registry of Supported Plugins
const SUPPORTED_PLUGINS = [
  {
    service_name: 'browser',
    display_name: 'My Browser Operator',
    category: 'Productivity',
    description: 'Lend a sandbox tab to agents to search and automate web actions safely.',
    icon: '🌐',
    scopes: ['Browse web', 'Parse DOM', 'Interact with forms'],
    require_credentials: false
  },
  {
    service_name: 'gmail',
    display_name: 'Gmail Assistant',
    category: 'Communication',
    description: 'Draft emails, search messages, and compile thread highlights instantly.',
    icon: '✉️',
    scopes: ['Read emails', 'Send drafts', 'Search threads'],
    require_credentials: true
  },
  {
    service_name: 'github',
    display_name: 'GitHub Agent',
    category: 'Development',
    description: 'Manage issues, review pull requests, and automate release logs.',
    icon: '🐙',
    scopes: ['Read issues', 'Write comments', 'Deploy codes'],
    require_credentials: true
  },
  {
    service_name: 'notion',
    display_name: 'Notion Workspace',
    category: 'Productivity',
    description: 'Sync workspace directories, fetch content pages, and format summaries.',
    icon: '📝',
    scopes: ['Read pages', 'Write databases', 'Update blocks'],
    require_credentials: true
  },
  {
    service_name: 'google-drive',
    display_name: 'Google Drive Sync',
    category: 'Research',
    description: 'Access document libraries, import content, and upload reports.',
    icon: '📁',
    scopes: ['Read files', 'Search folders', 'Upload assets'],
    require_credentials: true
  },
  {
    service_name: 'google-calendar',
    display_name: 'Google Calendar Scheduler',
    category: 'Productivity',
    description: 'Direct scheduling, event coordinating, and daily schedules overview.',
    icon: '📅',
    scopes: ['List events', 'Create bookings', 'Send invites'],
    require_credentials: true
  },
  {
    service_name: 'slack',
    display_name: 'Slack Notifier',
    category: 'Communication',
    description: 'Send messages, post reports, and ping operations channels automatically.',
    icon: '💬',
    scopes: ['Post messages', 'Ping channels', 'Listen mentions'],
    require_credentials: true
  },
  {
    service_name: 'stripe',
    display_name: 'Stripe Merchant',
    category: 'Finance',
    description: 'Audit transaction metrics, configure subscriptions, and fetch details.',
    icon: '💳',
    scopes: ['Read invoices', 'Sync subscriptions', 'Analyze revenue'],
    require_credentials: true
  },
  {
    service_name: 'airtable',
    display_name: 'Airtable Hub',
    category: 'CRM',
    description: 'Store leads, retrieve records, and coordinate team intake workflows.',
    icon: '📊',
    scopes: ['Read bases', 'Write tables', 'Fetch schemas'],
    require_credentials: true
  },
  {
    service_name: 'zapier',
    display_name: 'Zapier Automation',
    category: 'Productivity',
    description: 'Trigger multi-app workflow pipelines, sync webhook events, and automate actions.',
    icon: '⚡',
    scopes: ['Post webhooks', 'Trigger workflows', 'Relay actions'],
    require_credentials: true
  },
  {
    service_name: 'twilio',
    display_name: 'Twilio SMS Agent',
    category: 'Communication',
    description: 'Send text alerts, initiate phone integrations, and coordinate outreach.',
    icon: '📱',
    scopes: ['Send SMS', 'Dispatch triggers', 'Track delivery'],
    require_credentials: true
  },
  {
    service_name: 'dropbox',
    display_name: 'Dropbox Archive',
    category: 'Research',
    description: 'Secure file storage syncing, content exports, and asset transfers.',
    icon: '📦',
    scopes: ['Read archives', 'Store assets', 'Manage syncs'],
    require_credentials: true
  }
]

// GET /plugins — List plugins and their active states for the tenant
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const vaultRecords = await query(
      `SELECT service_name, display_name, is_valid, last_verified_at, created_at 
       FROM user_api_vault 
       WHERE tenant_id = $1`,
      [req.tenantId]
    )

    const vaultMap = new Map(vaultRecords.map(r => [r.service_name, r]))

    const plugins = SUPPORTED_PLUGINS.map(p => {
      const record = vaultMap.get(p.service_name)
      return {
        ...p,
        installed: !!record,
        is_active: record ? record.is_valid : false,
        last_verified_at: record ? record.last_verified_at : null,
        created_at: record ? record.created_at : null
      }
    })

    res.json({ plugins })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /plugins/install — Connect/configure a plugin
router.post('/install', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { service_name, key_value, display_name } = z.object({
      service_name: z.string(),
      key_value: z.string().min(2, 'Credentials token / API key is required'),
      display_name: z.string().optional()
    }).parse(req.body)

    const pluginMeta = SUPPORTED_PLUGINS.find(p => p.service_name === service_name)
    if (!pluginMeta) return res.status(404).json({ error: 'Plugin not supported' })

    const finalDisplayName = display_name || pluginMeta.display_name
    const keyHash = hash(key_value)
    const keyEncrypted = encrypt(key_value)

    // Check if already exists, then upsert
    const existing = await queryOne(
      'SELECT id FROM user_api_vault WHERE tenant_id = $1 AND service_name = $2',
      [req.tenantId, service_name]
    )

    if (existing) {
      await query(
        `UPDATE user_api_vault 
         SET display_name = $1, key_hash = $2, key_encrypted = $3, is_valid = true, last_verified_at = NOW()
         WHERE id = $4`,
        [finalDisplayName, keyHash, keyEncrypted, existing.id]
      )
    } else {
      await query(
        `INSERT INTO user_api_vault (tenant_id, service_name, display_name, key_hash, key_encrypted, is_valid, last_verified_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW())`,
        [req.tenantId, service_name, finalDisplayName, keyHash, keyEncrypted]
      )
    }

    res.json({ success: true, message: `${finalDisplayName} connected successfully.` })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// POST /plugins/toggle — Toggle enable/disable status
router.post('/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { service_name, enable } = z.object({
      service_name: z.string(),
      enable: z.boolean()
    }).parse(req.body)

    const result = await query(
      `UPDATE user_api_vault 
       SET is_valid = $1 
       WHERE tenant_id = $2 AND service_name = $3
       RETURNING *`,
      [enable, req.tenantId, service_name]
    )

    if (result.length === 0) return res.status(404).json({ error: 'Plugin registration not found' })

    res.json({ success: true, is_active: enable, message: `Plugin ${enable ? 'enabled' : 'disabled'} successfully.` })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// POST /plugins/uninstall — Remove/uninstall a plugin
router.post('/uninstall', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { service_name } = z.object({
      service_name: z.string()
    }).parse(req.body)

    const result = await query(
      'DELETE FROM user_api_vault WHERE tenant_id = $1 AND service_name = $2 RETURNING *',
      [req.tenantId, service_name]
    )

    if (result.length === 0) return res.status(404).json({ error: 'Plugin registration not found' })

    res.json({ success: true, message: 'Plugin disconnected and credentials deleted.' })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

export default router
