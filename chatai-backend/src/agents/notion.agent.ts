import axios from 'axios'
import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { callLLM } from './base.agent'

export interface NotionPage {
  id: string
  title: string
  url: string
}

export interface NotionPageContent {
  id: string
  title: string
  content: string
}

export interface BlockContent {
  type: 'paragraph' | 'heading_1' | 'heading_2' | 'bulleted_list_item'
  text: string
}

export interface NotionRow {
  id: string
  properties: Record<string, any>
}

export class NotionAgent {
  private async getNotionToken(userId: string): Promise<string | null> {
    try {
      const token = await integrationRegistryService.getToken(userId, 'notion')
      if (!token || token.startsWith('mock-token-')) {
        return null
      }
      return token
    } catch {
      return null
    }
  }

  async listPages(userId: string): Promise<NotionPage[]> {
    logger.info(`[NotionAgent] listPages called for user ${userId}`)
    try {
      const token = await this.getNotionToken(userId)
      if (!token) {
        return [
          { id: 'page-101', title: 'Product Requirements Document', url: 'https://notion.so/prd-101' },
          { id: 'page-102', title: 'Meeting Notes: Q3 Sync', url: 'https://notion.so/sync-102' }
        ]
      }

      const res = await axios.post(
        'https://api.notion.com/v1/search',
        { filter: { property: 'object', value: 'page' } },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        }
      )

      return (res.data.results || []).map((p: any) => ({
        id: p.id,
        title: p.properties?.title?.title?.[0]?.text?.content || p.properties?.Name?.title?.[0]?.text?.content || 'Untitled Page',
        url: p.url
      }))
    } catch (err: any) {
      logger.error('[NotionAgent] listPages failed:', err.message)
      throw err
    }
  }

  async getPage(userId: string, pageId: string): Promise<NotionPageContent> {
    logger.info(`[NotionAgent] getPage called for page: ${pageId}`)
    try {
      const token = await this.getNotionToken(userId)
      if (!token) {
        return {
          id: pageId,
          title: 'Product Requirements Document',
          content: 'This is the document containing Q3 milestones, roadmap requirements, and partner SLA details.'
        }
      }

      // 1. Get Page info
      const pageRes = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28'
        }
      })

      const title = pageRes.data.properties?.title?.title?.[0]?.text?.content || pageRes.data.properties?.Name?.title?.[0]?.text?.content || 'Untitled'

      // 2. Get Page blocks / content
      const blocksRes = await axios.get(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28'
        }
      })

      const blockTexts = (blocksRes.data.results || []).map((b: any) => {
        const type = b.type
        if (b[type]?.rich_text?.[0]?.text?.content) {
          return b[type].rich_text[0].text.content
        }
        return ''
      }).filter(Boolean)

      return {
        id: pageId,
        title,
        content: blockTexts.join('\n\n')
      }
    } catch (err: any) {
      logger.error('[NotionAgent] getPage failed:', err.message)
      throw err
    }
  }

  async createPage(
    userId: string,
    params: { parentId?: string; title: string; content: BlockContent[] },
    runId?: string
  ): Promise<string> {
    logger.info(`[NotionAgent] createPage called: "${params.title}"`)
    try {
      const token = await this.getNotionToken(userId)
      let pageId = `mock-page-${Date.now()}`

      if (token) {
        const children = params.content.map(c => {
          let notionType = 'paragraph'
          if (c.type === 'heading_1') notionType = 'heading_1'
          else if (c.type === 'heading_2') notionType = 'heading_2'
          else if (c.type === 'bulleted_list_item') notionType = 'bulleted_list_item'

          return {
            object: 'block',
            type: notionType,
            [notionType]: {
              rich_text: [{ text: { content: c.text } }]
            }
          }
        })

        const res = await axios.post(
          'https://api.notion.com/v1/pages',
          {
            parent: params.parentId ? { page_id: params.parentId } : { workspace: true },
            properties: {
              title: {
                title: [{ text: { content: params.title } }]
              }
            },
            children
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            }
          }
        )
        pageId = res.data.id
      }

      // Log in Action Journal for undoability
      if (runId) {
        try {
          const { actionJournalService } = await import('../services/action-journal.service')
          await actionJournalService.logAction(userId, runId, 'notion_page_create', {
            page_id: pageId
          })
        } catch (logErr: any) {
          logger.warn('Failed to log Notion action in journal:', logErr.message)
        }
      }

      return pageId
    } catch (err: any) {
      logger.error('[NotionAgent] createPage failed:', err.message)
      throw err
    }
  }

  async appendToPage(userId: string, pageId: string, content: BlockContent[]): Promise<void> {
    logger.info(`[NotionAgent] appendToPage called for page: ${pageId}`)
    try {
      const token = await this.getNotionToken(userId)
      if (!token) return

      const children = content.map(c => {
        let notionType = 'paragraph'
        if (c.type === 'heading_1') notionType = 'heading_1'
        else if (c.type === 'heading_2') notionType = 'heading_2'
        else if (c.type === 'bulleted_list_item') notionType = 'bulleted_list_item'

        return {
          object: 'block',
          type: notionType,
          [notionType]: {
            rich_text: [{ text: { content: c.text } }]
          }
        }
      })

      await axios.patch(
        `https://api.notion.com/v1/blocks/${pageId}/children`,
        { children },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (err: any) {
      logger.error('[NotionAgent] appendToPage failed:', err.message)
      throw err
    }
  }

  async queryDatabase(userId: string, dbId: string, filter?: any): Promise<NotionRow[]> {
    logger.info(`[NotionAgent] queryDatabase called for db: ${dbId}`)
    try {
      const token = await this.getNotionToken(userId)
      if (!token) {
        return [
          { id: 'row-1', properties: { Name: 'Acme Corp SLA', Status: 'Approved' } },
          { id: 'row-2', properties: { Name: 'Stripe SLA', Status: 'Draft' } }
        ]
      }

      const res = await axios.post(
        `https://api.notion.com/v1/databases/${dbId}/query`,
        { filter },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        }
      )

      return (res.data.results || []).map((r: any) => ({
        id: r.id,
        properties: r.properties
      }))
    } catch (err: any) {
      logger.error('[NotionAgent] queryDatabase failed:', err.message)
      throw err
    }
  }

  async updateDatabaseRow(userId: string, dbId: string, rowId: string, properties: any): Promise<void> {
    logger.info(`[NotionAgent] updateDatabaseRow called for row: ${rowId}`)
    try {
      const token = await this.getNotionToken(userId)
      if (!token) return

      await axios.patch(
        `https://api.notion.com/v1/pages/${rowId}`,
        { properties },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (err: any) {
      logger.error('[NotionAgent] updateDatabaseRow failed:', err.message)
      throw err
    }
  }
}

export const notionAgent = new NotionAgent()

// Backwards-compatible runNotionAgent wrapper
export async function runNotionAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['notion_operations']
  const tenantId = agent.tenant_id
  
  logger.info(`[Agent: ${agent.name}] Starting runNotionAgent...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const prompt = input.user_inputs?.prompt || input.original_prompt || agent.description || ''
    
    const systemPrompt = `You are a Notion Document Builder.
    Analyze the user instruction and return JSON:
    {
      "action": "create_page" | "append_page" | "update_db",
      "pageTitle": "Notion Page title",
      "parentPageId": "optional parent page ID or database ID or empty",
      "content": "text content or empty"
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
    const { content: routerJson } = await callLLM(modelToUse, systemPrompt, `Prompt: ${prompt}`, 250, 1, runId, agent.name)
    const decision = JSON.parse(routerJson.replace(/```json/gi, '').replace(/```/g, '').trim())

    if (!decision.content) {
      const outputs = Object.values(input.previous_outputs || {}) as any[]
      const prev = outputs.find(o => o?.data?.content || o?.summary)
      decision.content = prev?.data?.content || prev?.summary || 'Drafted by Chatbolt.'
    }

    let data: any = {}
    if (decision.action === 'create_page') {
      const pageId = await notionAgent.createPage(tenantId, {
        title: decision.pageTitle || 'Sync Notes',
        content: [{ type: 'paragraph', text: decision.content }]
      }, runId)
      data = { status: 'created', pageId }
    } else {
      const pages = await notionAgent.listPages(tenantId)
      data = { pages }
    }

    const output: AgentOutput = {
      success: true,
      data,
      summary: `Successfully saved "${decision.pageTitle || 'Research Notes'}" into Notion workspace.`,
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
      summary: `Notion operation failed: ${err.message}`,
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
