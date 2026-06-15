import { logger } from './logger.service';
import OpenAI from 'openai'
import { query, queryOne } from '../db'
import { Agent, ChunkSource, Tenant } from '../types'
import { Response } from 'express'
import { syncLeadToSheet } from './sheets.service'

// specialized NVIDIA Clients
const getFallbackNvidiaKey = () => {
  return process.env.NVIDIA_API_KEY_MISTRAL || process.env.NVIDIA_API_KEY_LLAMA || process.env.NVIDIA_API_KEY || process.env.KIMI_API_KEY || process.env.KIMI_K2_API_KEY || '';
}

export const nvidiaMistral = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY_MISTRAL || getFallbackNvidiaKey(),
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

export const nvidiaLlama = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY_LLAMA || getFallbackNvidiaKey(),
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

export const nvidia = nvidiaLlama

export const nvidiaNemotron = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY_NEMOTRON || getFallbackNvidiaKey(),
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

// BoltAI Gateway Client
export const boltAIGateway = new OpenAI({
  apiKey: process.env.BOLTAI_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
})
// Business-grade models via NVIDIA NIM
export const FREE_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-8b-instruct',
  'mistralai/mixtral-8x22b-instruct-v0.1'
]

function getClient(model: string): OpenAI {
  if (model.includes('mistral')) return nvidiaMistral
  if (model.includes('nemotron')) return nvidiaNemotron
  return nvidiaLlama
}

import { embedText as baseEmbedText } from '../agents/base.agent'

export async function embedText(text: string): Promise<number[]> {
  return baseEmbedText(text)
}

async function searchChunks(agentId: string, tenantId: string, embedding: number[], limit = 5) {
  return query<{ id: string; content: string; similarity: number; document_id: string; filename: string }>(
    `SELECT c.id, c.content, c.document_id, d.filename,
       1 - (c.embedding <=> $1::vector) AS similarity
     FROM chunks c JOIN documents d ON d.id = c.document_id
     WHERE c.agent_id = $2 AND c.tenant_id = $3 AND d.status = 'ready'
       AND 1 - (c.embedding <=> $1::vector) > 0.28
     ORDER BY c.embedding <=> $1::vector LIMIT $4`,
    [`[${embedding.join(',')}]`, agentId, tenantId, limit]
  )
}

function shouldEscalate(message: string, agent: Agent, avgConfidence: number): boolean {
  const rules = agent.escalation_rules as any
  const keywords: string[] = rules?.keywords || ['human', 'agent', 'manager', 'supervisor', 'real person']
  return keywords.some(k => message.toLowerCase().includes(k.toLowerCase()))
    || avgConfidence < (rules?.low_confidence_threshold ?? 0.35)
}

