import { logger } from '../services/logger.service';
import { Pool } from 'pg'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

const connStr = process.env.DATABASE_URL || ''
logger.info(`📡 Connecting to DB: ${connStr.replace(/:[^:@/]+@/, ':****@')}`)

let isOfflineFallback = false
const localDbPath = path.join(process.cwd(), 'chatbolt_local_db.json')

// Initialize local JSON DB if missing
if (!fs.existsSync(localDbPath)) {
  fs.writeFileSync(localDbPath, JSON.stringify({
    tenants: [{ id: '00000000-0000-0000-0000-000000000000', name: 'Hobby User', email: 'user@example.com', plan: 'hobby', credits_remaining: 500 }],
    workflows: [],
    workflow_agents: [],
    workflow_runs: [],
    workflow_steps: [],
    agent_heartbeats: [],
    memory_entities: [],
    memory_relationships: [],
    memory_decisions: [],
    memory_goals: [],
    agent_governance_rules: []
  }, null, 2))
}

function readLocalDb(): Record<string, any[]> {
  try {
    return JSON.parse(fs.readFileSync(localDbPath, 'utf8'))
  } catch {
    return {}
  }
}

function writeLocalDb(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[Fallback DB] Failed to write local JSON DB:', err)
  }
}

export const db = new Pool({
  connectionString: connStr,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

function isConnectionError(err: any): boolean {
  return !!(
    err.message?.includes('connection') || 
    err.message?.includes('timeout') || 
    err.message?.includes('ECONNREFUSED') || 
    err.code === '57P01' || 
    err.code === '57P02' || 
    err.code === '57P03'
  )
}

function createMockClient() {
  return {
    query: async (sql: any, params?: any[]) => {
      const rows = emulateQuery(typeof sql === 'string' ? sql : sql.text, params || (typeof sql === 'object' ? sql.values : []))
      return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] }
    },
    release: () => {},
    on: () => {},
    once: () => {},
    removeListener: () => {},
    emit: () => {}
  }
}

// Wrap db.query to support offline fallback
const originalQuery = db.query.bind(db)
db.query = (async (sql: any, params?: any[]) => {
  if (isOfflineFallback) {
    const rows = emulateQuery(typeof sql === 'string' ? sql : sql.text, params || (typeof sql === 'object' ? sql.values : []))
    return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] }
  }
  try {
    return await originalQuery(sql, params)
  } catch (err: any) {
    if (isConnectionError(err)) {
      console.warn(`[Database] Connection failed on raw query, switching to local fallback: ${err.message}`)
      isOfflineFallback = true
      const rows = emulateQuery(typeof sql === 'string' ? sql : sql.text, params || (typeof sql === 'object' ? sql.values : []))
      return { rows, command: 'SELECT', rowCount: rows.length, oid: 0, fields: [] }
    }
    throw err
  }
}) as any

// Wrap db.connect to support offline fallback
const originalConnect = db.connect.bind(db)
db.connect = ((callback?: any) => {
  if (callback) {
    if (isOfflineFallback) {
      callback(undefined, createMockClient(), () => {})
      return
    }
    return originalConnect((err: any, client: any, done: any) => {
      if (err) {
        if (isConnectionError(err)) {
          console.warn(`[Database] db.connect (cb) failed, switching to local fallback: ${err.message}`)
          isOfflineFallback = true
          callback(undefined, createMockClient(), () => {})
          return
        }
        callback(err, undefined, done)
        return
      }

      if (client && !client._queryWrapped) {
        client._queryWrapped = true
        const originalClientQuery = client.query.bind(client)
        client.query = (function (sql: any, params?: any, cb?: any) {
          let actualParams = params
          let actualCallback = cb
          if (typeof params === 'function') {
            actualCallback = params
            actualParams = undefined
          }
          if (actualCallback) {
            return originalClientQuery(sql, actualParams, (err: any, res: any) => {
              if (err && isConnectionError(err)) {
                console.warn(`[Database] Connection failed on client query (cb), switching to local fallback: ${err.message}`)
                isOfflineFallback = true
              }
              actualCallback(err, res)
            })
          } else {
            return originalClientQuery(sql, actualParams).catch((err: any) => {
              if (isConnectionError(err)) {
                console.warn(`[Database] Connection failed on client query (promise), switching to local fallback: ${err.message}`)
                isOfflineFallback = true
              }
              throw err
            })
          }
        }) as any
      }

      callback(undefined, client, done)
    })
  } else {
    return (async () => {
      if (isOfflineFallback) {
        return createMockClient()
      }
      try {
        const client = await originalConnect()
        const clientAny = client as any
        if (clientAny && !clientAny._queryWrapped) {
          clientAny._queryWrapped = true
          const originalClientQuery = client.query.bind(client)
          client.query = (function (sql: any, params?: any, cb?: any) {
            let actualParams = params
            let actualCallback = cb
            if (typeof params === 'function') {
              actualCallback = params
              actualParams = undefined
            }
            if (actualCallback) {
              return originalClientQuery(sql, actualParams, (err: any, res: any) => {
                if (err && isConnectionError(err)) {
                  console.warn(`[Database] Connection failed on client query (cb), switching to local fallback: ${err.message}`)
                  isOfflineFallback = true
                }
                actualCallback(err, res)
              })
            } else {
              return originalClientQuery(sql, actualParams).catch((err: any) => {
                if (isConnectionError(err)) {
                  console.warn(`[Database] Connection failed on client query (promise), switching to local fallback: ${err.message}`)
                  isOfflineFallback = true
                }
                throw err
              })
            }
          }) as any
        }
        return client
      } catch (err: any) {
        if (isConnectionError(err)) {
          console.warn(`[Database] db.connect failed, switching to local fallback: ${err.message}`)
          isOfflineFallback = true
          return createMockClient()
        }
        throw err
      }
    })()
  }
}) as any

