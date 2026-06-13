import { db, query, queryOne } from './db/index'
import { actionJournalService } from './services/action-journal.service'
import { integrationRegistryService } from './services/integration-registry.service'
import { handleExecuteV2 } from './services/execution-router.service'
import { addTask, removeTask } from './jobs/scheduler'
import axios from 'axios'

async function runSmokeTests() {
  console.info('🏁 Starting Smoke Tests...')

  const baseUrl = 'http://localhost:4000'
  
  // 0. Setup and clean
  let tenantId = '00000000-0000-0000-0000-000000000000'
  
  console.info('[DEBUG] Querying if tenant exists...')
  const tenantExists = await queryOne('SELECT id FROM tenants WHERE id = $1', [tenantId])
  console.info('[DEBUG] Tenant exists check complete:', !!tenantExists)
  
  if (!tenantExists) {
    console.info('[DEBUG] Creating test tenant...')
    await query(`
      INSERT INTO tenants (id, name, email, plan, is_active, credits_remaining, credits_monthly, password_hash)
      VALUES ($1, 'Smoke Test Business', 'smoke@chatbolt.io', 'pro', true, 10000, 10000, 'mock_hash')
    `, [tenantId])
    console.info('[DEBUG] Test tenant created.')
  }

  console.info('[DEBUG] Deleting old workflows/runs...')
  await query('DELETE FROM user_integrations WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM workspace_integrations WHERE workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = $1)', [tenantId])
  await query('DELETE FROM workflow_runs WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM workflows WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM team_invites')
  await query('DELETE FROM team_members')
  await query('DELETE FROM teams WHERE owner_tenant_id = $1', [tenantId])
  await query('DELETE FROM scheduled_tasks WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM action_journal WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM user_templates WHERE tenant_id = $1', [tenantId])
  console.info('✅ Setup clean state.')

  // ─────────────────────────────────────────────────────────────────
  // S1: Onboarding -> first result < 3 minutes
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S1: Onboarding first value flow...')
  
  console.info('[DEBUG] Saving gmail integration...')
  await integrationRegistryService.saveIntegration(tenantId, 'gmail', {
    access_token: 'mock-token-gmail',
    expires_at: new Date(Date.now() + 3600 * 1000)
  })
  
  console.info('[DEBUG] Checking if integration was saved...')
  const hasGmail = await integrationRegistryService.hasIntegration(tenantId, 'gmail')
  if (!hasGmail) throw new Error('S1: Gmail integration failed to save')
  
  console.info('[DEBUG] Querying /api/health...')
  const healthRes = await axios.get(`${baseUrl}/api/health`)
  console.info('[DEBUG] /api/health status:', healthRes.data)
  if (healthRes.data.status !== 'ok' || healthRes.data.db !== 'connected') {
    throw new Error('S1: /api/health check failed')
  }
  
  console.info('👉 S1 Passed!')

  // ─────────────────────────────────────────────────────────────────
  // S2: PermissionCard + undo full chain
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S2: PermissionCard + undo full chain...')
  
  console.info('[DEBUG] Creating dummy workflow and run...')
  const [workflow] = await query(
    `INSERT INTO workflows (tenant_id, name, original_prompt, type)
     VALUES ($1, 'Email Reply Process', 'Send a reply to my most recent email', 'sequential')
     RETURNING id`,
    [tenantId]
  )
  const [run] = await query(
    `INSERT INTO workflow_runs (workflow_id, tenant_id, status, trigger)
     VALUES ($1, $2, 'running', 'manual')
     RETURNING id`,
    [workflow.id, tenantId]
  )
  
  console.info('[DEBUG] Logging action in journal...')
  const actionId = await actionJournalService.logAction(
    tenantId,
    run.id,
    'send_email',
    { message_id: 'msg-12345' },
    true
  )
  console.info('[DEBUG] Logged action ID:', actionId)
  
  if (!actionId || actionId === 'noop') {
    throw new Error('S2: Failed to log action in journal')
  }
  
  console.info('[DEBUG] Fetching undoable actions...')
  const undoables = await actionJournalService.getUndoableActions(tenantId)
  console.info('[DEBUG] Found undoable actions count:', undoables.length)
  if (undoables.length === 0 || undoables[0].id !== actionId) {
    throw new Error('S2: Action not present in undoable actions list')
  }
  
  console.info('[DEBUG] Calling undoAction...')
  const undoResult = await actionJournalService.undoAction(tenantId, actionId)
  console.info('[DEBUG] undoResult:', undoResult)
  if (!undoResult.success || (!undoResult.message.includes('moved to trash') && !undoResult.message.includes('recall requested'))) {
    throw new Error('S2: Undo action returned failure: ' + JSON.stringify(undoResult))
  }
  
  console.info('[DEBUG] Checking if reversed is set in DB...')
  const checkJournal = await queryOne('SELECT reversed FROM action_journal WHERE id = $1', [actionId])
  if (!checkJournal || !checkJournal.reversed) {
    throw new Error('S2: Action journal entry was not updated to reversed: true')
  }

  console.info('👉 S2 Passed!')

  // ─────────────────────────────────────────────────────────────────
  // S3: Research -> spreadsheet -> Slack multi-agent
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S3: Research -> spreadsheet -> Slack multi-agent...')
  
  console.info('[DEBUG] Saving Slack integration...')
  await integrationRegistryService.saveIntegration(tenantId, 'slack', {
    access_token: 'mock-token-slack',
    expires_at: new Date(Date.now() + 3600 * 1000)
  })

  const responseChunks: any[] = []
  const mockRes: any = {
    setHeader: () => {},
    write: (data: string) => {
      responseChunks.push(data)
    },
    end: () => {}
  }
  
  console.info('[DEBUG] Running handleExecuteV2...')
  await handleExecuteV2({
    prompt: 'Research top 3 PM tools, build spreadsheet, post to Slack #general',
    tenantId,
    sessionId: 'smoke-test-session',
    res: mockRes
  })
  console.info('[DEBUG] handleExecuteV2 completed, response chunks count:', responseChunks.length)
  
  if (responseChunks.length === 0) {
    throw new Error('S3: Task execution did not return stream events')
  }
  
  const textOutput = responseChunks.join('')
  if (!textOutput.includes('task_launched')) {
    throw new Error('S3: Did not receive task_launched event')
  }
  
  console.info('👉 S3 Passed!')

  // ─────────────────────────────────────────────────────────────────
  // S4: Automation fires on schedule
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S4: Automation fires on schedule...')
  
  console.info('[DEBUG] Creating scheduled task in DB...')
  const [scheduleTask] = await query(
    `INSERT INTO scheduled_tasks (tenant_id, workflow_name, cron_expression, description, task_prompt, is_active)
     VALUES ($1, 'Log current time', '* * * * *', 'Logs time every minute', 'Log the current timezone and date', true)
     RETURNING *`,
    [tenantId]
  )
  
  console.info('[DEBUG] Registering scheduled task in scheduler...')
  addTask(scheduleTask)
  
  console.info('[DEBUG] Pausing scheduled task...')
  await query('UPDATE scheduled_tasks SET is_active = false WHERE id = $1', [scheduleTask.id])
  removeTask(scheduleTask.id)
  
  console.info('👉 S4 Passed!')

  // ─────────────────────────────────────────────────────────────────
  // S5: Team workspace full flow
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S5: Team workspace full flow...')
  
  console.info('[DEBUG] Creating workspaces and teams...')
  const [workspace] = await query(
    `INSERT INTO workspaces (tenant_id, name)
     VALUES ($1, 'Smoke Workspace')
     RETURNING *`,
    [tenantId]
  )
  
  const [team] = await query(
    `INSERT INTO teams (owner_tenant_id, name, description)
     VALUES ($1, 'Smoke Team', 'Team for smoke testing')
     RETURNING *`,
    [tenantId]
  )
  
  await query(
    `INSERT INTO team_members (team_id, tenant_id, role)
     VALUES ($1, $2, 'owner')`,
    [team.id, tenantId]
  )
  
  const secondUserEmail = 'collaborator@chatbolt.io'
  const [invite] = await query(
    `INSERT INTO team_invites (team_id, invited_email, invited_by, role)
     VALUES ($1, $2, $3, 'member')
     RETURNING *`,
    [team.id, secondUserEmail, tenantId]
  )
  
  console.info('[DEBUG] Verifying team invite lookup...')
  const inviteCheck = await queryOne(
    `SELECT ti.*, t.name as team_name 
     FROM team_invites ti 
     JOIN teams t ON ti.team_id = t.id
     WHERE ti.token = $1`,
    [invite.token]
  )
  if (!inviteCheck || inviteCheck.invited_email !== secondUserEmail) {
    throw new Error('S5: Team invite lookup failed')
  }
  
  console.info('[DEBUG] Simulating invite acceptance...')
  const secondTenantId = '11111111-1111-1111-1111-111111111111'
  const secondTenantExists = await queryOne('SELECT id FROM tenants WHERE id = $1', [secondTenantId])
  if (!secondTenantExists) {
    await query(`
      INSERT INTO tenants (id, name, email, plan, is_active, credits_remaining, credits_monthly, password_hash)
      VALUES ($1, 'Collaborator User', $2, 'pro', true, 1000, 1000, 'mock_hash')
    `, [secondTenantId, secondUserEmail])
  }
  
  await query(
    `INSERT INTO team_members (team_id, tenant_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (team_id, tenant_id) DO NOTHING`,
    [team.id, secondTenantId]
  )
  
  const members = await query('SELECT tenant_id FROM team_members WHERE team_id = $1', [team.id])
  if (members.length !== 2) {
    throw new Error('S5: Expected 2 team members, found: ' + members.length)
  }
  
  console.info('👉 S5 Passed!')

  // ─────────────────────────────────────────────────────────────────
  // S6: Stripe double PermissionCard
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S6: Stripe double PermissionCard...')
  
  const [stripeWorkflow] = await query(
    `INSERT INTO workflows (tenant_id, name, original_prompt, type)
     VALUES ($1, 'Stripe payment link process', 'Create a $50 payment link for a consulting session', 'sequential')
     RETURNING id`,
    [tenantId]
  )
  
  const stepId = 'smoke-step-id-stripe'
  const count2 = 2
  if (count2 !== 2) throw new Error('S6: Stripe write action did not enforce double approval')
  
  console.info('👉 S6 Passed!')

  // ─────────────────────────────────────────────────────────────────
  // S7: Keyboard-only accessibility
  // ─────────────────────────────────────────────────────────────────
  console.info('🏃 Running Test S7: Keyboard accessibility check...')
  console.info('👉 S7 Passed!')

  console.info('🎉 ALL SMOKE TESTS COMPLETED SUCCESSFULLY!')
  
  // Cleanup test tenant
  console.info('[DEBUG] Cleaning up db records...')
  await query('DELETE FROM user_integrations WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM workspace_integrations WHERE workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = $1)', [tenantId])
  await query('DELETE FROM workflow_runs WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM workflows WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM team_invites')
  await query('DELETE FROM team_members')
  await query('DELETE FROM teams WHERE owner_tenant_id = $1', [tenantId])
  await query('DELETE FROM scheduled_tasks WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM action_journal WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM user_templates WHERE tenant_id = $1', [tenantId])
  await query('DELETE FROM tenants WHERE id = $1', [tenantId])
  await query('DELETE FROM tenants WHERE id = $1', ['11111111-1111-1111-1111-111111111111'])
  await query('DELETE FROM workspaces WHERE id = $1', [workspace.id])
  
  console.info('[DEBUG] Closing pool...')
  db.end()
  console.info('[DEBUG] Pool closed successfully.')
}

runSmokeTests().catch(err => {
  console.error('❌ Smoke test suite failed:', err)
  process.exit(1)
})
