import { google } from 'googleapis'
import { integrationRegistryService } from '../services/integration-registry.service'
import { extractAndStoreSessionFacts } from '../services/memory.service'
import { callLLM } from './base.agent'
import { logger } from '../services/logger.service'

export interface EmailSummary {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  receivedAt: string
  isImportant: boolean
}

export interface TriageBriefing {
  triaged: boolean
  briefing: string
  groups: {
    urgent: EmailSummary[]
    awaiting_reply: EmailSummary[]
    fyi: EmailSummary[]
    newsletters: EmailSummary[]
  }
}

export interface EmailMessage {
  id: string
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string
}

export interface EmailThread {
  threadId: string
  messages: EmailMessage[]
}

export interface StyleProfile {
  tone: string
  avgLength: number
  greetingPattern: string
  signOffPattern: string
}

export class GmailAgent {
  private async getGmailClient(userId: string) {
    const token = await integrationRegistryService.getToken(userId, 'gmail')
    if (!token || token.startsWith('mock-token-')) {
      return null
    }
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: token })
    return google.gmail({ version: 'v1', auth: oauth2Client })
  }

  async listUnread(userId: string, limit = 20): Promise<EmailSummary[] | TriageBriefing> {
    logger.info(`[GmailAgent] listUnread called for user ${userId}`)
    try {
      const gmail = await this.getGmailClient(userId)
      let emails: EmailSummary[] = []

      if (!gmail) {
        // Mock emails reflecting realistic business cases
        if (limit > 10) {
          emails = Array.from({ length: 12 }, (_, i) => ({
            id: `msg-${100 + i}`,
            threadId: `thread-${100 + i}`,
            from: i % 4 === 0 
              ? 'David Miller <david.miller@acme.com>' 
              : i % 4 === 1 
                ? 'Sarah Jenkins <sjenkins@acmepartner.com>' 
                : i % 4 === 2 
                  ? 'Newsletter <info@techradar.com>' 
                  : 'Stripe Billing <invoice@stripe.com>',
            subject: i % 3 === 0 
              ? 'Urgent update needed: Q3 Milestones' 
              : i % 3 === 1 
                ? 'Contract review for partner sync' 
                : 'Weekly developer platform newsletter',
            snippet: `This is email body snippet number ${i}. Please check the attached files and reply back.`,
            receivedAt: new Date(Date.now() - i * 3600000).toISOString(),
            isImportant: i % 3 === 0
          }))
        } else {
          emails = [
            {
              id: 'msg-101',
              threadId: 'thread-101',
              from: 'David Miller <david.miller@acme.com>',
              subject: 'Review needed: Project Q3 Roadmap',
              snippet: 'Hi, please take a look at the proposed timeline for Q3 and let me know if we need to adjust the milestones.',
              receivedAt: new Date(Date.now() - 3600000).toISOString(), // 1h ago
              isImportant: true
            },
            {
              id: 'msg-102',
              threadId: 'thread-102',
              from: 'Sarah Jenkins <sjenkins@acmepartner.com>',
              subject: 'Acme Corp Contract update',
              snippet: 'Hi, I received the revised agreement. We have one question regarding the SLA terms on page 4.',
              receivedAt: new Date(Date.now() - 7200000).toISOString(), // 2h ago
              isImportant: true
            },
            {
              id: 'msg-103',
              threadId: 'thread-103',
              from: 'Newsletter <info@techradar.com>',
              subject: 'Top Tech Trends for 2026',
              snippet: 'Discover the latest developments in automation, cloud architectures, and developer productivity tools.',
              receivedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
              isImportant: false
            }
          ]
        }
      } else {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: 'is:unread',
          maxResults: limit
        })

        const messages = response.data.messages || []
        for (const msg of messages) {
          const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
          const headers = detail.data.payload?.headers || []
          const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'Unknown'
          const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || 'No Subject'
          const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString()
          const labelIds = detail.data.labelIds || []
          const isImportant = labelIds.includes('IMPORTANT')

          emails.push({
            id: msg.id!,
            threadId: msg.threadId!,
            from,
            subject,
            snippet: detail.data.snippet || '',
            receivedAt: new Date(date).toISOString(),
            isImportant
          })
        }
      }

      // Hook: extract and store session facts from unread emails
      try {
        await extractAndStoreSessionFacts(
          `gmail-list-${Date.now()}`,
          userId,
          {
            prompt: 'Extract contact details, people names, and relationship status from unread emails.',
            output: JSON.stringify(emails.slice(0, 3)),
            workflow_name: 'Gmail Inbox Read'
          }
        )
      } catch (memErr: any) {
        logger.warn(`[GmailAgent] Fact extraction failed: ${memErr.message}`)
      }

      if (emails.length > 10) {
        logger.info(`[GmailAgent] Inbox unread emails (${emails.length}) > 10. Activating inbox triage...`)
        return await this.triageInbox(userId, emails)
      }

      return emails
    } catch (err: any) {
      logger.error('[GmailAgent] listUnread failed:', err.message)
      throw err
    }
  }

  async searchThreads(userId: string, queryText: string): Promise<EmailSummary[]> {
    logger.info(`[GmailAgent] searchThreads called for query: "${queryText}"`)
    try {
      const gmail = await this.getGmailClient(userId)
      if (!gmail) {
        // Return mock search results
        return [
          {
            id: 'msg-101',
            threadId: 'thread-101',
            from: 'David Miller <david.miller@acme.com>',
            subject: 'Review needed: Project Q3 Roadmap',
            snippet: 'Hi, please take a look at the proposed timeline for Q3 and let me know if we need to adjust the milestones.',
            receivedAt: new Date(Date.now() - 3600000).toISOString(),
            isImportant: true
          }
        ]
      }

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: queryText,
        maxResults: 10
      })

      const emails: EmailSummary[] = []
      const messages = response.data.messages || []
      for (const msg of messages) {
        const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
        const headers = detail.data.payload?.headers || []
        const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'Unknown'
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || 'No Subject'
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString()
        const labelIds = detail.data.labelIds || []
        const isImportant = labelIds.includes('IMPORTANT')

        emails.push({
          id: msg.id!,
          threadId: msg.threadId!,
          from,
          subject,
          snippet: detail.data.snippet || '',
          receivedAt: new Date(date).toISOString(),
          isImportant
        })
      }
      return emails
    } catch (err: any) {
      logger.error('[GmailAgent] searchThreads failed:', err.message)
      throw err
    }
  }

  async getThread(userId: string, threadId: string): Promise<EmailThread> {
    logger.info(`[GmailAgent] getThread called for thread ID ${threadId}`)
    try {
      const gmail = await this.getGmailClient(userId)
      let thread: EmailThread

      if (!gmail) {
        thread = {
          threadId,
          messages: [
            {
              id: 'msg-101',
              from: 'David Miller <david.miller@acme.com>',
              to: 'me@chatbolt.io',
              subject: 'Review needed: Project Q3 Roadmap',
              body: 'Hi team,\n\nI have drafted the Project Q3 Roadmap document. Please review the timelines and tell me if you have any questions.\n\nThanks,\nDavid',
              receivedAt: new Date(Date.now() - 3600000).toISOString()
            }
          ]
        }
      } else {
        const response = await gmail.users.threads.get({
          userId: 'me',
          id: threadId
        })

        const messages: EmailMessage[] = []
        for (const msg of response.data.messages || []) {
          const headers = msg.payload?.headers || []
          const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'Unknown'
          const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || 'Unknown'
          const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || 'No Subject'
          const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString()
          
          let body = msg.snippet || ''
          const parts = msg.payload?.parts || []
          const bodyPart = parts.find(p => p.mimeType === 'text/plain') || parts.find(p => p.mimeType === 'text/html')
          if (bodyPart && bodyPart.body?.data) {
            body = Buffer.from(bodyPart.body.data, 'base64').toString('utf8')
          } else if (msg.payload?.body?.data) {
            body = Buffer.from(msg.payload.body.data, 'base64').toString('utf8')
          }

          messages.push({
            id: msg.id!,
            from,
            to,
            subject,
            body,
            receivedAt: new Date(date).toISOString()
          })
        }

        thread = {
          threadId: response.data.id!,
          messages
        }
      }

      // Hook: extract and store session facts from thread
      try {
        await extractAndStoreSessionFacts(
          `gmail-thread-${threadId}`,
          userId,
          {
            prompt: 'Extract contact details and company affiliations from the email thread conversation.',
            output: JSON.stringify(thread.messages),
            workflow_name: 'Gmail Thread Read'
          }
        )
      } catch (memErr: any) {
        logger.warn(`[GmailAgent] Fact extraction failed: ${memErr.message}`)
      }

      return thread
    } catch (err: any) {
      logger.error('[GmailAgent] getThread failed:', err.message)
      throw err
    }
  }

  async draftReply(userId: string, threadId: string, body: string): Promise<string> {
    logger.info(`[GmailAgent] draftReply called for thread ID ${threadId}`)
    try {
      const gmail = await this.getGmailClient(userId)
      if (!gmail) {
        return `mock-draft-${Date.now()}`
      }

      // Fetch thread messages to determine Subject, To, and References/In-Reply-To headers
      const threadRes = await gmail.users.threads.get({ userId: 'me', id: threadId })
      const lastMessage = threadRes.data.messages?.pop()
      if (!lastMessage) throw new Error(`No messages found in thread ${threadId}`)

      const headers = lastMessage.payload?.headers || []
      const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value || ''
      const subjectHeader = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || 'Re: Reply'
      const messageIdHeader = headers.find(h => h.name?.toLowerCase() === 'message-id')?.value || ''

      const cleanSubject = subjectHeader.toLowerCase().startsWith('re:') ? subjectHeader : `Re: ${subjectHeader}`
      
      const emailLines = [
        `To: ${fromHeader}`,
        `Subject: ${cleanSubject}`,
        `In-Reply-To: ${messageIdHeader}`,
        `References: ${messageIdHeader}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        body
      ]

      const rawMsg = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const draftRes = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: rawMsg,
            threadId
          }
        }
      })

      return draftRes.data.id!
    } catch (err: any) {
      logger.error('[GmailAgent] draftReply failed:', err.message)
      throw err
    }
  }

  async sendEmail(
    userId: string,
    params: { to: string; subject: string; body: string; replyToThreadId?: string; attachmentPaths?: string[] }
  ): Promise<{ messageId: string; threadId: string }> {
    logger.info(`[GmailAgent] sendEmail called for recipient: ${params.to}`)
    try {
      const gmail = await this.getGmailClient(userId)
      if (!gmail) {
        logger.info(`[GmailAgent] Mock sending email to ${params.to}`)
        return { messageId: `mock-msg-${Date.now()}`, threadId: params.replyToThreadId || `mock-thread-${Date.now()}` }
      }

      const emailLines = [
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        'Content-Type: text/html; charset=utf-8',
        ''
      ]

      if (params.replyToThreadId) {
        // Fetch thread messages to get message-id header for proper thread threading
        const threadRes = await gmail.users.threads.get({ userId: 'me', id: params.replyToThreadId })
        const lastMessage = threadRes.data.messages?.pop()
        if (lastMessage) {
          const headers = lastMessage.payload?.headers || []
          const msgIdVal = headers.find(h => h.name?.toLowerCase() === 'message-id')?.value
          if (msgIdVal) {
            emailLines.splice(2, 0, `In-Reply-To: ${msgIdVal}`, `References: ${msgIdVal}`)
          }
        }
      }

      emailLines.push(params.body)
      const rawMsg = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMsg,
          threadId: params.replyToThreadId || undefined
        }
      })

      return {
        messageId: res.data.id || '',
        threadId: res.data.threadId || ''
      }
    } catch (err: any) {
      logger.error('[GmailAgent] sendEmail failed:', err.message)
      throw err
    }
  }

  async getRecentSentStyle(userId: string, count = 5): Promise<StyleProfile> {
    logger.info(`[GmailAgent] getRecentSentStyle called for user ${userId}`)
    try {
      const gmail = await this.getGmailClient(userId)
      if (!gmail) {
        return {
          tone: 'professional',
          avgLength: 85,
          greetingPattern: 'Hi [Name],',
          signOffPattern: 'Best regards,\n[My Name]'
        }
      }

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:sent',
        maxResults: count
      })

      const messages = response.data.messages || []
      const bodyTexts: string[] = []

      for (const msg of messages) {
        const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
        let body = ''
        const parts = detail.data.payload?.parts || []
        const bodyPart = parts.find(p => p.mimeType === 'text/plain')
        if (bodyPart && bodyPart.body?.data) {
          body = Buffer.from(bodyPart.body.data, 'base64').toString('utf8')
        } else if (detail.data.payload?.body?.data) {
          body = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf8')
        }
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
${bodyTexts.map((text, idx) => `Sample ${idx + 1}:\n${text}`).join('\n\n')}

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
      logger.warn('[GmailAgent] getRecentSentStyle failed, using fallback:', err.message)
      return {
        tone: 'professional',
        avgLength: 70,
        greetingPattern: 'Hi [Name],',
        signOffPattern: 'Best regards,'
      }
    }
  }

  async triageInbox(userId: string, emails: EmailSummary[]): Promise<TriageBriefing> {
    logger.info(`[GmailAgent] triageInbox triggered for user ${userId} with ${emails.length} emails`)
    
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
      
      // Handle any emails that were missed in categorization
      emails.forEach((email, idx) => {
        const alreadyCategorized = parsed.categorization?.some((c: any) => c.index === idx)
        if (!alreadyCategorized) {
          groups.fyi.push(email) // Fallback
        }
      })
      
      return {
        triaged: true,
        briefing: parsed.briefing || 'You have several unread messages across various categories.',
        groups
      }
    } catch (err: any) {
      logger.warn(`[GmailAgent] triageInbox LLM failed: ${err.message}`)
      // Fallback categorization by headers/keywords
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

export const gmailAgent = new GmailAgent()
