import axios from 'axios'
import { integrationRegistryService } from '../services/integration-registry.service'
import { extractAndStoreSessionFacts } from '../services/memory.service'
import { callLLM } from './base.agent'
import { logger } from '../services/logger.service'
import { EmailSummary, EmailMessage, EmailThread, StyleProfile, TriageBriefing } from './gmail.agent'

export class OutlookAgent {
  private async getAccessToken(userId: string): Promise<string | null> {
    const token = await integrationRegistryService.getToken(userId, 'outlook_email')
    if (!token || token.startsWith('mock-token-')) {
      return null
    }
    return token
  }

  async listUnread(userId: string, limit = 20): Promise<EmailSummary[] | TriageBriefing> {
    logger.info(`[OutlookAgent] listUnread called for user ${userId}`)
    try {
      const token = await this.getAccessToken(userId)
      let emails: EmailSummary[] = []

      if (!token) {
        // Mock emails reflecting realistic business cases (similar to GmailAgent)
        if (limit > 10) {
          emails = Array.from({ length: 12 }, (_, i) => ({
            id: `outlook-msg-${100 + i}`,
            threadId: `outlook-thread-${100 + i}`,
            from: i % 4 === 0 
              ? 'David Miller <david.miller@acme.com>' 
              : i % 4 === 1 
                ? 'Sarah Jenkins <sjenkins@acmepartner.com>' 
                : i % 4 === 2 
                  ? 'Newsletter <info@techradar.com>' 
                  : 'Stripe Billing <invoice@stripe.com>',
            subject: i % 3 === 0 
              ? 'Urgent update needed: Q3 Milestones (Outlook)' 
              : i % 3 === 1 
                ? 'Contract review for partner sync (Outlook)' 
                : 'Weekly developer platform newsletter (Outlook)',
            snippet: `This is Outlook email body snippet number ${i}. Please check the attached files and reply back.`,
            receivedAt: new Date(Date.now() - i * 3600000).toISOString(),
            isImportant: i % 3 === 0
          }))
        } else {
          emails = [
            {
              id: 'outlook-msg-101',
              threadId: 'outlook-thread-101',
              from: 'David Miller <david.miller@acme.com>',
              subject: 'Review needed: Project Q3 Roadmap (Outlook)',
              snippet: 'Hi, please take a look at the proposed timeline for Q3 and let me know if we need to adjust the milestones.',
              receivedAt: new Date(Date.now() - 3600000).toISOString(), // 1h ago
              isImportant: true
            },
            {
              id: 'outlook-msg-102',
              threadId: 'outlook-thread-102',
              from: 'Sarah Jenkins <sjenkins@acmepartner.com>',
              subject: 'Acme Corp Contract update (Outlook)',
              snippet: 'Hi, I received the revised agreement. We have one question regarding the SLA terms on page 4.',
              receivedAt: new Date(Date.now() - 7200000).toISOString(), // 2h ago
              isImportant: true
            },
            {
              id: 'outlook-msg-103',
              threadId: 'outlook-thread-103',
              from: 'Newsletter <info@techradar.com>',
              subject: 'Top Tech Trends for 2026 (Outlook)',
              snippet: 'Discover the latest developments in automation, cloud architectures, and developer productivity tools.',
              receivedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
              isImportant: false
            }
          ]
        }
      } else {
        const response = await axios.get(
          `https://graph.microsoft.com/v1.0/me/messages?$filter=isRead eq false&$top=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

        const messages = response.data.value || []
        for (const msg of messages) {
          emails.push({
            id: msg.id,
            threadId: msg.conversationId || msg.id,
            from: msg.from?.emailAddress?.name 
              ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` 
              : msg.from?.emailAddress?.address || 'Unknown',
            subject: msg.subject || 'No Subject',
            snippet: msg.bodyPreview || '',
            receivedAt: new Date(msg.receivedDateTime || Date.now()).toISOString(),
            isImportant: msg.importance === 'high'
          })
        }
      }

