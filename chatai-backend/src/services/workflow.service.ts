import { query, queryOne } from '../db'
import { v4 as uuid } from 'uuid'

export interface WorkflowAgent {
  agent_id: string
  name: string
  role: string
}

export interface WorkflowInput {
  name: string
  description?: string
  trigger_type: 'webhook' | 'manual' | 'cron' | 'event'
  agents: WorkflowAgent[]
  requirements: string[]
  orchestration_code: string
}

export async function createWorkflow(tenantId: string, input: WorkflowInput) {
  const [workflow] = await query(
    `INSERT INTO workflows (tenant_id, name, description, trigger_type, agents, requirements, orchestration_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      input.name,
      input.description,
      input.trigger_type,
      JSON.stringify(input.agents),
      JSON.stringify(input.requirements),
      input.orchestration_code
    ]
  )
  return workflow
}

export async function getWorkflows(tenantId: string) {
  return query('SELECT * FROM workflows WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId])
}

export async function getWorkflow(tenantId: string, id: string) {
  return queryOne('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2', [tenantId, id])
}

export async function updateWorkflow(tenantId: string, id: string, updates: Partial<WorkflowInput>) {
  const fields: string[] = []
  const values: any[] = [tenantId, id]
  let i = 3

  if (updates.name) { fields.push(`name = $${i++}`); values.push(updates.name) }
  if (updates.description !== undefined) { fields.push(`description = $${i++}`); values.push(updates.description) }
  if (updates.trigger_type) { fields.push(`trigger_type = $${i++}`); values.push(updates.trigger_type) }
  if (updates.agents) { fields.push(`agents = $${i++}`); values.push(JSON.stringify(updates.agents)) }
  if (updates.requirements) { fields.push(`requirements = $${i++}`); values.push(JSON.stringify(updates.requirements)) }
  if (updates.orchestration_code) { fields.push(`orchestration_code = $${i++}`); values.push(updates.orchestration_code) }

  if (fields.length === 0) return null

  const [workflow] = await query(
    `UPDATE workflows SET ${fields.join(', ')}, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    values
  )
  return workflow
}

export async function deleteWorkflow(tenantId: string, id: string) {
  await query('DELETE FROM workflows WHERE tenant_id = $1 AND id = $2', [tenantId, id])
  return { success: true }
}
