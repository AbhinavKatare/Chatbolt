import cron from 'node-cron'
import { query } from '../db'
import { Resend } from 'resend'
import { openrouter } from '../services/rag.service'

const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === 'undefined') {
    console.warn('⚠️ RESEND_API_KEY is not configured. Email features will be disabled.');
    return null;
  }
  return new Resend(key);
};

export function initJobs() {
  // Run at 9:00 AM every day
  cron.schedule('0 9 * * *', async () => {
    console.log('🌅 Starting daily reports for all tenants...')
    try {
      const tenants = await query('SELECT * FROM tenants WHERE is_active = true')
      for (const tenant of (tenants as any[])) {
        await processDailyReport(tenant)
      }
    } catch (err) {
      console.error('Failed to run daily reports job:', err)
    }
  })
}

async function processDailyReport(tenant: any) {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // 1. Generate the report summary and save to database using the new service
    const { generateDailyReport } = await import('../services/daily-reporter.service')
    const reportData = await generateDailyReport(tenant.id)

    // 2. Enhance report using LLM for the email formatting
    const prompt = `
      Generate a professional business daily report summary for the business owner of "${tenant.name}".
      
      Yesterday's Stats (${dateStr}):
      ${reportData.summary}
      - Credits Remaining: ${tenant.credits_remaining}
      
      Requirements:
      - Start with a friendly greeting.
      - Summarize the performance in 2 paragraphs.
      - Include a "Key Recommendations" section with 2-3 bullets.
      - Keep the tone professional, concise, and helpful.
      - Use HTML formatting (p, b, ul, li).
    `

    const aiResponse = await openrouter.chat.completions.create({
      model: 'qwen/qwen3-235b-a22b:free',
      messages: [{ role: 'user', content: prompt }]
    })

    const reportContent = aiResponse.choices[0]?.message?.content || 'Unable to generate report today.'

    // Update the database record with the LLM-enhanced summary
    await query(
      'UPDATE daily_reports SET summary = $1 WHERE id = $2',
      [reportContent.replace(/<[^>]*>?/gm, ''), reportData.id] // Strip HTML for DB text
    )

    // 3. Send via Resend Email API
    const res = getResend();
    if (!res) {
      console.warn('Skipping email delivery: Resend API key not configured.');
      return;
    }

    const { error } = await res.emails.send({
      from: process.env.EMAIL_FROM || 'ChatAI <noreply@yourdomain.com>',
      to: tenant.email,
      subject: `📊 Your Daily Report: ${dateStr} - Chatbolt`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #00DFB8; background: #1A1A1A; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; margin: 0;">Chatbolt Ops Reporter</h2>
          <div style="padding: 30px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; background: #FAFAFA;">
            ${reportContent}
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;" />
            <p style="font-size: 12px; color: #888; text-align: center; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">
              You received this because the Daily Ops Reporter agent is active in your Chatbolt workspace.
              <br/><br/><a href="${process.env.FRONTEND_URL}/dashboard/reports" style="color: #00DFB8; text-decoration: none;">View Reports Dashboard</a>
            </p>
          </div>
        </div>
      `
    })

    if (error) {
      throw new Error(error.message)
    }

    console.log(`✅ Daily report sent and saved for ${tenant.email}`)
  } catch (err) {
    console.error(`❌ Failed to process report for tenant ${tenant.id}:`, err)
  }
}
