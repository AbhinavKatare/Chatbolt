import { logger } from './logger.service';
import { google } from 'googleapis'
import { query, queryOne } from '../db'

export async function syncLeadToSheet(leadId: string) {
  try {
    const lead = await queryOne(
      `SELECT l.*, t.name as tenant_name 
       FROM leads l 
       JOIN tenants t ON l.tenant_id = t.id 
       WHERE l.id = $1`,
      [leadId]
    ) as any

    if (!lead) return

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.LEADS_SHEET_ID

    if (!spreadsheetId) {
      console.warn('LEADS_SHEET_ID not set, skipping Google Sheets sync.')
      return
    }

    const metadata = lead.metadata || {}
    const values = [
      [
        new Date(lead.created_at).toISOString(),
        lead.name || 'Anonymous',
        lead.email || 'N/A',
        lead.phone || 'N/A',
        metadata.requirement || 'N/A',
        metadata.budget || 'N/A',
        lead.qualification_score || 0,
        metadata.notes || ''
      ]
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Leads!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    })

    logger.info(`✅ Lead ${leadId} synced to Google Sheet for tenant ${lead.tenant_name}`)
  } catch (err) {
    console.error('Failed to sync lead to Google Sheets:', err)
    throw err
  }
}
