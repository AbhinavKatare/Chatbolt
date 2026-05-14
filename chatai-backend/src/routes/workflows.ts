import { Router } from 'express';
import { db } from '../db';
import { runWorkflow } from '../services/workflow-engine.service';

const router = Router();

// POST /workflows/parse
router.post('/parse', async (req, res) => {
  try {
    const { prompt } = req.body;
    // Mocking the Qwen3 response based on the spec
    const mockConfig = {
      workflow_name: "Generated Workflow",
      workflow_type: "research",
      agents_needed: [
        {
          id: "temp-agent-1",
          name: "Researcher",
          role: "researcher",
          description: "Gathers information",
          inputs_needed: ["topic"],
          outputs: ["summary"],
          apis_required: ["search_api"],
          runs_on: "once"
        }
      ],
      missing_info: [
        {
          field: "topic",
          question: "What topic should we research?",
          type: "text",
          required: true
        }
      ],
      estimated_duration: "2 minutes",
      complexity: "simple"
    };
    
    res.json(mockConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /workflows/create
router.post('/create', async (req, res) => {
  try {
    const { name, type, agents, config } = req.body;
    // @ts-ignore
    const tenant_id = req.user?.tenant_id || '00000000-0000-0000-0000-000000000000'; // mock auth
    
    const { rows: wfRows } = await db.query(
      'INSERT INTO workflows (tenant_id, name, type, config, agent_count) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tenant_id, name, type, JSON.stringify(config || {}), agents?.length || 0]
    );
    const workflowId = wfRows[0].id;

    if (agents && agents.length > 0) {
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        await db.query(
          'INSERT INTO workflow_agents (workflow_id, tenant_id, position, name, role, description, system_prompt, model) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [workflowId, tenant_id, i + 1, a.name, a.role, a.description, a.system_prompt || '', a.model || 'qwen/qwen3-235b-a22b:free']
        );
      }
    }

    res.json({ workflow_id: workflowId, status: 'building' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /workflows
router.get('/', async (req, res) => {
  try {
    // @ts-ignore
    const tenant_id = req.user?.tenant_id || '00000000-0000-0000-0000-000000000000';
    const { rows } = await db.query('SELECT id, name, status, last_run_at, run_count, agent_count FROM workflows WHERE tenant_id = $1', [tenant_id]);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /workflows/:id/run
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const tenant_id = req.user?.tenant_id || '00000000-0000-0000-0000-000000000000';
    const inputData = req.body.input_data || {};
    
    // In a real scenario, we might trigger this async and return a run_id immediately to stream via SSE
    // For now, we will await the engine
    const finalData = await runWorkflow(id, tenant_id, inputData);
    
    res.json({ status: 'completed', output: finalData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
