import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { errorHandler } from './middleware/error.middleware'


dotenv.config()

import authRoutes from './routes/auth'
import agentRoutes from './routes/agents'
import documentRoutes from './routes/documents'
import chatRoutes from './routes/chat'
import billingRoutes from './routes/billing'
import analyticsRoutes from './routes/analytics'
import apiKeyRoutes from './routes/apikeys'
import widgetRoutes from './routes/widget'
import autopilotRoutes from './routes/autopilot'
import webhookRoutes from './routes/webhooks'
import calendarRoutes from './routes/calendar'
import workflowRoutes from './routes/workflows'
import reportsRoutes from './routes/reports'
import { initJobs } from './jobs/daily-report'
import { startKeepAlive } from './jobs/keep-alive'

const app = express()
const PORT = process.env.PORT || 4000

// Start cron jobs
initJobs()
startKeepAlive()

// ── Stripe webhook needs raw body ─────────────────────────────────
app.use('/billing/webhook', express.raw({ type: 'application/json' }))

// ── Global middleware ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    /\.yourdomain\.com$/,  // allow all subdomains — update this
  ],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key'],
}))

app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Rate limiting ─────────────────────────────────────────────────
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  message: { error: 'Too many requests, please slow down.' },
})

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts.' },
})

const chatLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { error: 'Too many messages. Please slow down.' },
})

app.use(globalLimit)

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// ── Routes ────────────────────────────────────────────────────────
app.use('/auth', authLimit, authRoutes)
app.use('/agents', agentRoutes)
app.use('/agents', documentRoutes)          // /agents/:agentId/documents/...
app.use('/chat', chatLimit, chatRoutes)
app.use('/billing', billingRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/api-keys', apiKeyRoutes)
app.use('/autopilot', autopilotRoutes)
app.use('/webhooks', webhookRoutes)
app.use('/calendar', calendarRoutes)
app.use('/workflows', workflowRoutes)
app.use('/reports', reportsRoutes)
app.use('/', widgetRoutes)                  // /widget.js and /widget/:agentId

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);


app.listen(PORT, () => {
  console.log(`
🚀 Chatbolt Backend running on port ${PORT}
📊 Dashboard:  ${process.env.FRONTEND_URL}
🔧 Health:     http://localhost:${PORT}/health
🌍 Env:        ${process.env.NODE_ENV || 'development'}
  `)
})

export default app