      // Hook: extract and store session facts from unread emails
      try {
        await extractAndStoreSessionFacts(
          `outlook-list-${Date.now()}`,
          userId,
          {
            prompt: 'Extract contact details, people names, and relationship status from unread emails.',
            output: JSON.stringify(emails.slice(0, 3)),
            workflow_name: 'Outlook Inbox Read'
          }
        )
      } catch (memErr: any) {
        logger.warn(`[OutlookAgent] Fact extraction failed: ${memErr.message}`)
      }

      if (emails.length > 10) {
        logger.info(`[OutlookAgent] Inbox unread emails (${emails.length}) > 10. Activating inbox triage...`)
        return await this.triageInbox(userId, emails)
      }

      return emails
    } catch (err: any) {
      logger.error('[OutlookAgent] listUnread failed:', err.message)
      throw err
    }
  }

  async searchThreads(userId: string, queryText: string): Promise<EmailSummary[]> {
    logger.info(`[OutlookAgent] searchThreads called for query: "${queryText}"`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) {
        // Return mock search results
        return [
          {
            id: 'outlook-msg-101',
            threadId: 'outlook-thread-101',
            from: 'David Miller <david.miller@acme.com>',
            subject: 'Review needed: Project Q3 Roadmap (Outlook)',
            snippet: 'Hi, please take a look at the proposed timeline for Q3 and let me know if we need to adjust the milestones.',
            receivedAt: new Date(Date.now() - 3600000).toISOString(),
            isImportant: true
          }
        ]
      }

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages?$search="${queryText}"&$top=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const emails: EmailSummary[] = []
      const messages = response.data.value || []
      for (const msg of messages) {
        emails.push({
          id: msg.id,
          threadId: msg.conversationId || msg.id,
          from: msg.from?.emailAddress?.name 
            ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` 
            : msg.from?.emailAddress?.address || 'Unknown',
          subject: msg.subject || 'No Subject',
          snippet: msg.bodyPreview || '',
          receivedAt: new Date(msg.receivedDateTime || Date.now()).toISOString(),
          isImportant: msg.importance === 'high'
        })
      }
      return emails
    } catch (err: any) {
      logger.error('[OutlookAgent] searchThreads failed:', err.message)
      throw err
    }
  }

  async getThread(userId: string, threadId: string): Promise<EmailThread> {
    logger.info(`[OutlookAgent] getThread called for thread ID ${threadId}`)
    try {
      const token = await this.getAccessToken(userId)
      let thread: EmailThread

      if (!token) {
        thread = {
          threadId,
          messages: [
            {
              id: 'outlook-msg-101',
              from: 'David Miller <david.miller@acme.com>',
              to: 'me@chatbolt.io',
              subject: 'Review needed: Project Q3 Roadmap (Outlook)',
              body: 'Hi team,\n\nI have drafted the Project Q3 Roadmap document. Please review the timelines and tell me if you have any questions.\n\nThanks,\nDavid',
              receivedAt: new Date(Date.now() - 3600000).toISOString()
            }
          ]
        }
      } else {
        // In MS Graph, get messages in same conversation
        const response = await axios.get(
          `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${threadId}'`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

        const messages: EmailMessage[] = []
        for (const msg of response.data.value || []) {
          messages.push({
            id: msg.id,
            from: msg.from?.emailAddress?.name 
              ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` 
              : msg.from?.emailAddress?.address || 'Unknown',
            to: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || 'Unknown',
            subject: msg.subject || 'No Subject',
            body: msg.body?.content || msg.bodyPreview || '',
            receivedAt: new Date(msg.receivedDateTime || Date.now()).toISOString()
          })
        }

        thread = {
          threadId,
          messages
        }
      }

      // Hook: extract and store session facts from thread
      try {
        await extractAndStoreSessionFacts(
          `outlook-thread-${threadId}`,
          userId,
          {
            prompt: 'Extract contact details and company affiliations from the email thread conversation.',
            output: JSON.stringify(thread.messages),
            workflow_name: 'Outlook Thread Read'
          }
        )
      } catch (memErr: any) {
        logger.warn(`[OutlookAgent] Fact extraction failed: ${memErr.message}`)
      }

      return thread
    } catch (err: any) {
      logger.error('[OutlookAgent] getThread failed:', err.message)
      throw err
    }
  }

  async draftReply(userId: string, threadId: string, body: string): Promise<string> {
    logger.info(`[OutlookAgent] draftReply called for thread ID ${threadId}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) {
        return `mock-outlook-draft-${Date.now()}`
      }

      // Get the last message ID of the thread to reply to
      const threadRes = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${threadId}'&$orderby=receivedDateTime desc&$top=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      const lastMessage = threadRes.data.value?.[0]
      if (!lastMessage) throw new Error(`No messages found in thread ${threadId}`)

      // Create reply draft
      const draftRes = await axios.post(
        `https://graph.microsoft.com/v1.0/me/messages/${lastMessage.id}/createReply`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      // The createReply endpoint returns the draft message. We update its body content.
      const draftId = draftRes.data.id
      await axios.patch(
        `https://graph.microsoft.com/v1.0/me/messages/${draftId}`,
        {
          body: {
            contentType: 'HTML',
            content: body
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return draftId
    } catch (err: any) {
      logger.error('[OutlookAgent] draftReply failed:', err.message)
      throw err
    }
  }

  async sendEmail(
    userId: string,
    params: { to: string; subject: string; body: string; replyToThreadId?: string }
  ): Promise<{ messageId: string; threadId: string }> {
    logger.info(`[OutlookAgent] sendEmail called for recipient: ${params.to}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) {
        logger.info(`[OutlookAgent] Mock sending Outlook email to ${params.to}`)
        return { messageId: `mock-outlook-msg-${Date.now()}`, threadId: params.replyToThreadId || `mock-outlook-thread-${Date.now()}` }
      }

      const requestBody: any = {
        message: {
          subject: params.subject,
          body: {
            contentType: 'HTML',
            content: params.body
          },
          toRecipients: [
            {
              emailAddress: {
                address: params.to
              }
            }
          ]
        }
      }

      if (params.replyToThreadId) {
        requestBody.message.conversationId = params.replyToThreadId
      }

      const res = await axios.post(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return {
        messageId: res.headers['client-request-id'] || `outlook-msg-${Date.now()}`,
        threadId: params.replyToThreadId || `outlook-thread-${Date.now()}`
      }
    } catch (err: any) {
      logger.error('[OutlookAgent] sendEmail failed:', err.message)
      throw err
    }
  }

  async getRecentSentStyle(userId: string, count = 5): Promise<StyleProfile> {
    logger.info(`[OutlookAgent] getRecentSentStyle called for user ${userId}`)
    try {
      const token = await this.getAccessToken(userId)
      if (!token) {
        return {
          tone: 'professional',
          avgLength: 85,
          greetingPattern: 'Hi [Name],',
          signOffPattern: 'Best regards,\n[My Name]'
        }
      }

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=${count}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      const messages = response.data.value || []
      const bodyTexts: string[] = []

      for (const msg of messages) {
        const body = msg.body?.content || msg.bodyPreview || ''
        if (body.trim()) {
          bodyTexts.push(body.trim())
        }
      }

      if (bodyTexts.length === 0) {
        return {
          tone: 'neutral',
          avgLength: 60,
          greetingPattern: 'Hello,',
          signOffPattern: 'Thanks,'
        }
      }

      // Run LLM style analysis on the gathered emails
      const analysisPrompt = `You are an Email Style Profile Analyzer.
Analyze these sent email bodies and extract the user's typical writing style.
Provide the response as a single valid JSON object containing:
- "tone": string (e.g. casual, formal, concise, warm)
- "avgLength": number (average word count)
- "greetingPattern": string (how they open, e.g. "Hi [Name],", "Hello [Name],")
- "signOffPattern": string (how they close, e.g. "Best,", "Thanks,\n[Name]")

Email samples:
${bodyTexts.map((text, idx) => `Sample ${idx + 1}:\n${text.slice(0, 800)}`).join('\n\n')}

Return ONLY JSON.`

      const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
      const { content } = await callLLM(modelToUse, analysisPrompt, 'Analyze style profile.', 500)
      const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      
      return {
        tone: parsed.tone || 'professional',
        avgLength: parsed.avgLength || 80,
        greetingPattern: parsed.greetingPattern || 'Hi [Name],',
        signOffPattern: parsed.signOffPattern || 'Best,\n[Name]'
      }

    } catch (err: any) {
      logger.warn('[OutlookAgent] getRecentSentStyle failed, using fallback:', err.message)
      return {
        tone: 'professional',
        avgLength: 70,
        greetingPattern: 'Hi [Name],',
        signOffPattern: 'Best regards,'
      }
    }
  }

  async triageInbox(userId: string, emails: EmailSummary[]): Promise<TriageBriefing> {
    logger.info(`[OutlookAgent] triageInbox triggered for user ${userId} with ${emails.length} emails`)
    
    const prompt = `You are an Email Triage Assistant.
Analyze the following list of unread emails and categorize each into one of these 4 groups:
1. Urgent: Extremely time-sensitive, requires immediate attention.
2. Awaiting reply: Direct questions or tasks sent to the user that need a response, but not necessarily instant.
3. FYI: Informational updates, reports, notifications that the user should be aware of but require no action.
4. Newsletters: Marketing, digests, newsletters, or automated cold emails.

Also, write a structured, clear briefing summarizing the overall inbox state. Do NOT use any banned words (agent, pipeline, workflow, LLM, token, orchestrate, etc.).

Email list:
${emails.map((e, idx) => `[${idx}] From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`).join('\n')}

Format the output strictly as a JSON object:
{
  "briefing": "A concise paragraph summarizing the key points of the unread messages.",
  "categorization": [
    { "index": number, "category": "urgent" | "awaiting_reply" | "fyi" | "newsletters" }
  ]
}`

    try {
      const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
      const { content } = await callLLM(modelToUse, prompt, 'Triage these emails', 1500)
      const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      
      const groups = {
        urgent: [] as EmailSummary[],
        awaiting_reply: [] as EmailSummary[],
        fyi: [] as EmailSummary[],
        newsletters: [] as EmailSummary[]
      }
      
      if (Array.isArray(parsed.categorization)) {
        for (const item of parsed.categorization) {
          const email = emails[item.index]
          if (email) {
            if (item.category === 'urgent') groups.urgent.push(email)
            else if (item.category === 'awaiting_reply') groups.awaiting_reply.push(email)
            else if (item.category === 'fyi') groups.fyi.push(email)
            else groups.newsletters.push(email)
          }
        }
      }
      
      emails.forEach((email, idx) => {
        const alreadyCategorized = parsed.categorization?.some((c: any) => c.index === idx)
        if (!alreadyCategorized) {
          groups.fyi.push(email)
        }
      })
      
      return {
        triaged: true,
        briefing: parsed.briefing || 'You have several unread messages across various categories.',
        groups
      }
    } catch (err: any) {
      logger.warn(`[OutlookAgent] triageInbox LLM failed: ${err.message}`)
      const groups = {
        urgent: [] as EmailSummary[],
        awaiting_reply: [] as EmailSummary[],
        fyi: [] as EmailSummary[],
        newsletters: [] as EmailSummary[]
      }
      
      for (const email of emails) {
        const sub = email.subject.toLowerCase()
        const from = email.from.toLowerCase()
        if (email.isImportant || sub.includes('urgent') || sub.includes('asap') || sub.includes('blocker')) {
          groups.urgent.push(email)
        } else if (sub.includes('newsletter') || sub.includes('digest') || from.includes('newsletter')) {
          groups.newsletters.push(email)
        } else if (sub.includes('review') || sub.includes('question') || sub.includes('contract')) {
          groups.awaiting_reply.push(email)
        } else {
          groups.fyi.push(email)
        }
      }
      
      return {
        triaged: true,
        briefing: `You have ${emails.length} unread messages. ${groups.urgent.length} are marked urgent, ${groups.awaiting_reply.length} need replies, and ${groups.fyi.length} are informational.`,
        groups
      }
    }
  }
}

export const outlookAgent = new OutlookAgent()
