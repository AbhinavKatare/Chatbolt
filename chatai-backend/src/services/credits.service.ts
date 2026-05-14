import { query, queryOne } from '../db'

export async function deductCredit(tenantId: string, conversationId?: string): Promise<boolean> {
  const result = await query<{ credits_remaining: number }>(
    `UPDATE tenants 
     SET credits_remaining = credits_remaining - 1 
     WHERE id = $1 AND credits_remaining > 0 
     RETURNING credits_remaining`,
    [tenantId]
  )
  if (result.length === 0) return false

  await query(
    `INSERT INTO credit_transactions (tenant_id, amount, type, description, conversation_id)
     VALUES ($1, -1, 'usage', 'Message credit used', $2)`,
    [tenantId, conversationId ?? null]
  )
  return true
}

export async function refillCredits(tenantId: string, amount: number, type = 'recharge', description = 'Plan renewal'): Promise<void> {
  await query(
    `UPDATE tenants SET credits_remaining = credits_remaining + $1 WHERE id = $2`,
    [amount, tenantId]
  )
  await query(
    `INSERT INTO credit_transactions (tenant_id, amount, type, description)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, amount, type, description]
  )
}

export async function getCreditsBalance(tenantId: string) {
  return queryOne<{ credits_remaining: number; credits_monthly: number; plan: string }>(
    'SELECT credits_remaining, credits_monthly, plan FROM tenants WHERE id = $1',
    [tenantId]
  )
}

export const PLAN_CREDITS: Record<string, number> = {
  pro: 2500, premium: 10000, enterprise: 100000
}
