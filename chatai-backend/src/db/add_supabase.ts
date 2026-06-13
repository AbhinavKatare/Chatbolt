import { logger } from '../services/logger.service';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE');
    logger.info('Added supabase_user_id to tenants');

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        summary TEXT,
        metrics JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    logger.info('Ensured daily_reports table exists');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
