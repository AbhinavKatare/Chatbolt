import { integrationRegistryService } from '../services/integration-registry.service'
import { logger } from '../services/logger.service'

interface AgentContext {
  task: string
  inputs?: Record<string, any>
  tenantId: string
}

interface AgentResult {
  output: string
  status: 'success' | 'error'
  metadata?: Record<string, any>
}

/**
 * HubSpotAgent — contacts, deals, companies, tasks, and history via HubSpot v3 REST API
 */
export class HubSpotAgent {
  name = 'HubSpot Agent'
  description = 'Manage contacts, deals, companies, and tasks in HubSpot CRM'
  category = 'crm'

  private async hsGet(token: string, path: string, params?: Record<string, string>): Promise<any> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await fetch(`https://api.hubapi.com${path}${qs}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    if (!res.ok) throw new Error(`HubSpot API error: ${res.status}`)
    return res.json()
  }

  private async hsPost(token: string, path: string, body: any): Promise<any> {
    const res = await fetch(`https://api.hubapi.com${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HubSpot API error: ${res.status}`)
    }
    return res.json()
  }

  private async hsPatch(token: string, path: string, body: any): Promise<any> {
    const res = await fetch(`https://api.hubapi.com${path}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HubSpot API error: ${res.status}`)
    }
    return res.json()
  }

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { task, inputs, tenantId } = ctx
    const token = inputs?.hubspot_token || await integrationRegistryService.getToken(tenantId, 'hubspot')

    if (!token) {
      return {
        output: 'HubSpot is not connected. Please connect your HubSpot account in Connections.',
        status: 'success',
      }
    }

    const t = task.toLowerCase()

    try {
      // ── Update Deal Stage (PermissionCard) ──────────────────────────────
      if (t.includes('deal stage') || t.includes('update deal') || t.includes('transition deal')) {
        const dealId = inputs?.dealId || task.match(/(?:deal|id)[:\s]+["']?(\d+)/i)?.[1]
        const stage = inputs?.stage || task.match(/(?:stage|to)[:\s]+["']?([a-zA-Z0-9_\-]+)/i)?.[1]
        if (!dealId || !stage) return { output: 'Please specify both the deal ID and target stage.', status: 'success' }

        const updated = await this.updateDealStage(token, dealId, stage)
        return {
          output: `✅ Deal stage updated successfully!\nDeal ID: ${dealId}\nNew Stage: ${updated.properties?.dealstage}`,
          status: 'success',
          metadata: { deal_id: dealId, stage }
        }
      }

      // ── Create Task (PermissionCard) ────────────────────────────────────
      if (t.includes('create task') || t.includes('add task') || t.includes('new task')) {
        const subject = inputs?.subject || task.match(/(?:subject|title|task)[:\s]+["']?([^"'\n]+)/i)?.[1] || 'Follow up with lead'
        const body = inputs?.body || task.match(/(?:body|note|desc)[:\s]+["']?([^"'\n]+)/i)?.[1] || 'Created from Chatbolt'
        const status = inputs?.status || 'NOT_STARTED'

        const taskObj = await this.createTask(token, subject, body, status)
        return {
          output: `✅ HubSpot task created!\nSubject: ${taskObj.properties?.hs_task_subject}\nStatus: ${taskObj.properties?.hs_task_status}\nID: ${taskObj.id}`,
          status: 'success',
          metadata: { task_id: taskObj.id }
        }
      }

      // ── Get Contact History ─────────────────────────────────────────────
      if (t.includes('contact history') || t.includes('contact activity') || t.includes('contact details')) {
        const contactId = inputs?.contactId || task.match(/(?:contact|id)[:\s]+["']?(\d+)/i)?.[1]
        if (!contactId) return { output: 'Please specify the HubSpot contact ID.', status: 'success' }

        const history = await this.getContactHistory(token, contactId)
        const p = history.properties
        return {
          output: `**HubSpot Contact History: ${p.firstname || ''} ${p.lastname || ''}**\nEmail: ${p.email || 'N/A'}\nLifecycle Stage: ${p.lifecyclestage || 'N/A'}\nCreated: ${new Date(p.createdate).toLocaleString()}\nLast Modified: ${new Date(p.lastmodifieddate).toLocaleString()}`,
          status: 'success',
          metadata: { contact_id: contactId }
        }
      }

      // ── Get Recent Activity ─────────────────────────────────────────────
      if (t.includes('recent activity') || t.includes('crm history') || t.includes('audit crm')) {
        const activity = await this.getRecentActivity(token)
        return {
          output: activity,
          status: 'success'
        }
      }

      // ── List Contacts ─────────────────────────────────────────────────────
      if (t.includes('contact') && (t.includes('list') || t.includes('show') || t.includes('recent'))) {
        const data = await this.hsGet(token, '/crm/v3/objects/contacts', {
          limit: '20',
          properties: 'firstname,lastname,email,phone,company,lifecyclestage,hs_lead_status',
          sort: '-createdate',
        })

        const contacts = data.results || []
        if (!contacts.length) return { output: 'No contacts found in your HubSpot CRM.', status: 'success' }

        const lines = contacts.slice(0, 12).map((c: any) => {
          const p = c.properties
          const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown'
          const stage = p.lifecyclestage || 'unknown'
          return `• **${name}** — ${p.email || 'no email'} | ${p.company || ''} | Stage: ${stage}`
        })

        return {
          output: `**HubSpot Contacts (${contacts.length} shown)**\n\n${lines.join('\n')}`,
          status: 'success',
          metadata: { contact_count: contacts.length },
        }
      }

      // ── Create Contact ────────────────────────────────────────────────────
      if (t.includes('create contact') || t.includes('add contact') || t.includes('new contact')) {
        const emailMatch = task.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
        const email = emailMatch?.[1] || inputs?.email
        const firstName = inputs?.firstname || inputs?.first_name || ''
        const lastName = inputs?.lastname || inputs?.last_name || ''
        const company = inputs?.company || ''

        if (!email) return { output: 'Please provide an email address to create a contact.', status: 'success' }

        const contact = await this.hsPost(token, '/crm/v3/objects/contacts', {
          properties: { email, firstname: firstName, lastname: lastName, company },
        })

        return {
          output: `✅ Contact created!\n\n**${[firstName, lastName].filter(Boolean).join(' ') || email}**\nEmail: ${email}${company ? `\nCompany: ${company}` : ''}\nID: ${contact.id}`,
          status: 'success',
          metadata: { contact_id: contact.id },
        }
      }

      // ── List Deals ────────────────────────────────────────────────────────
      if (t.includes('deal') && (t.includes('list') || t.includes('show') || t.includes('open') || t.includes('pipeline'))) {
        const data = await this.hsGet(token, '/crm/v3/objects/deals', {
          limit: '20',
          properties: 'dealname,amount,dealstage,closedate,hubspot_owner_id',
          sort: '-amount',
        })

        const deals = data.results || []
        if (!deals.length) return { output: 'No deals found in your HubSpot pipeline.', status: 'success' }

        const totalValue = deals.reduce((s: number, d: any) => s + parseFloat(d.properties.amount || '0'), 0)
        const lines = deals.slice(0, 10).map((d: any) => {
          const p = d.properties
          const amount = p.amount ? `$${Number(p.amount).toLocaleString()}` : 'No value'
          const close = p.closedate ? new Date(p.closedate).toLocaleDateString() : 'No date'
          return `• **${p.dealname}** — ${amount} | Stage: ${p.dealstage || 'unknown'} | Close: ${close}`
        })

        return {
          output: `**HubSpot Deals (${deals.length} open)**\nTotal pipeline value: **$${totalValue.toLocaleString()}**\n\n${lines.join('\n')}`,
          status: 'success',
          metadata: { deal_count: deals.length, total_value: totalValue },
        }
      }

      // ── Create Deal ───────────────────────────────────────────────────────
      if (t.includes('create deal') || t.includes('new deal') || t.includes('add deal')) {
        const dealName = inputs?.dealname || inputs?.name || task.replace(/create deal/i, '').trim()
        const amount = inputs?.amount || '0'

        const deal = await this.hsPost(token, '/crm/v3/objects/deals', {
          properties: {
            dealname: dealName,
            amount: amount,
            dealstage: 'appointmentscheduled',
            closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          },
        })

        return {
          output: `✅ Deal created!\n\n**${dealName}**\nValue: $${Number(amount).toLocaleString()}\nStage: Appointment Scheduled\nID: ${deal.id}`,
          status: 'success',
          metadata: { deal_id: deal.id },
        }
      }

      // ── Search Contact ────────────────────────────────────────────────────
      if (t.includes('find') || t.includes('search') || t.includes('look up')) {
        const searchTerm = inputs?.query || task.replace(/find|search|look up/gi, '').trim()
        const data = await this.hsPost(token, '/crm/v3/objects/contacts/search', {
          filterGroups: [{
            filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: searchTerm }]
          }],
          properties: ['firstname', 'lastname', 'email', 'company', 'phone', 'lifecyclestage'],
          limit: 5,
        }).catch(async () => {
          return this.hsPost(token, '/crm/v3/objects/contacts/search', {
            query: searchTerm,
            properties: ['firstname', 'lastname', 'email', 'company'],
            limit: 5,
          })
        })

        const contacts = data.results || []
        if (!contacts.length) return { output: `No contacts found matching "${searchTerm}".`, status: 'success' }

        const lines = contacts.map((c: any) => {
          const p = c.properties
          const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown'
          return `• **${name}**\n  Email: ${p.email || 'N/A'} | Company: ${p.company || 'N/A'} | Stage: ${p.lifecyclestage || 'N/A'}`
        })

        return {
          output: `**Search Results for "${searchTerm}" (${contacts.length})**\n\n${lines.join('\n\n')}`,
          status: 'success',
        }
      }

      // ── CRM Summary ───────────────────────────────────────────────────────
      const [contactData, dealData] = await Promise.all([
        this.hsGet(token, '/crm/v3/objects/contacts', { limit: '5', sort: '-createdate', properties: 'firstname,lastname,email,lifecyclestage' }),
        this.hsGet(token, '/crm/v3/objects/deals', { limit: '5', sort: '-amount', properties: 'dealname,amount,dealstage' }),
      ])

      const contacts = contactData.results || []
      const deals = dealData.results || []
      const totalDealValue = deals.reduce((s: number, d: any) => s + parseFloat(d.properties.amount || '0'), 0)

      return {
        output: `**HubSpot CRM Overview**
 
📋 **Recent Contacts:**
${contacts.map((c: any) => `• ${[c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || c.properties.email}`).join('\n') || 'None'}
 
💰 **Open Deals:**
${deals.map((d: any) => `• ${d.properties.dealname} — $${Number(d.properties.amount || 0).toLocaleString()}`).join('\n') || 'None'}
Total Pipeline: **$${totalDealValue.toLocaleString()}**`,
        status: 'success',
        metadata: { contact_count: contacts.length, deal_count: deals.length, pipeline_value: totalDealValue },
      }
    } catch (err: any) {
      logger.error(`[HubSpotAgent] operation failed:`, err.message)
      return { output: `HubSpot error: ${err.message}`, status: 'error' }
    }
  }

  async updateDealStage(token: string, id: string, stage: string): Promise<any> {
    return this.hsPatch(token, `/crm/v3/objects/deals/${id}`, {
      properties: { dealstage: stage }
    })
  }

  async getContactHistory(token: string, id: string): Promise<any> {
    return this.hsGet(token, `/crm/v3/objects/contacts/${id}`, {
      properties: 'firstname,lastname,email,lifecyclestage,createdate,lastmodifieddate'
    })
  }

  async createTask(token: string, subject: string, body: string, status = 'NOT_STARTED'): Promise<any> {
    return this.hsPost(token, '/crm/v3/objects/tasks', {
      properties: {
        hs_task_subject: subject,
        hs_task_body: body,
        hs_task_status: status
      }
    })
  }

  async getRecentActivity(token: string): Promise<string> {
    try {
      const [contactData, dealData] = await Promise.all([
        this.hsGet(token, '/crm/v3/objects/contacts', { limit: '10', sort: '-lastmodifieddate', properties: 'firstname,lastname,email,lifecyclestage' }),
        this.hsGet(token, '/crm/v3/objects/deals', { limit: '10', sort: '-lastmodifieddate', properties: 'dealname,amount,dealstage' })
      ])

      const contacts = contactData.results || []
      const deals = dealData.results || []

      const cLines = contacts.map((c: any) => `• Contact: ${c.properties.firstname || ''} ${c.properties.lastname || ''} (${c.properties.email}) modified.`)
      const dLines = deals.map((d: any) => `• Deal: ${d.properties.dealname} ($${Number(d.properties.amount || 0).toLocaleString()}) modified.`)

      return `**Recent HubSpot Activity**\n\n${[...cLines, ...dLines].slice(0, 10).join('\n') || 'No recent modifications.'}`
    } catch (err: any) {
      return `Failed to fetch activity: ${err.message}`
    }
  }
}

export const hubspotAgent = new HubSpotAgent()
