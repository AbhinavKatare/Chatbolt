import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connStr = process.env.DATABASE_URL || ''
console.log(`📡 Connecting to DB: ${connStr.replace(/:[^:@/]+@/, ':****@')}`)

export const db = new Pool({
  connectionString: connStr,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

db.on('connect', (client) => {
  client.query('SELECT current_database()').then(res => {
    console.log(`✅ Database connected: ${res.rows[0].current_database}`)
  })
})

db.on('error', (err) => {
  console.error('Unexpected DB client error', err)
})

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await db.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export default db
