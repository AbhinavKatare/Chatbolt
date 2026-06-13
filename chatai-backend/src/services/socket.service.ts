import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import { supabase } from '../lib/supabase'
import { queryOne } from '../db'
import { Tenant } from '../types'
import { logger } from './logger.service'

export let io: SocketIOServer | null = null
export const activeExtensions = new Map<string, any>() // tenantId -> socket

export const pendingCommands = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>()

export function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        /\.yourdomain\.com$/,
      ],
      credentials: true,
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    }
  })

  // Middleware for default namespace '/'
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) {
      return next() // Allow connection, authenticate room subscriptions dynamically or allow fallback
    }

    // Handle local JWT
    const jwtSecret = process.env.JWT_SECRET || 'chatbolt-local-dev-secret'
    try {
      const decoded = jwt.verify(token as string, jwtSecret) as { sub: string }
      if (decoded?.sub) {
        const tenant = await queryOne<Tenant>('SELECT id FROM tenants WHERE id = $1', [decoded.sub])
        if (tenant) {
          (socket as any).tenantId = tenant.id
          return next()
        }
      }
    } catch (err) {}

    // Try Supabase auth
    try {
      const { data, error } = await supabase.auth.getUser(token as string)
      if (!error && data?.user) {
        const tenant = await queryOne<Tenant>('SELECT id FROM tenants WHERE (supabase_user_id = $1 OR email = $2)', [data.user.id, data.user.email])
        if (tenant) {
          (socket as any).tenantId = tenant.id
          return next()
        }
      }
    } catch (err) {}

    return next() // Allow connection to join rooms manually even if token auth failed temporarily (resilience)
  })

  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected to default namespace: ${socket.id}`)

    socket.on('subscribe:run', (data: { runId: string }) => {
      if (data?.runId) {
        socket.join(`run:${data.runId}`)
        logger.info(`[Socket.IO] Client ${socket.id} subscribed to run:${data.runId}`)
      }
    })

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`)
    })
  })

  // Namespace for Chrome Extension browser connector
  const browserAgentNamespace = io.of('/browser-agent')
  browserAgentNamespace.on('connection', (socket) => {
    const tenantId = socket.handshake.query?.tenantId as string
    logger.info(`[Socket.IO] Chrome Extension connected to /browser-agent: ${socket.id} (Tenant: ${tenantId})`)

    if (tenantId) {
      activeExtensions.set(tenantId, socket)
      socket.emit('browser:connect', { success: true })
      
      socket.on('browser:result', (res: any) => {
        const pending = pendingCommands.get(res.commandId)
        if (pending) {
          pendingCommands.delete(res.commandId)
          if (res.success) {
            pending.resolve(res.data)
          } else {
            pending.reject(new Error(res.error || 'Extension command failed'))
          }
        }
      })
    }

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Chrome Extension disconnected: ${socket.id}`)
      if (tenantId && activeExtensions.get(tenantId) === socket) {
        activeExtensions.delete(tenantId)
      }
    })
  })
}

// Function to broadcast run events to Socket.IO clients
export function broadcastRunEvent(runId: string, eventName: string, payload: any) {
  if (io) {
    io.to(`run:${runId}`).emit(eventName, payload)
    logger.info(`[Socket.IO] Broadcasted event ${eventName} to run:${runId}`)
  }
}
