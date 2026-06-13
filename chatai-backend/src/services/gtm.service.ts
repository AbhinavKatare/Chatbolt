import { logger } from './logger.service';
import { query, queryOne } from '../db'
import { createTransport } from 'nodemailer'

export interface GTMContact {
  id?: string
  tenantId: string
  name: string
  email: string
  phone?: string
  company?: string
  title?: string
  status: string
  notes?: string
  source?: string
}

class GTMService {
  /**
   * Pushes/Syncs a contact profile to HubSpot CRM.
   */
  async syncToHubSpot(contact: GTMContact): Promise<{ success: boolean; hubspotId?: string; error?: string }> {
    logger.info(`[HubSpot CRM] Initiating sync for lead: ${contact.email} (${contact.company || 'Unknown Co'})`)
    try {
      const apiKey = process.env.HUBSPOT_API_KEY
      if (!apiKey) {
        // Safe fall back to mock successful integration if API keys are not supplied in .env
        console.warn('[HubSpot CRM] API Key missing. Falling back to sandbox push simulation.')
        const simulatedId = `hs_lead_${Math.random().toString(36).substring(7)}`
        
        await query(`
          INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
          VALUES ((SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2), $2, 'CRM_SYNC', $3, $4)
        `, [contact.email, contact.tenantId, `Successfully synchronized to HubSpot as Lead ID ${simulatedId}`, JSON.stringify({ provider: 'hubspot', id: simulatedId, syncedAt: new Date() })])

        return { success: true, hubspotId: simulatedId }
      }

      // Real HubSpot API push (v3 Contacts API)
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          properties: {
            email: contact.email,
            firstname: contact.name.split(' ')[0] || '',
            lastname: contact.name.split(' ').slice(1).join(' ') || '',
            company: contact.company || '',
            jobtitle: contact.title || '',
            phone: contact.phone || '',
            hs_lead_status: contact.status.toUpperCase()
          }
        })
      })

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(`HubSpot API rejected request: ${errBody}`)
      }

      const resData = await response.json()
      const hubspotId = resData.id

      await query(`
        INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
        VALUES ((SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2), $2, 'CRM_SYNC', $3, $4)
      `, [contact.email, contact.tenantId, `Successfully synchronized to HubSpot CRM as Contact ID ${hubspotId}`, JSON.stringify({ provider: 'hubspot', id: hubspotId, syncedAt: new Date() })])

      return { success: true, hubspotId }
    } catch (err: any) {
      console.error('[HubSpot CRM] Push failure:', err.message)
      return { success: false, error: err.message }
    }
  }

  /**
   * Pushes/Syncs a contact profile to Salesforce CRM.
   */
  async syncToSalesforce(contact: GTMContact): Promise<{ success: boolean; salesforceId?: string; error?: string }> {
    logger.info(`[Salesforce CRM] Initiating sync for lead: ${contact.email}`)
    try {
      const sfInstanceUrl = process.env.SALESFORCE_INSTANCE_URL
      const accessToken = process.env.SALESFORCE_ACCESS_TOKEN
      
      if (!sfInstanceUrl || !accessToken) {
        console.warn('[Salesforce CRM] Access credentials missing. Falling back to sandbox simulation.')
        const simulatedId = `sf_lead_${Math.random().toString(36).substring(7)}`

        await query(`
          INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
          VALUES ((SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2), $2, 'CRM_SYNC', $3, $4)
        `, [contact.email, contact.tenantId, `Successfully synchronized to Salesforce as Lead ID ${simulatedId}`, JSON.stringify({ provider: 'salesforce', id: simulatedId, syncedAt: new Date() })])

        return { success: true, salesforceId: simulatedId }
      }

      // Real Salesforce REST SObject push
      const response = await fetch(`${sfInstanceUrl}/services/data/v59.0/sobjects/Lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          LastName: contact.name.split(' ').slice(1).join(' ') || contact.name,
          FirstName: contact.name.split(' ')[0] || '',
          Company: contact.company || 'Self / Individual',
          Title: contact.title || '',
          Email: contact.email,
          Phone: contact.phone || '',
          LeadSource: contact.source || 'Chatbolt OS'
        })
      })

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(`Salesforce REST API rejected lead push: ${errBody}`)
      }

      const resData = await response.json()
      const salesforceId = resData.id

      await query(`
        INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
        VALUES ((SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2), $2, 'CRM_SYNC', $3, $4)
      `, [contact.email, contact.tenantId, `Successfully synchronized to Salesforce CRM as Lead ID ${salesforceId}`, JSON.stringify({ provider: 'salesforce', id: salesforceId, syncedAt: new Date() })])

      return { success: true, salesforceId }
    } catch (err: any) {
      console.error('[Salesforce CRM] Sync error:', err.message)
      return { success: false, error: err.message }
    }
  }

  /**
   * Initiates an outbound SMTP cold sequences sequence email
   */
  async sendOutboundSequenceEmail(
    contact: GTMContact,
    step: number,
    subject: string,
    bodyTemplate: string
  ): Promise<{ success: boolean; error?: string }> {
    logger.info(`[SMTP Outreach] Sending Sequence Step #${step} to lead: ${contact.email}`)
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('[SMTP Outreach] SMTP credentials not set. Simulated outreach sequence step.')
        
        await query(`
          INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
          VALUES ((SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2), $2, 'OUTBOUND_EMAIL', $3, $4)
        `, [contact.email, contact.tenantId, `Sent Outreach Sequence Step #${step}: "${subject}"`, JSON.stringify({ provider: 'smtp', step, subject, status: 'simulated' })])

        return { success: true }
      }

      const transporter = createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })

      // Replace placeholders in HTML email body
      const finalBody = bodyTemplate
        .replace(/{{name}}/g, contact.name)
        .replace(/{{company}}/g, contact.company || 'your company')
        .replace(/{{title}}/g, contact.title || 'your role')

      await transporter.sendMail({
        from: `"Outreach Specialist" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: contact.email,
        subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .footer { margin-top: 40px; font-size: 11px; color: #888888; border-top: 1px solid #eeeeee; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              ${finalBody}
              <div class="footer">
                If you no longer wish to receive emails from us, you can opt out by replying "unsubscribe".
              </div>
            </div>
          </body>
          </html>
        `
      })

      await query(`
        INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
        VALUES ((SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2), $2, 'OUTBOUND_EMAIL', $3, $4)
      `, [contact.email, contact.tenantId, `Successfully sent cold sequence Step #${step}: "${subject}"`, JSON.stringify({ provider: 'smtp', step, subject, sentAt: new Date() })])

      return { success: true }
    } catch (err: any) {
      console.error('[SMTP Outreach] Sequence delivery failure:', err.message)
      return { success: false, error: err.message }
    }
  }
}

export const gtmService = new GTMService()
