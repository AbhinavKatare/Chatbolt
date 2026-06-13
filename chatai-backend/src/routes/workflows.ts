import { logger } from '../services/logger.service';
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { 
  executeWorkflowLangGraph
} from '../services/langgraph-engine.service'
import { parseUserPrompt } from '../services/workflow-parser.service'
import { runEmitter } from '../services/sse.service'
import { transitionWorkflowRun } from '../services/workflow-state'
import { queueService } from '../services/queue.service'

const router = Router()

// All routes are protected
router.use(authMiddleware)

// 1. Parse a workflow from a prompt
router.post('/parse', async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

    // ── Skills Harvesting Autonomous Bypass check (Phase 2.4) ──
    try {
      const { skillsHarvestingService } = await import('../services/skills-harvesting.service')
      const matched = await skillsHarvestingService.matchHarvestedSkill(prompt, req.tenantId!)
      if (matched) {
        logger.info('[Workflows Route] Bypassed planning, returned matched optimal skill!')
        return res.json({
          workflow_name: matched.workflow_name,
          workflow_type: matched.workflow_type,
          agents: matched.agents,
          missing_inputs: [],
          thinking: 'Direct dynamic trigger match: Bypassed topological planning stage and resolved execution path instantly.'
        })
      }
    } catch (skillErr: any) {
      console.warn('[Workflows Route] Skills trigger matching check failed:', skillErr.message)
    }

    const config = await parseUserPrompt(prompt, req.tenantId!)
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Create a new workflow
router.post('/create', async (req, res) => {
  try {
    const { name, prompt, type, agents } = req.body
    
    // Save workflow
    const [workflow] = await query(
      `INSERT INTO workflows (tenant_id, name, original_prompt, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.tenantId, name, prompt, type]
    )

    // Save agents
    const createdAgents = []
    for (const agent of agents) {
      const config = {
        model: agent.model || '',
        temperature: agent.temperature || 0.3,
        max_tokens: agent.max_tokens || 2000,
        tools_needed: agent.tools_needed || []
      }
      
      const [newAgent] = await query(
        `INSERT INTO workflow_agents 
         (workflow_id, tenant_id, position, name, role, description, system_prompt, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [workflow.id, req.tenantId, agent.position, agent.name, agent.role, 
         agent.description, agent.system_prompt, JSON.stringify(config)]
      )
      createdAgents.push(newAgent)
    }

    res.json({ workflow, agents: createdAgents })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 3. List all workflows
router.get('/', async (req, res) => {
  try {
    const workflows = await query(
      `SELECT w.*, 
       (SELECT COUNT(*) FROM workflow_agents WHERE workflow_id = w.id) as agent_count
       FROM workflows w 
       WHERE w.tenant_id = $1 AND w.status != 'deleted'
       ORDER BY w.created_at DESC`,
      [req.tenantId]
    )
    res.json({ workflows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 4. Get full workflow detail
router.get('/:id', async (req, res) => {
  try {
    const workflow = await queryOne(
      'SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' })

    const agents = await query(
      'SELECT * FROM workflow_agents WHERE workflow_id = $1 ORDER BY position ASC',
      [req.params.id]
    )

    res.json({ workflow, agents })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 5. Run a workflow
router.post('/:id/run', async (req, res) => {
  try {
    const { inputs = {} } = req.body
    
    const runId = await queueService.enqueueWorkflowRun(req.params.id, req.tenantId!, inputs)
    
    res.json({ run_id: runId })
  } catch (err: any) {
    console.error('[POST /run] Error:', err.stack || err.message)
    res.status(500).json({ error: err.message })
  }
})

// 5a. List ALL runs across all workflows for this tenant (Workspace Hub)
router.get('/runs/all', async (req, res) => {
  try {
    const { limit = '50', status } = req.query
    const params: any[] = [req.tenantId]
    let statusFilter = ''
    if (status) {
      statusFilter = `AND wr.status = $2`
      params.push(status)
    }
    const runs = await query(
      `SELECT wr.*, w.name as workflow_name,
        (SELECT output_data FROM workflow_steps WHERE run_id = wr.id AND status = 'completed' ORDER BY step_number DESC LIMIT 1) as final_output
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       WHERE wr.tenant_id = $1 ${statusFilter}
       ORDER BY wr.created_at DESC
       LIMIT ${parseInt(String(limit))}`,
      params
    )
    res.json({ runs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 5b. Cancel a run
router.post('/runs/:runId/cancel', async (req, res) => {
  try {
    await query(
      "UPDATE workflow_runs SET status = 'CANCELLED', completed_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [req.params.runId, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 6. SSE Stream for a run
router.get('/:id/runs/:runId/stream', (req, res) => {
  const { runId } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
    if (event.type === 'workflow_done' || event.type === 'workflow_error') {
      runEmitter.removeListener(`run:${runId}`, listener)
      res.end()
    }
  }

  // Proactively send a full state snapshot on connection/reconnection (Post-Ship Monitoring Hook #4)
  query(
    `SELECT wr.*, w.name as workflow_name, w.original_prompt
     FROM workflow_runs wr
     LEFT JOIN workflows w ON wr.workflow_id = w.id
     WHERE wr.id = $1`,
    [runId]
  ).then(async (runs: any[]) => {
    if (runs.length > 0) {
      const activeRun = runs[0]
      const steps = await query(
        'SELECT * FROM workflow_steps WHERE run_id = $1 ORDER BY step_number ASC',
        [runId]
      )
      
      let receiptText = ''
      if (activeRun.task_receipt) {
        if (typeof activeRun.task_receipt === 'string') {
          try {
            const parsed = JSON.parse(activeRun.task_receipt)
            receiptText = parsed.text || parsed.receipt || activeRun.task_receipt
          } catch {
            receiptText = activeRun.task_receipt
          }
        } else if (typeof activeRun.task_receipt === 'object') {
          receiptText = activeRun.task_receipt.text || activeRun.task_receipt.receipt || JSON.stringify(activeRun.task_receipt)
        }
      }

      res.write(`data: ${JSON.stringify({
        type: 'run_snapshot',
        runId,
        status: activeRun.status,
        progress: activeRun.status === 'completed' ? 100 : 50,
        task_receipt: receiptText,
        prompt: activeRun.original_prompt || '',
        steps: steps.map((s: any) => ({
          id: s.agent_id,
          position: s.step_number,
          name: s.step_name || `Step ${s.step_number}`,
          role: s.role || 'assistant',
          status: s.status
        }))
      })}\n\n`)
    }
  }).catch((err: any) => {
    console.warn('[SSE] Failed to send re-connection snapshot:', err.message)
  })

  // Handle client reconnect catchup
  const lastSeqHeader = req.headers['last-event-id']
  const lastSeqQuery = req.query.last_seq_id || req.query.since_seq
  const rawSeq = lastSeqHeader ? String(lastSeqHeader) : (lastSeqQuery ? String(lastSeqQuery) : '0')
  const lastSeq = parseInt(rawSeq, 10)

  if (!isNaN(lastSeq) && lastSeq > 0) {
    const missedEvents = runEmitter.getEventsForRun(runId, lastSeq)
    for (const event of missedEvents) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  }

  runEmitter.on(`run:${runId}`, listener)

  req.on('close', () => {
    runEmitter.removeListener(`run:${runId}`, listener)
  })
})

// 7. List runs
router.get('/:id/runs', async (req, res) => {
  try {
    const runs = await query(
      'SELECT * FROM workflow_runs WHERE workflow_id = $1 AND tenant_id = $2 ORDER BY started_at DESC',
      [req.params.id, req.tenantId]
    )
    res.json({ runs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8. Get run detail
router.get('/:id/runs/:runId', async (req, res) => {
  try {
    const run = await queryOne(
      `SELECT r.*, w.original_prompt, w.name as workflow_name
       FROM workflow_runs r 
       JOIN workflows w ON r.workflow_id = w.id 
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [req.params.runId, req.tenantId]
    )
    if (!run) return res.status(404).json({ error: 'Run not found' })

    const steps = await query(
      'SELECT * FROM workflow_steps WHERE run_id = $1 ORDER BY step_number ASC',
      [req.params.runId]
    )

    res.json({ run, steps })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /:id/runs/:runId
router.patch('/:id/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params
    const { template_candidate } = req.body

    const [updated] = await query(
      `UPDATE workflow_runs 
       SET template_candidate = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [template_candidate, runId, req.tenantId]
    )

    if (!updated) {
      return res.status(404).json({ error: 'Run not found' })
    }

    res.json({ run: updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8.6 Get run timeline events
router.get('/:id/runs/:runId/timeline', async (req, res) => {
  try {
    const { traceService } = await import('../services/trace.service')
    const events = await traceService.getRunTimeline(req.params.runId)
    res.json({ events })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8.6b GET Mission Control / Agent Observatory V2 data
router.get('/:id/runs/:runId/observatory', async (req, res) => {
  try {
    const { runId } = req.params
    const run = await queryOne(
      'SELECT * FROM workflow_runs WHERE id = $1 AND tenant_id = $2',
      [runId, req.tenantId]
    )
    if (!run) return res.status(404).json({ error: 'Run not found' })

    const steps = await query(
      'SELECT * FROM workflow_steps WHERE run_id = $1 ORDER BY step_number ASC',
      [runId]
    )

    // Load active agent fleet heartbeats
    const heartbeats = await query(
      `SELECT h.*, wa.name, wa.role 
       FROM agent_heartbeats h
       JOIN workflow_agents wa ON h.agent_id = wa.id`
    )

    // Calculate ROI
    const { costIntelligenceService } = await import('../services/cost-intelligence.service')
    const roi = await costIntelligenceService.getWorkflowRunRoi(runId)

    // Track memory graph stats
    const entityStats = await query(
      `SELECT entity_type, COUNT(*) as count FROM memory_entities WHERE tenant_id = $1 GROUP BY entity_type`,
      [req.tenantId]
    )

    res.json({
      run,
      steps,
      heartbeats,
      roi,
      memory_growth: entityStats,
      live_agents: heartbeats.filter(h => h.status === 'running').length,
      decision_logs_count: steps.length
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8.5 Cancel run
router.post('/:id/runs/:runId/cancel', async (req, res) => {
  try {
    const runId = req.params.runId
    const workflowId = req.params.id

    // Verify run belongs to tenant
    const run = await queryOne(
      'SELECT tenant_id FROM workflow_runs WHERE id = $1',
      [runId]
    )
    if (!run || run.tenant_id !== req.tenantId) {
      return res.status(403).json({ error: 'Unauthorized to cancel this task run.' })
    }

    await transitionWorkflowRun(runId, 'CANCELLED', {
      errorMessage: 'Cancelled by user request',
      workflowId
    })
    res.json({ success: true, message: 'Workflow run cancelled successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8.6 Approve and resume paused step run
router.post('/:id/runs/:runId/approve', async (req, res) => {
  try {
    const runId = req.params.runId
    const workflowId = req.params.id

    // Check that the run is currently in "waiting" state
    const run = await queryOne(
      'SELECT status FROM workflow_runs WHERE id = $1 AND tenant_id = $2',
      [runId, req.tenantId]
    )
    if (!run) return res.status(404).json({ error: 'Workflow run not found' })
    if (run.status !== 'waiting') {
      return res.status(400).json({ error: `Cannot approve run in status: ${run.status}` })
    }

    // Get the currently waiting step
    const step = await queryOne(
      "SELECT id, agent_id FROM workflow_steps WHERE run_id = $1 AND status = 'waiting' ORDER BY step_number DESC LIMIT 1",
      [runId]
    )
    if (!step) return res.status(400).json({ error: 'No waiting step found for this run' })

    logger.info(`Approval received for action ${step.id} on run ${runId} — resuming.`)

    // 1. Record the STEP_APPROVED event in the event store
    await query(
      `INSERT INTO workflow_events (run_id, event_type, payload) VALUES ($1, $2, $3)`,
      [
        runId,
        'STEP_APPROVED',
        JSON.stringify({
          agent_id: step.agent_id,
          approved_at: new Date().toISOString(),
          approved_by: req.tenantId
        })
      ]
    )

    // 2. Transition workflow run state back to EXECUTING
    await transitionWorkflowRun(runId, 'EXECUTING', { workflowId })

    // 3. Reset step status in database to 'running'
    await query("UPDATE workflow_steps SET status = 'running' WHERE id = $1", [step.id])

    // 4. Resume execution in background thread
    const { executeWorkflow } = await import('../services/workflow-engine.service')
    executeWorkflow(workflowId, req.tenantId!, {}, runId).catch(err => {
      console.error('[Safety Gate] Background resume failed:', err)
    })

    res.json({ success: true, message: 'Step execution approved. Resuming workflow run...' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8.7 Reject and cancel paused step run
router.post('/:id/runs/:runId/reject', async (req, res) => {
  try {
    const runId = req.params.runId
    const workflowId = req.params.id

    // Check that the run is in "waiting" state
    const run = await queryOne(
      'SELECT status FROM workflow_runs WHERE id = $1 AND tenant_id = $2',
      [runId, req.tenantId]
    )
    if (!run) return res.status(404).json({ error: 'Workflow run not found' })
    if (run.status !== 'waiting') {
      return res.status(400).json({ error: `Cannot reject run in status: ${run.status}` })
    }

    // 1. Transition run to CANCELLED state
    await transitionWorkflowRun(runId, 'CANCELLED', {
      errorMessage: 'Step execution rejected by user safety check',
      workflowId
    })

    // 2. Update waiting steps to 'cancelled' in database
    await query(
      "UPDATE workflow_steps SET status = 'cancelled', completed_at = NOW() WHERE run_id = $1 AND status = 'waiting'",
      [runId]
    )

    res.json({ success: true, message: 'Step execution rejected and run cancelled successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 9. Update agent
router.patch('/:id/agents/:agentId', async (req, res) => {
  try {
    const { name, system_prompt, model, description } = req.body
    await query(
      `UPDATE workflow_agents 
       SET name = COALESCE($1, name), 
           system_prompt = COALESCE($2, system_prompt),
           config = config || jsonb_build_object('model', COALESCE($3, config->>'model')),
           description = COALESCE($4, description)
       WHERE id = $5 AND tenant_id = $6`,
      [name, system_prompt, model, description, req.params.agentId, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 10. Delete workflow
router.delete('/:id', async (req, res) => {
  try {
    await query(
      "UPDATE workflows SET status = 'deleted' WHERE id = $1 AND tenant_id = $2",
      [req.params.id, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 11. Save agent canvas position
router.patch('/:id/agents/:agentId/position', async (req, res) => {
  try {
    const { x, y } = req.body
    await query(
      `UPDATE workflow_agents 
       SET inputs_schema = inputs_schema || $1::jsonb
       WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify({ _pos_x: x, _pos_y: y }), req.params.agentId, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 12. Test single agent in isolation
router.post('/:id/agents/:agentId/test', async (req, res) => {
  try {
    const { inputs = {}, task } = req.body
    const agent = await queryOne(
      'SELECT * FROM workflow_agents WHERE id = $1 AND tenant_id = $2',
      [req.params.agentId, req.tenantId]
    )
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const { AGENT_EXECUTORS } = await import('../services/workflow-engine.service')
    const executor = AGENT_EXECUTORS[agent.role]
    if (!executor) return res.status(400).json({ error: `No executor for role: ${agent.role}` })

    const start = Date.now()
    const output = await executor(agent, {
      task: task || agent.description || 'Test run',
      user_inputs: inputs,
      previous_outputs: {},
      context: { test_mode: true },
    })
    const duration_ms = Date.now() - start

    res.json({ output, duration_ms })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 13. Get agent run history (last 10)
router.get('/:id/agents/:agentId/history', async (req, res) => {
  try {
    const steps = await query(
      `SELECT ws.*, wr.started_at as run_started
       FROM workflow_steps ws
       JOIN workflow_runs wr ON ws.run_id = wr.id
       WHERE ws.agent_id = $1
       ORDER BY ws.started_at DESC NULLS LAST
       LIMIT 10`,
      [req.params.agentId]
    )
    res.json({ steps })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 14. Forward user VNC click to active Playwright browser session
router.post('/:id/runs/:runId/browser/click-relative', async (req, res) => {
  try {
    const { xPercent, yPercent } = req.body
    if (xPercent === undefined || yPercent === undefined) {
      return res.status(400).json({ error: 'xPercent and yPercent are required' })
    }

    const { getOrCreateBrowserSession, captureScreenshot } = await import('../tools/browser.tool')
    const session = await getOrCreateBrowserSession(req.params.runId)
    if (!session || !session.page) {
      return res.status(404).json({ error: 'No active browser session found for this run' })
    }

    const page = session.page
    const viewport = page.viewportSize() || { width: 1280, height: 800 }
    const x = Math.round((xPercent / 100) * viewport.width)
    const y = Math.round((yPercent / 100) * viewport.height)

    logger.info(`[VNC Stream] Relative Click received: (${xPercent}%, ${yPercent}%) -> Pixel: (${x}px, ${y}px)`)
    
    // Click page at exact pixel coordinate
    await page.mouse.click(x, y)
    
    // Trigger visual refresh by capturing and broadcasting a new screenshot immediately
    const screenshotPath = await captureScreenshot(req.params.runId)
    
    // Find active agent step or workflow running steps to get the agent_id
    const stepCheck = await queryOne(
      "SELECT agent_id FROM workflow_steps WHERE run_id = $1 AND status = 'running' ORDER BY started_at DESC LIMIT 1",
      [req.params.runId]
    )
    const agentId = stepCheck?.agent_id || null

    runEmitter.emitEvent(req.params.runId, 'agent_screenshot', {
      agent_id: agentId,
      screenshot: screenshotPath,
      message: `User clicked on Sandbox at (${xPercent}%, ${yPercent}%)`
    })

    res.json({ success: true, x, y, screenshot: screenshotPath })
  } catch (err: any) {
    console.error('[Browser VNC Click] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
