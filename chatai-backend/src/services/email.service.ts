// src/services/email.service.ts
// Uses nodemailer with your personal SMTP (Gmail app password, etc.)
// Install: npm install nodemailer @types/nodemailer

import { createTransport, Transporter } from 'nodemailer'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter
  transporter = createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return transporter
}

interface EmailOptions {
  to: string
  subject: string
  html: string
}

async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured — skipping email to:', to)
    return
  }
  const t = getTransporter()
  await t.sendMail({
    from: `"ChatAI" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to, subject, html,
  })
  console.log(`📧 Email sent to ${to}: ${subject}`)
}

// ── Email templates ───────────────────────────────────────────────

const baseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { margin:0; padding:0; background:#0a0a0a; font-family: 'Segoe UI', sans-serif; }
  .wrap { max-width:560px; margin:0 auto; padding:40px 20px; }
  .logo { display:flex; align-items:center; gap:10px; margin-bottom:32px; }
  .logo-box { width:36px; height:36px; background:#B8FF00; border-radius:8px; display:inline-block; }
  .logo-text { color:#fff; font-size:18px; font-weight:700; }
  .card { background:#111; border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:28px; }
  h1 { color:#fff; font-size:22px; margin:0 0 8px; }
  p { color:#888; font-size:14px; line-height:1.7; margin:0 0 16px; }
  .btn { display:inline-block; background:#B8FF00; color:#0a0a0a; font-weight:700; font-size:14px; padding:12px 24px; border-radius:8px; text-decoration:none; }
  .footer { color:#333; font-size:12px; text-align:center; margin-top:28px; }
  code { background:#1a1a1a; color:#B8FF00; padding:3px 8px; border-radius:4px; font-size:13px; }
</style></head>
<body><div class="wrap">
  <div class="logo">
    <div class="logo-box"></div>
    <span class="logo-text">ChatAI</span>
  </div>
  <div class="card">${content}</div>
  <div class="footer">ChatAI · AI Customer Support Platform<br>You're receiving this because you have an account with us.</div>
</div></body>
</html>`

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to, subject: 'Welcome to ChatAI 🎉',
    html: baseLayout(`
      <h1>Welcome, ${name}!</h1>
      <p>Your account is ready. You have <strong style="color:#B8FF00">500 free message credits</strong> to get started.</p>
      <p>Here's what to do next:</p>
      <ol style="color:#888; font-size:14px; line-height:2; padding-left:20px;">
        <li>Create your first AI agent</li>
        <li>Upload your knowledge base (PDFs, URLs, or text)</li>
        <li>Copy the embed code and paste it on your website</li>
      </ol>
      <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Open Dashboard →</a>
    `),
  })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  await sendEmail({
    to, subject: 'Reset your ChatAI password',
    html: baseLayout(`
      <h1>Reset your password</h1>
      <p>Hi ${name}, we received a request to reset your password. Click the button below to create a new one.</p>
      <p>This link expires in <strong style="color:#fff">1 hour</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset Password →</a>
      <p style="margin-top:20px; font-size:12px; color:#444;">If you didn't request this, you can safely ignore this email.</p>
    `),
  })
}

export async function sendEscalationAlert(to: string, agentName: string, sessionId: string, lastMessage: string): Promise<void> {
  await sendEmail({
    to, subject: `⚠️ Escalation alert — ${agentName}`,
    html: baseLayout(`
      <h1>Human agent needed</h1>
      <p>A customer conversation requires human attention from your agent <strong style="color:#fff">${agentName}</strong>.</p>
      <p><strong style="color:#fff">Session:</strong> <code>${sessionId.slice(0, 12)}</code></p>
      <p><strong style="color:#fff">Last message:</strong></p>
      <div style="background:#1a1a1a; border-left:3px solid #B8FF00; padding:12px 16px; border-radius:4px; margin:0 0 20px; color:#ccc; font-size:14px;">${lastMessage}</div>
      <a href="${process.env.FRONTEND_URL}/dashboard/conversations" class="btn">View Conversation →</a>
    `),
  })
}

export async function sendCreditLowAlert(to: string, name: string, remaining: number): Promise<void> {
  await sendEmail({
    to, subject: `⚠️ Low credits — ${remaining} remaining`,
    html: baseLayout(`
      <h1>Credits running low</h1>
      <p>Hi ${name}, you have <strong style="color:#ffb400">${remaining} message credits</strong> remaining.</p>
      <p>Upgrade your plan or top up credits to keep your agents running without interruption.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/billing" class="btn">Top up credits →</a>
    `),
  })
}

export async function sendMonthlyReport(to: string, name: string, stats: { conversations: number; resolved: number; credits_used: number }): Promise<void> {
  await sendEmail({
    to, subject: 'Your monthly ChatAI report',
    html: baseLayout(`
      <h1>Monthly report</h1>
      <p>Hi ${name}, here's how your agents performed this month:</p>
      <div style="display:grid; gap:12px; margin:16px 0;">
        <div style="background:#1a1a1a; border-radius:8px; padding:14px; display:flex; justify-content:space-between;">
          <span style="color:#888; font-size:13px;">Total conversations</span>
          <span style="color:#B8FF00; font-weight:700; font-size:16px;">${stats.conversations}</span>
        </div>
        <div style="background:#1a1a1a; border-radius:8px; padding:14px; display:flex; justify-content:space-between;">
          <span style="color:#888; font-size:13px;">Resolved automatically</span>
          <span style="color:#B8FF00; font-weight:700; font-size:16px;">${stats.resolved}</span>
        </div>
        <div style="background:#1a1a1a; border-radius:8px; padding:14px; display:flex; justify-content:space-between;">
          <span style="color:#888; font-size:13px;">Credits used</span>
          <span style="color:#888; font-weight:700; font-size:16px;">${stats.credits_used}</span>
        </div>
      </div>
      <a href="${process.env.FRONTEND_URL}/dashboard/analytics" class="btn">View full analytics →</a>
    `),
  })
}
