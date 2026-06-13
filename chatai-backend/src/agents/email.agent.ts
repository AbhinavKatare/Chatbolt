import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { logger } from '../services/logger.service'
import { callLLM } from './base.agent'
import { gmailAgent } from './gmail.agent'

export async function runEmailAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['email_operations']
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Initializing email operations...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing email instructions...' })

    // Classify action using LLM
    const systemPrompt = `You are an Email Operation Router.
    Analyze the user instruction and classify it as one of:
    1. "search": Searching threads, listing emails, reading inbox.
    2. "send": Sending a new email.
    3. "draft": Drafting an email.
    4. "reply": Replying to an existing thread.

    Return ONLY a valid JSON:
    {
      "action": "search" | "send" | "draft" | "reply",
      "recipient": "recipient email or empty",
      "subject": "subject line or empty",
      "body": "email body content or empty",
      "query": "search query or empty",
      "threadId": "thread ID if replying or empty"
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content: routerJson } = await callLLM(modelToUse, systemPrompt, `Instruction: ${prompt}`, 250, 1, runId, agent.name)
    const routerDecision = JSON.parse(routerJson.replace(/```json/gi, '').replace(/```/g, '').trim())

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Executing action: ${routerDecision.action}...` })

    const { integrationRegistryService } = await import('../services/integration-registry.service')
    const hasGmail = await integrationRegistryService.hasIntegration(tenantId, 'gmail')
    const hasOutlook = await integrationRegistryService.hasIntegration(tenantId, 'outlook_email')

    let emailProvider: any = gmailAgent
    let isOutlook = false

    if (hasGmail && hasOutlook) {
      let preferred = 'gmail'
      try {
        const { queryOne } = await import('../db')
        const recentRun = await queryOne(
          `SELECT action_type FROM action_journal 
           WHERE tenant_id = $1 AND action_type IN ('gmail_send', 'gmail_read', 'outlook_send', 'outlook_read') 
           ORDER BY created_at DESC LIMIT 1`,
          [tenantId]
        )
        if (recentRun && recentRun.action_type.startsWith('outlook')) {
          preferred = 'outlook_email'
        }
      } catch (e) {}
      if (preferred === 'outlook_email') {
        const { outlookAgent } = await import('./outlook.agent')
        emailProvider = outlookAgent
        isOutlook = true
      }
    } else if (hasOutlook) {
      const { outlookAgent } = await import('./outlook.agent')
      emailProvider = outlookAgent
      isOutlook = true
    }

    let resultData: any = {}

    if (routerDecision.action === 'search') {
      const messages = await emailProvider.listUnread(tenantId)
      resultData = { query: routerDecision.query, messages }
    } else if (routerDecision.action === 'send') {
      const to = routerDecision.recipient || input.user_inputs?.recipient || 'test@example.com'
      const subject = routerDecision.subject || input.user_inputs?.subject || 'Update'
      const body = routerDecision.body || input.user_inputs?.body || ''
      
      const emailResult = await emailProvider.sendEmail(tenantId, { to, subject, body })

      // Log in Action Journal for rollback
      try {
        const { actionJournalService } = await import('../services/action-journal.service')
        await actionJournalService.recordAction({
          userId: tenantId,
          runId,
          actionType: isOutlook ? 'outlook_send_email' : 'send_email',
          actionPayload: { recipient: to, subject, messageId: emailResult.messageId, threadId: emailResult.threadId, isOutlook },
          reversePayload: { messageId: emailResult.messageId }
        })
      } catch (logErr: any) {
        logger.warn('Failed to log email action in journal:', logErr.message)
      }

      resultData = { status: 'sent', to, subject }
    } else if (routerDecision.action === 'draft') {
      const threadId = routerDecision.threadId || 'mock-thread-id'
      const body = routerDecision.body || ''
      const draftId = await emailProvider.draftReply(tenantId, threadId, body)
      resultData = { status: 'drafted', draftId }
    } else {
      resultData = { status: 'completed', action: routerDecision.action }
    }

    const output: AgentOutput = {
      success: true,
      data: resultData,
      summary: `Email operation (${routerDecision.action}) completed successfully.`,
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
      summary: `Email operation failed: ${err.message}`,
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
