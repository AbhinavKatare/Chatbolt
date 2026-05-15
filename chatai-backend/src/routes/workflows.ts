import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { 
  executeWorkflowLangGraph
} from '../services/langgraph-engine.service'
import { parseUserPrompt } from '../services/workflow-parser.service'
import { runEmitter } from '../services/sse.service'

const router = Router()

// All routes are protected
router.use(authMiddleware)

// 1. Parse a workflow from a prompt
router.post('/parse', async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

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
    
    const result = await executeWorkflowLangGraph(req.params.id, req.tenantId!, inputs)
    
    if (!result || !result.run_id) {
      return res.status(500).json({ error: 'Workflow engine did not return a run_id' })
    }

    res.json({ run_id: result.run_id })
  } catch (err: any) {
    console.error('[POST /run] Error:', err.stack || err.message)
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
      'SELECT * FROM workflow_runs WHERE id = $1 AND tenant_id = $2',
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

export default router
