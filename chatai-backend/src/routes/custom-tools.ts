import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { z } from 'zod'

const router = Router()
router.use(authMiddleware)

const toolSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  endpoint_url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  auth_type: z.enum(['none', 'bearer', 'api_key', 'basic']).default('none'),
  auth_value: z.string().max(1000).optional().nullable(),
  auth_header: z.string().max(200).optional().nullable(),
  request_schema: z.any().optional(),
  response_schema: z.any().optional(),
  timeout_ms: z.number().int().min(100).max(60000).default(10000),
  is_active: z.boolean().default(true),
})

// 1. List all custom tools
router.get('/', async (req, res) => {
  try {
    const tools = await query(
      `SELECT id, name, description, endpoint_url, method, auth_type, auth_header,
              is_active, call_count, last_called_at, avg_latency_ms, created_at
       FROM custom_tools WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.tenantId]
    )

    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COALESCE(SUM(call_count), 0) as total_calls,
        COALESCE(AVG(avg_latency_ms), 0) as avg_latency
       FROM custom_tools WHERE tenant_id = $1`,
      [req.tenantId]
    )

    res.json({ tools, stats: stats[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Get single tool
router.get('/:id', async (req, res) => {
  try {
    const tool = await queryOne(
      'SELECT * FROM custom_tools WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!tool) return res.status(404).json({ error: 'Tool not found' })

    // Get last 10 execution logs
    const logs = await query(
      'SELECT * FROM tool_execution_logs WHERE tool_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.params.id]
    )

    res.json({ tool: { ...tool, auth_value: undefined }, logs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 3. Create custom tool
router.post('/', async (req, res) => {
  try {
    const body = toolSchema.parse(req.body)
    const [tool] = await query(
      `INSERT INTO custom_tools (tenant_id, name, description, endpoint_url, method, auth_type, auth_value, auth_header, request_schema, response_schema, timeout_ms, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, name, description, endpoint_url, method, auth_type, auth_header, is_active, created_at`,
      [
        req.tenantId, body.name, body.description, body.endpoint_url, body.method,
        body.auth_type, body.auth_value || null, body.auth_header || null,
        JSON.stringify(body.request_schema || {}), JSON.stringify(body.response_schema || {}),
        body.timeout_ms, body.is_active
      ]
    )
    res.status(201).json({ tool })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 4. Update tool
router.patch('/:id', async (req, res) => {
  try {
    const body = toolSchema.partial().parse(req.body)
    const existing = await queryOne(
      'SELECT id FROM custom_tools WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!existing) return res.status(404).json({ error: 'Tool not found' })

    const [tool] = await query(
      `UPDATE custom_tools SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        endpoint_url = COALESCE($3, endpoint_url),
        method = COALESCE($4, method),
        auth_type = COALESCE($5, auth_type),
        auth_value = COALESCE($6, auth_value),
        auth_header = COALESCE($7, auth_header),
        timeout_ms = COALESCE($8, timeout_ms),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
       WHERE id = $10 AND tenant_id = $11
       RETURNING id, name, description, endpoint_url, method, auth_type, auth_header, is_active`,
      [
        body.name || null, body.description || null, body.endpoint_url || null,
        body.method || null, body.auth_type || null, body.auth_value || null,
        body.auth_header || null, body.timeout_ms || null, body.is_active ?? null,
        req.params.id, req.tenantId
      ]
    )
    res.json({ tool })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 5. Delete tool
router.delete('/:id', async (req, res) => {
  try {
    await query(
      'DELETE FROM custom_tools WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 6. Test invoke the tool with sample payload
router.post('/:id/invoke', async (req, res) => {
  try {
    const tool = await queryOne(
      'SELECT * FROM custom_tools WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!tool) return res.status(404).json({ error: 'Tool not found' })
    if (!tool.is_active) return res.status(400).json({ error: 'Tool is disabled' })

    const { payload = {} } = req.body
    const startTime = Date.now()

    // Build request headers
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (tool.auth_type === 'bearer' && tool.auth_value) {
      headers['Authorization'] = `Bearer ${tool.auth_value}`
    } else if (tool.auth_type === 'api_key' && tool.auth_header && tool.auth_value) {
      headers[tool.auth_header] = tool.auth_value
    } else if (tool.auth_type === 'basic' && tool.auth_value) {
      headers['Authorization'] = `Basic ${Buffer.from(tool.auth_value).toString('base64')}`
    }

    let response: any = null
    let error: string | null = null
    let statusCode = 0

    try {
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), tool.timeout_ms || 10000)
      
      const fetchOpts: any = {
        method: tool.method,
        headers,
        signal: ctrl.signal,
      }
      if (tool.method !== 'GET' && tool.method !== 'DELETE') {
        fetchOpts.body = JSON.stringify(payload)
      }

      const fetchRes = await fetch(tool.endpoint_url, fetchOpts)
      clearTimeout(timeout)
      statusCode = fetchRes.status
      
      const contentType = fetchRes.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        response = await fetchRes.json()
      } else {
        response = await fetchRes.text()
      }
    } catch (e: any) {
      error = e.message
    }

    const latency = Date.now() - startTime

    // Update stats
    await query(
      `UPDATE custom_tools SET 
        call_count = COALESCE(call_count, 0) + 1,
        last_called_at = NOW(),
        avg_latency_ms = CASE 
          WHEN avg_latency_ms IS NULL THEN $1
          ELSE (avg_latency_ms * COALESCE(call_count - 1, 0) + $1) / COALESCE(call_count, 1)
        END
       WHERE id = $2`,
      [latency, req.params.id]
    )

    // Save execution log
    await query(
      `INSERT INTO tool_execution_logs (tool_id, tenant_id, payload, response, status_code, latency_ms, error, success)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.params.id, req.tenantId, JSON.stringify(payload),
        JSON.stringify(response), statusCode, latency, error,
        !error && statusCode >= 200 && statusCode < 300
      ]
    )

    res.json({
      success: !error && statusCode >= 200 && statusCode < 300,
      status_code: statusCode,
      latency_ms: latency,
      response,
      error
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 7. Toggle tool active/inactive
router.post('/:id/toggle', async (req, res) => {
  try {
    const tool = await queryOne(
      'SELECT id, is_active FROM custom_tools WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!tool) return res.status(404).json({ error: 'Tool not found' })

    const [updated] = await query(
      'UPDATE custom_tools SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_active',
      [!tool.is_active, req.params.id]
    )
    res.json({ tool: updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
