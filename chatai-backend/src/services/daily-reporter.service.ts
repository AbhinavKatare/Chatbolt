import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { callLLM } from '../agents/base.agent';

/**
 * Daily Reporter Service
 * Aggregates daily metrics from workflows and agents, 
 * formats it via LLM, and saves it to the database.
 */

export async function generateDailyReport(tenantId: string) {
  // We'll calculate metrics for "yesterday"
  const startOfYesterday = new Date();
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);

  const endOfYesterday = new Date();
  endOfYesterday.setDate(endOfYesterday.getDate() - 1);
  endOfYesterday.setHours(23, 59, 59, 999);

  const dateStr = startOfYesterday.toISOString().split('T')[0];

  // 1. Gather Workflow Metrics
  const { rows: wfRows } = await db.query(
    `SELECT status, COUNT(*) as count, SUM(duration_ms) as total_duration, SUM(api_calls_used) as total_api_calls, SUM(credits_used) as total_credits
     FROM workflow_runs 
     WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3 
     GROUP BY status`,
    [tenantId, startOfYesterday, endOfYesterday]
  );

  let totalWorkflows = 0;
  let successfulWorkflows = 0;
  let apiCallsUsed = 0;
  let creditsUsed = 0;

  wfRows.forEach(r => {
    const count = parseInt(r.count, 10);
    totalWorkflows += count;
    if (r.status === 'completed') successfulWorkflows += count;
    if (r.total_api_calls) apiCallsUsed += parseInt(r.total_api_calls, 10);
    if (r.total_credits) creditsUsed += parseInt(r.total_credits, 10);
  });

  const metrics = {
    workflows: {
      total_runs: totalWorkflows,
      success_rate: totalWorkflows > 0 ? (successfulWorkflows / totalWorkflows) * 100 : 0,
      api_calls_used: apiCallsUsed,
      credits_used: creditsUsed
    },
    system: {
      timestamp: new Date().toISOString(),
      report_date: dateStr
    }
  };

  // 2. AI-Generated Executive Summary
  const prompt = `You are an Executive Business Analyst. Summarize the following operational metrics for ${dateStr} into a concise, professional paragraph for a CEO. Highlight success rates and efficiency.
  
  Metrics: ${JSON.stringify(metrics)}`
  
  const { content: summary } = await callLLM('', 'You are a business intelligence analyst.', prompt);

  // 3. Save to Database
  const id = uuidv4();
  await db.query(
    `INSERT INTO daily_reports (id, tenant_id, report_date, workflows_run, api_calls_used, credits_used, summary, metrics) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, tenantId, startOfYesterday, totalWorkflows, apiCallsUsed, creditsUsed, summary, JSON.stringify(metrics)]
  );

  return { id, summary, metrics };
}

export async function getDailyReports(tenantId: string, limit = 10) {
  const { rows } = await db.query(
    `SELECT * FROM daily_reports WHERE tenant_id = $1 ORDER BY report_date DESC LIMIT $2`,
    [tenantId, limit]
  );
  return rows;
}
