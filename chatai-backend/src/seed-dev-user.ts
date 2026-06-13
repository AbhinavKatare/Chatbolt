/**
 * Dev seed script — creates a test user in the local PostgreSQL database
 * with a proper bcrypt password hash so local login works without Supabase.
 *
 * Run with: npx tsx src/seed-dev-user.ts
 */
import dotenv from 'dotenv'
dotenv.config()

import { db } from './db'
import bcrypt from 'bcryptjs'

async function seed() {
  const email = 'test_user_1@chatbolt.ai'
  const password = 'password123'
  const hash = await bcrypt.hash(password, 10)

  // Upsert test user — works even if the row already exists
  await db.query(`
    INSERT INTO tenants (name, email, password_hash, plan, credits_remaining, credits_monthly, is_active)
    VALUES ('Test User', $1, $2, 'pro', 10000, 10000, true)
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      is_active = true
  `, [email, hash])

  const { rows } = await db.query('SELECT id, email, plan FROM tenants WHERE email = $1', [email])
  if (rows.length > 0) {
    console.log('✅ Dev user seeded successfully:')
    console.log('   Email:   ', email)
    console.log('   Password:', password)
    console.log('   ID:      ', rows[0].id)
    console.log('   Plan:    ', rows[0].plan)
  } else {
    console.error('❌ Failed to seed dev user')
  }

  await db.end()
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
