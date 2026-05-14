import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getAgentExecutor, AgentContext } from '../agents';

/**
 * Workflow Engine Service
 * Orchestrates multi-agent workflows defined by the user.
 */

// Types for Agent responses and intermediate state
type AgentOutput = Record<string, any>;

export async function runWorkflow(workflowId: string, tenantId: string, inputData: Record<string, any> = {}) {
  // 1. Load workflow + all agents in order
  const { rows: workflowRows } = await db.query('SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2', [workflowId, tenantId]);
  if (workflowRows.length === 0) throw new Error('Workflow not found');
  const workflow = workflowRows[0];

  const { rows: agents } = await db.query('SELECT * FROM workflow_agents WHERE workflow_id = $1 ORDER BY position ASC', [workflowId]);
  
  if (agents.length === 0) throw new Error('No agents configured for this workflow');

  // Load Vault Keys securely for this tenant
  const { rows: vaultRows } = await db.query('SELECT service_name, key_encrypted FROM user_api_vault WHERE tenant_id = $1 AND is_valid = true', [tenantId]);
  const vaultKeys: Record<string, string> = {};
  vaultRows.forEach(row => {
    // In a real system, you would decrypt 'key_encrypted' here using a master KMS key
    vaultKeys[row.service_name] = row.key_encrypted; 
  });

  // 2. Create run record
  const { rows: runRows } = await db.query(
    'INSERT INTO workflow_runs (workflow_id, tenant_id, status, input_data) VALUES ($1, $2, $3, $4) RETURNING *',
    [workflowId, tenantId, 'running', JSON.stringify(inputData)]
  );
  const run = runRows[0];

  // 3. Execute agents sequentially
  let currentData = { ...inputData };
  let apiCallsUsed = 0;

  for (const agent of agents) {
    // Update status
    await db.query('UPDATE workflow_agents SET status = $1 WHERE id = $2', ['running', agent.id]);
    
    const { rows: stepRows } = await db.query(
      'INSERT INTO workflow_steps (run_id, agent_id, step_number, status, input_data, started_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
      [run.id, agent.id, agent.position, 'running', JSON.stringify(currentData)]
    );
    const stepId = stepRows[0].id;

    let output: AgentOutput = {};
    let stepError = null;
    let stepDuration = 0;

    try {
      // Build Agent Context
      const context: AgentContext = {
        workflowId,
        runId: run.id,
        tenantId,
        inputData: currentData,
        agentConfig: agent,
        vaultKeys
      };

      // Resolve and Execute the appropriate microservice
      const executor = getAgentExecutor(agent.role);
      const result = await executor(context);

      if (!result.success) {
        throw new Error(result.error || 'Unknown agent error');
      }

      output = result.data;
      stepDuration = result.metrics.duration_ms;
      apiCallsUsed += result.metrics.api_calls;

    } catch (err: any) {
      stepError = err.message;
    }

    // Pass output to next agent
    currentData = { ...currentData, [`agent_${agent.position}_output`]: output };
    
    // Save step result
    await db.query(
      'UPDATE workflow_steps SET status = $1, output_data = $2, error_message = $3, completed_at = NOW(), duration_ms = $4 WHERE id = $5',
      [stepError ? 'failed' : 'completed', JSON.stringify(output), stepError, stepDuration, stepId]
    );

    await db.query('UPDATE workflow_agents SET status = $1, last_output = $2, run_count = run_count + 1 WHERE id = $3', 
      [stepError ? 'error' : 'idle', JSON.stringify(output), agent.id]
    );

    if (stepError) {
      // If a step fails, the whole workflow fails
      await db.query('UPDATE workflow_runs SET status = $1, error_message = $2, completed_at = NOW(), duration_ms = $3, output_data = $4 WHERE id = $5', 
        ['failed', `Agent ${agent.name} failed: ${stepError}`, Date.now() - run.started_at.getTime(), JSON.stringify(currentData), run.id]);
      return currentData;
    }
  }
  
  // 4. Save final output + update run status
  await db.query(
    'UPDATE workflow_runs SET status = $1, output_data = $2, completed_at = NOW(), duration_ms = $3, api_calls_used = $4 WHERE id = $5',
    ['completed', JSON.stringify(currentData), Date.now() - run.started_at.getTime(), apiCallsUsed, run.id]
  );
  
  return currentData;
}
