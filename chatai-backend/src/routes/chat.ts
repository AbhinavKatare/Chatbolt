import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { query, queryOne } from '../db'
import { authMiddleware, apiKeyMiddleware } from '../middleware/auth.middleware'
import { requireCredits } from '../middleware/credits.middleware'
import { streamChat, getAnswer } from '../services/rag.service'
import { deductCredit } from '../services/credits.service'
import { Conversation, Message } from '../types'

const router = Router()

// ─── Internal (dashboard preview) ─────────────────────────────────

// POST /chat/:agentId/stream  — SSE streaming
router.post('/:agentId/stream', authMiddleware, requireCredits, async (req: Request, res: Response) => {
  try {
    const { message, session_id, history = [] } = z.object({
      message: z.string().min(1).max(2000),
      session_id: z.string().optional(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().default([]),
    }).parse(req.body)

    const sessionId = session_id || uuidv4()

    // Get or create conversation
    let conversation = await queryOne<Conversation>(
      'SELECT * FROM conversations WHERE session_id = $1 AND agent_id = $2',
      [sessionId, req.params.agentId]
    )

    if (!conversation) {
      const [conv] = await query<Conversation>(
        `INSERT INTO conversations (agent_id, tenant_id, session_id, channel)
         VALUES ($1, $2, $3, 'web') RETURNING *`,
        [req.params.agentId, req.tenantId, sessionId]
      )
      conversation = conv
    }

    // Save user message
    await query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversation.id, message]
    )

    // Stream response
    const { fullResponse, tokensUsed, sources, escalate } = await streamChat({
      agentId: req.params.agentId,
      tenantId: req.tenantId!,
      userMessage: message,
      conversationId: conversation.id,
      history,
      res,
    })

    // Save assistant message
    await query(
      `INSERT INTO messages (conversation_id, role, content, tokens_used, sources)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [conversation.id, fullResponse, tokensUsed, JSON.stringify(sources)]
    )

    // Handle escalation
    if (escalate && !conversation.escalated) {
      await query(
        `UPDATE conversations SET escalated = true, escalated_at = NOW() WHERE id = $1`,
        [conversation.id]
      )
    }

    // Deduct credit
    await deductCredit(req.tenantId!, conversation.id)

  } catch (err: any) {
    if (!res.headersSent) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
      res.status(500).json({ error: err.message })
    }
  }
})

// POST /chat/:agentId/message — non-streaming JSON response
router.post('/:agentId/message', authMiddleware, requireCredits, async (req: Request, res: Response) => {
  try {
    const { message, session_id, history = [] } = z.object({
      message: z.string().min(1).max(2000),
      session_id: z.string().optional(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().default([]),
    }).parse(req.body)

    const sessionId = session_id || uuidv4()

    let conversation = await queryOne<Conversation>(
      'SELECT * FROM conversations WHERE session_id = $1 AND agent_id = $2',
      [sessionId, req.params.agentId]
    )
    if (!conversation) {
      const [conv] = await query<Conversation>(
        `INSERT INTO conversations (agent_id, tenant_id, session_id, channel)
         VALUES ($1, $2, $3, 'web') RETURNING *`,
        [req.params.agentId, req.tenantId, sessionId]
      )
      conversation = conv
    }

    await query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversation.id, message]
    )

    const { answer, sources, escalate } = await getAnswer(
      req.params.agentId, req.tenantId!, message, history
    )

    await query(
      `INSERT INTO messages (conversation_id, role, content, sources) VALUES ($1, 'assistant', $2, $3)`,
      [conversation.id, answer, JSON.stringify(sources)]
    )

    if (escalate && !conversation.escalated) {
      await query('UPDATE conversations SET escalated = true, escalated_at = NOW() WHERE id = $1', [conversation.id])
    }

    await deductCredit(req.tenantId!, conversation.id)

    res.json({ answer, sources, escalate, session_id: sessionId, conversation_id: conversation.id })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// ─── Public widget endpoint (API key auth) ─────────────────────────

// POST /chat/widget/:agentId/stream
router.post('/widget/:agentId/stream', apiKeyMiddleware, requireCredits, async (req: Request, res: Response) => {
  try {
    const { message, session_id, history = [] } = z.object({
      message: z.string().min(1).max(2000),
      session_id: z.string().optional(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().default([]),
    }).parse(req.body)

    const sessionId = session_id || uuidv4()

    let conversation = await queryOne<Conversation>(
      'SELECT * FROM conversations WHERE session_id = $1 AND agent_id = $2',
      [sessionId, req.params.agentId]
    )
    if (!conversation) {
      const [conv] = await query<Conversation>(
        `INSERT INTO conversations (agent_id, tenant_id, session_id, channel)
         VALUES ($1, $2, $3, 'web') RETURNING *`,
        [req.params.agentId, req.tenantId, sessionId]
      )
      conversation = conv
    }

    await query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversation.id, message]
    )

    const { fullResponse, tokensUsed, sources, escalate } = await streamChat({
      agentId: req.params.agentId,
      tenantId: req.tenantId!,
      userMessage: message,
      conversationId: conversation.id,
      history,
      res,
    })

    await query(
      `INSERT INTO messages (conversation_id, role, content, tokens_used, sources) VALUES ($1,'assistant',$2,$3,$4)`,
      [conversation.id, fullResponse, tokensUsed, JSON.stringify(sources)]
    )

    if (escalate && !conversation.escalated) {
      await query('UPDATE conversations SET escalated = true, escalated_at = NOW() WHERE id = $1', [conversation.id])
    }

    await deductCredit(req.tenantId!, conversation.id)
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// ─── Conversation history ──────────────────────────────────────────

// GET /chat/:agentId/conversations
router.get('/:agentId/conversations', authMiddleware, async (req: Request, res: Response) => {
  const { page = '1', limit = '20', escalated } = req.query

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
  const escalatedFilter = escalated === 'true' ? 'AND c.escalated = true' : ''

  const conversations = await query(
    `SELECT c.*, 
       COUNT(m.id) AS message_count,
       MAX(m.created_at) AS last_message_at,
       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.agent_id = $1 AND c.tenant_id = $2 ${escalatedFilter}
     GROUP BY c.id
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT $3 OFFSET $4`,
    [req.params.agentId, req.tenantId, parseInt(limit as string), offset]
  )

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM conversations WHERE agent_id = $1 AND tenant_id = $2`,
    [req.params.agentId, req.tenantId]
  )

  res.json({ conversations, total: parseInt(count), page: parseInt(page as string) })
})

// GET /chat/:agentId/conversations/:convId/messages
router.get('/:agentId/conversations/:convId/messages', authMiddleware, async (req: Request, res: Response) => {
  const conv = await queryOne<Conversation>(
    'SELECT * FROM conversations WHERE id = $1 AND agent_id = $2 AND tenant_id = $3',
    [req.params.convId, req.params.agentId, req.tenantId]
  )
  if (!conv) return res.status(404).json({ error: 'Conversation not found' })

  const messages = await query<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [req.params.convId]
  )

  res.json({ conversation: conv, messages })
})

// POST /chat/:agentId/conversations/:convId/resolve
router.post('/:agentId/conversations/:convId/resolve', authMiddleware, async (req: Request, res: Response) => {
  await query(
    `UPDATE conversations SET resolved = true, resolved_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [req.params.convId, req.tenantId]
  )
  res.json({ success: true })
})

export default router
