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
    const queryPromise = originalQuery(sql, params)
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timeout ECONNREFUSED')), 800))
    return await Promise.race([queryPromise, timeoutPromise])
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
  if (isOfflineFallback) {
    if (callback) {
      callback(undefined, createMockClient(), () => {})
      return
    }
    return Promise.resolve(createMockClient())
  }
  if (callback) {
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
      callback(undefined, client, done)
    })
  }
  return originalConnect().catch((err: any) => {
    if (isConnectionError(err)) {
      console.warn(`[Database] db.connect failed, switching to local fallback: ${err.message}`)
      isOfflineFallback = true
      return createMockClient()
    }
    throw err
  })
}) as any

db.on('connect', () => {
  logger.info(`✅ Database connection established.`)
})

db.on('error', (err) => {
  console.error('Unexpected DB client error, activating fallback mode:', err.message)
  isOfflineFallback = true
})

// Split SQL comma-separated arguments while respecting quotes and nested parentheses
function splitSqlTokens(str: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''
  let depth = 0
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (inQuotes) {
      current += char
      if (char === quoteChar && str[i - 1] !== '\\') {
        inQuotes = false
      }
    } else if (char === "'" || char === '"') {
      inQuotes = true
      quoteChar = char
      current += char
    } else if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
      current += char
    } else if (char === ',' && depth === 0) {
      tokens.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) {
    tokens.push(current.trim())
  }
  return tokens
}

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
      
      const valuesIdx = sql.search(/\bvalues\b/i)
      if (valuesIdx !== -1) {
        const preValues = sql.substring(0, valuesIdx)
        const postValues = sql.substring(valuesIdx + 'values'.length)
        
        const colOpen = preValues.indexOf('(')
        const colClose = preValues.lastIndexOf(')')
        const valOpen = postValues.indexOf('(')
        const valClose = postValues.lastIndexOf(')')
        
        if (colOpen !== -1 && colClose !== -1 && valOpen !== -1 && valClose !== -1) {
          const colStr = preValues.substring(colOpen + 1, colClose)
          const valStr = postValues.substring(valOpen + 1, valClose)
          
          const columns = splitSqlTokens(colStr).map(c => c.trim().toLowerCase().replace(/\s+/g, ''))
          const valTokens = splitSqlTokens(valStr)
          
          columns.forEach((col, idx) => {
            const valToken = valTokens[idx] || ''
            if (valToken.startsWith('$')) {
              const paramIdx = parseInt(valToken.substring(1)) - 1
              newRow[col] = params[paramIdx]
            } else if (valToken.toUpperCase().includes('INTERVAL') || (valToken.toUpperCase().includes('NOW()') && col.includes('end'))) {
              newRow[col] = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            } else if (valToken.toUpperCase().includes('NOW()')) {
              newRow[col] = new Date().toISOString()
            } else if (valToken === 'true') {
              newRow[col] = true
            } else if (valToken === 'false') {
              newRow[col] = false
            } else {
              const unquoted = valToken.replace(/^['"]|['"]$/g, '')
              newRow[col] = params[idx] !== undefined ? params[idx] : unquoted
            }
          })
        }
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
      let toDelete: any[] = []
      
      // If there's a where clause
      const whereMatch = sql.match(/where\s+(.+)$/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].trim().toLowerCase()
        
        if (whereClause.includes('in (') && whereClause.includes('workspaces') && whereClause.includes('tenant_id')) {
          const tenantId = params[0]
          const workspaces = dbData['workspaces'] || []
          const workspaceIds = workspaces.filter(w => String(w.tenant_id) === String(tenantId)).map(w => String(w.id))
          toDelete = rows.filter(r => workspaceIds.includes(String(r.workspace_id)))
          dbData[tableName] = rows.filter(r => !workspaceIds.includes(String(r.workspace_id)))
        } else {
          const eqMatch = whereClause.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*\$(\d+)/i)
          if (eqMatch) {
            const field = eqMatch[1].toLowerCase()
            const paramIdx = parseInt(eqMatch[2]) - 1
            const value = params[paramIdx]
            toDelete = rows.filter(r => String(r[field]) === String(value))
            dbData[tableName] = rows.filter(r => String(r[field]) !== String(value))
          }
        }
      } else {
        toDelete = [...rows]
        dbData[tableName] = []
      }
      writeLocalDb(dbData)
      return toDelete
    }
  }

  // Match SELECT * FROM table
  if (normalized.startsWith('select')) {
    const tableMatch = sql.match(/from\s+(\w+)/i)
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase()
      let rows = dbData[tableName] || []
      
      // Basic filtering for tenant_id, workflow_id, etc.
      const whereMatch = sql.match(/where\s+([\s\S]+?)(?:\s+order\s+by|\s+limit|$)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1]
        
        // Handle ILIKE OR groups like: (key ILIKE $2 OR value ILIKE $2)
        const ilikeGroupMatch = whereClause.match(/\(([^)]+ilike[^)]+)\)/i)
        if (ilikeGroupMatch) {
          const ilikeClause = ilikeGroupMatch[1]
          const ilikeMatches = [...ilikeClause.matchAll(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*ilike\s*\$(\d+)/gi)]
          if (ilikeMatches.length > 0) {
            rows = rows.filter(r => {
              return ilikeMatches.some(m => {
                const field = m[1].trim().toLowerCase()
                const paramIdx = parseInt(m[2]) - 1
                const rawSearch = String(params[paramIdx] || '').replace(/%/g, '').toLowerCase()
                const val = String(r[field] || '').toLowerCase()
                return val.includes(rawSearch)
              })
            })
          }
        }

        const conditions = whereClause.split(/\band\b/i)
        conditions.forEach(cond => {
          if (cond.includes('(') && cond.toLowerCase().includes('ilike')) return

          const likeMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*like\s*['"]([^'"]+)['"]/i)
          if (likeMatch) {
            const field = likeMatch[1].trim().toLowerCase()
            const rawPattern = likeMatch[2].replace(/%/g, '').toLowerCase()
            rows = rows.filter(r => String(r[field] || '').toLowerCase().includes(rawPattern))
            return
          }

          const eqMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*\$(\d+)/i)
          if (eqMatch) {
            const field = eqMatch[1].trim().toLowerCase()
            const paramIdx = parseInt(eqMatch[2]) - 1
            const value = params[paramIdx]
            rows = rows.filter(r => String(r[field]) === String(value))
            return
          }

          const eqStringMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*['"]([^'"]+)['"]/i)
          if (eqStringMatch) {
            const field = eqStringMatch[1].trim().toLowerCase()
            const stringVal = eqStringMatch[2].trim()
            rows = rows.filter(r => String(r[field]).toLowerCase() === stringVal.toLowerCase())
            return
          }

          const eqValueMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*(true|false)/i)
          if (eqValueMatch) {
            const field = eqValueMatch[1].trim().toLowerCase()
            const val = eqValueMatch[2].trim().toLowerCase() === 'true'
            rows = rows.filter(r => r[field] === val)
            return
          }

          const dateGtNowMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*>\s*NOW\(\)/i)
          if (dateGtNowMatch) {
            const field = dateGtNowMatch[1].trim().toLowerCase()
            rows = rows.filter(r => {
              if (!r[field]) return false
              const dt = new Date(r[field]).getTime()
              return !isNaN(dt) && dt > Date.now()
            })
            return
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
            const valA = Number(a[field]) !== undefined && !isNaN(Number(a[field])) ? Number(a[field]) : a[field]
            const valB = Number(b[field]) !== undefined && !isNaN(Number(b[field])) ? Number(b[field]) : b[field]
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
      
      const limitMatch = sql.match(/limit\s+(\$?\d+)/i)
      if (limitMatch) {
        let limitVal: number
        if (limitMatch[1].startsWith('$')) {
          const paramIdx = parseInt(limitMatch[1].substring(1)) - 1
          limitVal = Number(params[paramIdx]) || 10
        } else {
          limitVal = parseInt(limitMatch[1])
        }
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
      const whereMatch = sql.match(/where\s+([\s\S]+)$/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].trim()
        const conditions = whereClause.split(/\band\b/i)
        conditions.forEach(cond => {
          const eqMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*\$(\d+)/i)
          if (eqMatch) {
            const field = eqMatch[1].toLowerCase()
            const paramIdx = parseInt(eqMatch[2]) - 1
            const value = params[paramIdx]
            rows = rows.filter(r => String(r[field]) === String(value))
            return
          }
          const eqStringMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*=\s*['"]([^'"]+)['"]/i)
          if (eqStringMatch) {
            const field = eqStringMatch[1].trim().toLowerCase()
            const stringVal = eqStringMatch[2].trim()
            rows = rows.filter(r => String(r[field]).toLowerCase() === stringVal.toLowerCase())
            return
          }
          const dateGtNowMatch = cond.match(/(?:[a-zA-Z_]\w*\.)?([a-zA-Z_]\w*)\s*>\s*NOW\(\)/i)
          if (dateGtNowMatch) {
            const field = dateGtNowMatch[1].trim().toLowerCase()
            rows = rows.filter(r => {
              if (!r[field]) return false
              const dt = new Date(r[field]).getTime()
              return !isNaN(dt) && dt > Date.now()
            })
            return
          }
        })
      }

      // Basic SET clause parser
      const setMatch = sql.match(/set\s+([\s\S]+?)(?:\s+where|$)/i)
      if (setMatch) {
        const setParts = splitSqlTokens(setMatch[1])
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
            } else if (valStr.toLowerCase().includes('coalesce') || valStr.includes('+')) {
              const addMatch = valStr.match(/\+\s*\$(\d+)/i) || valStr.match(/\+\s*(\d+)/i)
              let addVal = 1
              if (addMatch) {
                if (valStr.includes('$')) {
                  const paramIdx = parseInt(addMatch[1]) - 1
                  addVal = Number(params[paramIdx]) || 1
                } else {
                  addVal = parseInt(addMatch[1]) || 1
                }
              }
              rows.forEach(r => { r[col] = (Number(r[col]) || 0) + addVal })
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