export async function streamChat(options: {
  agentId: string; tenantId: string; userMessage: string
  conversationId: string; history: Array<{ role: 'user'|'assistant'; content: string }>; res: Response
}): Promise<{ fullResponse: string; tokensUsed: number; sources: ChunkSource[]; escalate: boolean }> {
  const { agentId, tenantId, userMessage, history, res } = options

  const agent = await queryOne<Agent>('SELECT * FROM agents WHERE id = $1 AND tenant_id = $2 AND is_active = true', [agentId, tenantId])
  if (!agent) throw new Error('Agent not found')

  const tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [tenantId])

  const config = agent.config as any
  const model: string = config?.model || 'meta/llama-3.1-8b-instruct'

  const embedding = await embedText(userMessage)
  const chunks = await searchChunks(agentId, tenantId, embedding, 5)
  const avgConfidence = chunks.length > 0 ? chunks.reduce((s, c) => s + c.similarity, 0) / chunks.length : 0
  const escalate = shouldEscalate(userMessage, agent, avgConfidence)

  const sources: ChunkSource[] = chunks.map(c => ({
    chunk_id: c.id, document_id: c.document_id, filename: c.filename,
    similarity: Math.round(c.similarity * 100) / 100, excerpt: c.content.slice(0, 120),
  }))

  const persona = agent.persona as any
  const context = chunks.length > 0 ? chunks.map((c, i) => `[${i+1}] ${c.content}`).join('\n\n') : 'No relevant content found.'
  
  let userRAG = ''
  if (tenant?.user_details || tenant?.user_purpose) {
    userRAG = `\n\n[USER CONTEXT RAG]\n`
    if (tenant.user_details) userRAG += `- User/Business Details: ${tenant.user_details}\n`
    if (tenant.user_purpose) userRAG += `- User Primary Purpose/Goals: ${tenant.user_purpose}\n`
    userRAG += `Please adapt your tone, formatting constraints, and answers to align perfectly with the user context.`
  }

  const systemPrompt = `${agent.system_prompt}\nTone: ${persona?.tone || 'professional'}${userRAG}\n\nKNOWLEDGE BASE:\n${context}\n\nAnswer ONLY from the knowledge base. If unsure, offer to escalate.`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.write(`data: ${JSON.stringify({ type: 'sources', sources, escalate })}\n\n`)

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({ role: m.role as any, content: m.content })),
    { role: 'user', content: userMessage },
  ]

  let fullResponse = ''; let tokensUsed = 0
  const client = getClient(model)

  try {
    const stream = await client.chat.completions.create({
      model, stream: true, temperature: config?.temperature ?? 0.3,
      max_tokens: config?.max_tokens ?? 800, messages,
    })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      if (delta) { fullResponse += delta; tokensUsed++; res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`) }
    }
  } catch (err: any) {
    console.error(`Model ${model} failed:`, err.message)
    // No fallback, just end stream if it fails
  }

  res.write(`data: ${JSON.stringify({ type: 'done', tokens: tokensUsed })}\n\n`)
  res.end()

  // Background: Check for leads if this is a lead qualifier agent
  if (persona?.agent_type === 'lead_qualifier') {
    extractAndSaveLead(agentId, tenantId, options.conversationId, [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: fullResponse }])
      .catch(err => console.error('[Lead] Extraction failed:', err))
  }

  return { fullResponse, tokensUsed, sources, escalate }
}

async function extractAndSaveLead(agentId: string, tenantId: string, conversationId: string, history: any[]) {
  const prompt = `You are a lead extraction tool. Analyze the following conversation and extract lead details.
  Extract: name, email, phone, company, requirement, budget.
  Also assign a qualification score from 0-100.
  
  Conversation:
  ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
  
  Return ONLY a JSON object with these fields. If a field is missing, use null.
  Example: {"name": "John", "email": "john@example.com", "score": 85}`

  try {
    const response = await boltAIGateway.chat.completions.create({
      model: 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content || '{}'
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const data = JSON.parse(cleaned)

    // Only save if at least name or email is present
    if (data.name || data.email || data.phone) {
      const sql = 'INSERT INTO leads (tenant_id, agent_id, conversation_id, name, email, phone, company, qualification_score, metadata) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ' +
        'ON CONFLICT (conversation_id) DO UPDATE SET ' +
        'name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, ' +
        'company = EXCLUDED.company, qualification_score = EXCLUDED.qualification_score, ' +
        'metadata = EXCLUDED.metadata RETURNING id'
      
      const [newLead] = await query(sql, [
        tenantId, agentId, conversationId,
        data.name, data.email, data.phone, data.company,
        data.score || 0,
        JSON.stringify({ requirement: data.requirement, budget: data.budget }),
      ]) as any

      logger.info('[Lead] Extracted and saved for conversation ' + conversationId)

      // Sync to Google Sheets if configured
      if (process.env.LEADS_SHEET_ID && newLead?.id) {
        syncLeadToSheet(newLead.id).catch((err: any) => console.error('[Sheets] Sync failed:', err))
      }
    }
  } catch (err) {
    console.error('[Lead] Error extracting lead:', err)
  }
}

export async function getAnswer(agentId: string, tenantId: string, userMessage: string, history: Array<{ role: 'user'|'assistant'; content: string }> = []) {
  const agent = await queryOne<Agent>('SELECT * FROM agents WHERE id = $1 AND tenant_id = $2', [agentId, tenantId])
  if (!agent) throw new Error('Agent not found')

  const tenant = await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [tenantId])

  const config = agent.config as any
  const model: string = config?.model || 'meta/llama-3.1-8b-instruct'
  const embedding = await embedText(userMessage)
  const chunks = await searchChunks(agentId, tenantId, embedding, 5)
  const avgConfidence = chunks.length > 0 ? chunks.reduce((s, c) => s + c.similarity, 0) / chunks.length : 0
  const context = chunks.map(c => c.content).join('\n\n')
  
  let userRAG = ''
  if (tenant?.user_details || tenant?.user_purpose) {
    userRAG = `\n\n[USER CONTEXT RAG]\n`
    if (tenant.user_details) userRAG += `- User/Business Details: ${tenant.user_details}\n`
    if (tenant.user_purpose) userRAG += `- User Primary Purpose/Goals: ${tenant.user_purpose}\n`
    userRAG += `Please adapt your tone, formatting constraints, and answers to align perfectly with the user context.`
  }

  const client = getClient(model)
  const response = await client.chat.completions.create({
    model, temperature: config?.temperature ?? 0.3, max_tokens: config?.max_tokens ?? 800,
    messages: [
      { role: 'system', content: `${agent.system_prompt}${userRAG}\n\nKNOWLEDGE BASE:\n${context}` },
      ...history.slice(-10).map(m => ({ role: m.role as any, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  })
  return {
    answer: response.choices[0].message.content || 'Could not generate response.',
    sources: chunks.map(c => ({ chunk_id: c.id, document_id: c.document_id, filename: c.filename, similarity: c.similarity, excerpt: c.content.slice(0, 120) })),
    escalate: shouldEscalate(userMessage, agent, avgConfidence),
  }
}