db.on('connect', () => {
  logger.info(`✅ Database connection established.`)
})

db.on('error', (err) => {
  console.error('Unexpected DB client error, activating fallback mode:', err.message)
  isOfflineFallback = true
})

// Lightweight SQL Parser & Emulator for JSON Fallback Database
function emulateQuery(sql: string, params: any[] = []): any[] {
  const normalized = sql.trim().toLowerCase()
  const dbData = readLocalDb()

  // Match INSERT INTO table (cols) VALUES (vals)
  if (normalized.startsWith('insert into')) {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i)
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase()
      dbData[tableName] = dbData[tableName] || []
      
      const newRow: Record<string, any> = { id: crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36), created_at: new Date().toISOString() }
      
      // Parse columns and values if present
      const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i)
      if (columnsMatch) {
        const columns = columnsMatch[1].split(',').map(c => c.trim().toLowerCase())
        columns.forEach((col, idx) => {
          newRow[col] = params[idx]
        })
      }
      
      dbData[tableName].push(newRow)
      writeLocalDb(dbData)
      return [newRow]
    }
  }

  // Match DELETE FROM table
  if (normalized.startsWith('delete from')) {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i)
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase()
      const rows = dbData[tableName] || []
      
      // If there's a where clause
      const whereMatch = sql.match(/where\s+(.+)$/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].trim().toLowerCase()
        
        if (whereClause.includes('in (') && whereClause.includes('workspaces') && whereClause.includes('tenant_id')) {
          const tenantId = params[0]
          const workspaces = dbData['workspaces'] || []
          const workspaceIds = workspaces.filter(w => String(w.tenant_id) === String(tenantId)).map(w => String(w.id))
          dbData[tableName] = rows.filter(r => !workspaceIds.includes(String(r.workspace_id)))
        } else {
          const eqMatch = whereClause.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*\$(\d+)/i)
          if (eqMatch) {
            const field = eqMatch[1].toLowerCase()
            const paramIdx = parseInt(eqMatch[2]) - 1
            const value = params[paramIdx]
            dbData[tableName] = rows.filter(r => String(r[field]) !== String(value))
          }
        }
      } else {
        dbData[tableName] = []
      }
      writeLocalDb(dbData)
      return []
    }
  }

  // Match SELECT * FROM table
  if (normalized.startsWith('select')) {
    const tableMatch = sql.match(/from\s+(\w+)/i)
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase()
      let rows = dbData[tableName] || []
      
      // Basic filtering for tenant_id, workflow_id, etc.
      const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1]
        const conditions = whereClause.split(/\band\b/i)
        conditions.forEach(cond => {
          const eqMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*\$(\d+)/i)
          if (eqMatch) {
            const field = eqMatch[1].trim().toLowerCase()
            const paramIdx = parseInt(eqMatch[2]) - 1
            const value = params[paramIdx]
            rows = rows.filter(r => String(r[field]) === String(value))
          }
          const eqValueMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*(true|false)/i)
          if (eqValueMatch) {
            const field = eqValueMatch[1].trim().toLowerCase()
            const val = eqValueMatch[2].trim().toLowerCase() === 'true'
            rows = rows.filter(r => r[field] === val)
          }
        })
      }

      if (tableName === 'team_invites') {
        const teams = dbData['teams'] || []
        rows = rows.map(r => {
          const team = teams.find(t => String(t.id) === String(r.team_id))
          return { ...r, team_name: team ? team.name : '' }
        })
      }
      
      if (normalized.includes('order by')) {
        const orderMatch = sql.match(/order\s+by\s+(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)(?:\s+(asc|desc))?/i)
        if (orderMatch) {
          const field = orderMatch[1].trim().toLowerCase()
          const direction = (orderMatch[2] || 'asc').trim().toLowerCase()
          rows = [...rows].sort((a, b) => {
            const valA = a[field]
            const valB = b[field]
            if (valA === valB) return 0
            if (valA === undefined || valA === null) return 1
            if (valB === undefined || valB === null) return -1
            if (direction === 'desc') {
              return valA < valB ? 1 : -1
            } else {
              return valA > valB ? 1 : -1
            }
          })
        }
      }
      
      const limitMatch = sql.match(/limit\s+(\d+)/i)
      if (limitMatch) {
        const limitVal = parseInt(limitMatch[1])
        rows = rows.slice(0, limitVal)
      }
      
      return rows
    }
  }

  // Match UPDATE table SET col = val
  if (normalized.startsWith('update')) {
    const tableMatch = sql.match(/update\s+(\w+)/i)
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase()
      let rows = dbData[tableName] || []
      
      // Filter rows if WHERE clause exists
      const whereMatch = sql.match(/where\s+(.+)$/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].trim()
        const eqMatch = whereClause.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*\$(\d+)/i)
        if (eqMatch) {
          const field = eqMatch[1].toLowerCase()
          const paramIdx = parseInt(eqMatch[2]) - 1
          const value = params[paramIdx]
          rows = rows.filter(r => String(r[field]) === String(value))
        }
      }

      // Basic SET clause parser
      const setMatch = sql.match(/set\s+(.+?)(?:\s+where|$)/i)
      if (setMatch) {
        const setParts = setMatch[1].split(',')
        setParts.forEach(part => {
          const eqIdx = part.indexOf('=')
          if (eqIdx !== -1) {
            const col = part.substring(0, eqIdx).trim().toLowerCase()
            const valStr = part.substring(eqIdx + 1).trim()
            
            if (valStr === 'true') {
              rows.forEach(r => { r[col] = true })
            } else if (valStr === 'false') {
              rows.forEach(r => { r[col] = false })
            } else if (valStr.startsWith('$')) {
              const paramIdx = parseInt(valStr.substring(1)) - 1
              const val = params[paramIdx]
              rows.forEach(r => { r[col] = val })
            } else if (valStr.toUpperCase() === 'NOW()') {
              rows.forEach(r => { r[col] = new Date().toISOString() })
            } else if (valStr.toLowerCase().replace(/\s+/g, '') === `${col}+1`) {
              rows.forEach(r => { r[col] = (Number(r[col]) || 0) + 1 })
            } else {
              const cleanVal = valStr.replace(/^['"]|['"]$/g, '')
              rows.forEach(r => { r[col] = cleanVal })
            }
          }
        })
      }
      
      rows.forEach(r => {
        r.updated_at = new Date().toISOString()
      })
      writeLocalDb(dbData)
      return rows
    }
  }

  return []
}


async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let attempt = 1
  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      const isConnectionError = 
        err.message?.includes('connection') || 
        err.message?.includes('timeout') || 
        err.message?.includes('ECONNREFUSED') || 
        err.code === '57P01' || 
        err.code === '57P02' || 
        err.code === '57P03'
        
      if (!isConnectionError || attempt >= maxAttempts) {
        throw err
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      logger.warn(`[Database] Query failed on attempt ${attempt}. Retrying in ${delay}ms: ${err.message}`)
      await new Promise(resolve => setTimeout(resolve, delay))
      attempt++
    }
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  if (isOfflineFallback) {
    console.warn(`[Fallback DB] Emulating query offline: ${sql.slice(0, 100)}...`)
    return emulateQuery(sql, params) as T[]
  }

  try {
    return await withRetry(async () => {
      const client = await db.connect()
      try {
        const result = await client.query(sql, params)
        return result.rows as T[]
      } finally {
        client.release()
      }
    })
  } catch (err: any) {
    if (isConnectionError(err)) {
      console.error(`[Database] Connection failed after retries: ${err.message}. Switching to local JSON DB.`)
      isOfflineFallback = true
      return emulateQuery(sql, params) as T[]
    }
    throw err
  }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export default db

