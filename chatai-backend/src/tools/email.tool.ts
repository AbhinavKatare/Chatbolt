import nodemailer from 'nodemailer'
import fs from 'fs'
import Papa from 'papaparse'
import { google } from 'googleapis'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export async function runSendEmail({ 
  to, 
  subject, 
  body, 
  smtpConfig 
}: { 
  to: string, 
  subject: string, 
  body: string, 
  smtpConfig?: SmtpConfig 
}) {
  const transporter = nodemailer.createTransport(smtpConfig || {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html: body
  })

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  }
}

export async function runBulkEmail({ 
  recipients, 
  subject, 
  html, 
  smtpConfig 
}: { 
  recipients: string[], 
  subject: string, 
  html: string, 
  smtpConfig?: SmtpConfig 
}) {
  const results = {
    sent: 0,
    failed: 0,
    failedList: [] as string[]
  }

  // Batch of 10
  const batchSize = 10
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    await Promise.all(batch.map(async (email) => {
      try {
        await runSendEmail({ to: email, subject, body: html, smtpConfig })
        results.sent++
      } catch (err) {
        results.failed++
        results.failedList.push(email)
      }
    }))
    
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}

export async function loadRecipientsFromCsv(filePath: string, emailColumn = 'email') {
  const content = fs.readFileSync(filePath, 'utf8')
  const result = Papa.parse(content, { header: true })
  return result.data.map((row: any) => row[emailColumn]).filter(Boolean)
}

export async function loadRecipientsFromSheet(sheetId: string, range: string, emailIndex = 0, apiKey?: string) {
  const sheets = google.sheets({ version: 'v4', auth: apiKey || process.env.GOOGLE_API_KEY })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: range || 'Sheet1!A:B',
  })
  const rows = response.data.values || []
  return rows.map(row => row[emailIndex]).filter(Boolean)
}
