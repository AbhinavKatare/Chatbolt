import { logger } from '../services/logger.service';
import { db } from '../db'
import { callLLM, safeParseJSON, cleanEnvVar } from './base.agent'
import { traceService } from '../services/trace.service'

const VALID_ROLES = [
  'researcher',
  'writer',
  'email-sender',
  'scraper',
  'data-processor',
  'spreadsheet',
  'code',
  'api-caller',
  'reporter',
  'ci-cd',
  'webhook',
  'seo',
  'social',
  'cro',
  'security',
  'cloudops',
  'legal',
  'database',
  'smartcontract',
  'multimedia',
  'meeting'
]

export interface PlannerAgentNode {
  position: number
  name: string
  role: string
  description: string
  system_prompt: string
  tools_needed: string[]
  inputs_from_user: any[]
  inputs_from_previous: string[]
  output_type: string
  output_description: string
  config?: {
    model?: string
    temperature?: number
    max_tokens?: number
    retry_policy?: {
      max_retries: number
      backoff: 'exponential' | 'linear'
    }
    timeout_policy?: {
      timeout_sec: number
    }
    validation_requirements?: {
      schema_check: boolean
      semantic_check: boolean
      required_fields?: string[]
    }
    memory_requirements?: {
      compressed_short_term: boolean
      episodic_recall: boolean
    }
  }
}

export interface PlannerOutput {
  workflow_name: string
  description: string
  complexity: 'low' | 'medium' | 'high'
  agents: PlannerAgentNode[]
}

/**
 * High-reasoning DAG planner agent that interprets open-ended goals,
 * decomposes them into a series of topological execution nodes (DAG),
 * inserts the workflow & agents into the database, and returns the workflow ID.
 */
export async function runPlanner(prompt: string, tenantId: string, customModel?: string): Promise<string> {
  logger.info(`[Planner] Starting planner for prompt: "${prompt}"...`)

  const systemPrompt = `You are Chatbolt's Chief Autonomous Workflow Architect and Cognitive Systems Planner.
Your role is to interpret open-ended user goals, parse execution constraints, and decompose the task into a robust, self-healing, topologically ordered Directed Acyclic Graph (DAG) represented as sequential agent steps.

Available Agent Roles (Choose appropriately based on required capabilities):
1. researcher: Specialized in searching the web. Tools: ['web_search']
2. writer: Specialized in copywriting, report composition, or writing drafts. Tools: []
3. scraper: Specialized in scraping structured/unstructured HTML pages. Tools: ['scraper', 'browser']
4. email-sender: Specialized in formatting and sending outgoing emails. Tools: ['send_email']
5. data-processor: Specialized in sorting, analyzing, or cleaning data. Tools: []
6. spreadsheet: Specialized in writing/updating sheets. Tools: ['spreadsheet']
7. code: Specialized in executing sandboxed code blocks or logic. Tools: ['code_executor']
8. api-caller: Specialized in making external HTTP requests. Tools: ['api_caller']
9. reporter: Specialized in compiling summaries, markdown results, or final reports. Tools: []
10. ci-cd: Specialized in reading GitHub repositories, fixing broken build logs, and committing code fixes autonomously. Tools: ['github']
11. webhook: Specialized in triggering Zapier, Make.com, or custom webhooks to alert external systems. Tools: ['webhook']
12. seo: Specialized in programmatic SEO, generating highly optimized landing pages and blogs based on keywords. Tools: []
13. social: Specialized in analyzing brand sentiment and generating viral social media posts. Tools: ['web_search']
14. cro: Specialized in scraping live webpages and generating React code variants for A/B testing. Tools: ['scraper']
15. security: Specialized in Static Application Security Testing (SAST), finding OWASP vulnerabilities and patching code. Tools: ['github']
16. cloudops: Specialized in FinOps, analyzing cloud architecture metrics and generating cost-saving optimizations. Tools: []
17. legal: Specialized in Corporate Law and Compliance, analyzing contracts/policies against GDPR, SOC2, etc. Tools: []
18. database: Specialized in database architecture, analyzing slow queries and proposing indexes and schema migrations. Tools: []
19. smartcontract: Specialized in Web3 Security, auditing Solidity/Rust smart contracts for vulnerabilities like reentrancy. Tools: ['github']
20. multimedia: Specialized in multimodal processing, analyzing images, audio, and video frames. Tools: []
21. meeting: Specialized in parsing raw meeting transcripts into structured action items and executive summaries. Tools: []

GUIDELINES FOR DECOMPOSITION:
- AVOID over-fragmentation: Keep steps concise and meaningful. Do not create 10 steps if 3 can accomplish the job.
- AVOID recursive loops: Every agent's inputs_from_previous must reference preceding agents ONLY.
- Topological Ordering: Order the agents sequentially so that all dependencies of agent N are computed in steps 1 to N-1.
- Complete Details: Generate deep, precise, 200+ word system prompts for each agent, specifying their persona, expected inputs, required outputs, and edge-case behaviors.

For EACH agent in the DAG, you MUST define:
1. role: One of the valid roles listed above.
2. tools_needed: Array of tools (e.g. ['web_search'], ['scraper'], ['browser'], ['send_email'], etc.)
3. inputs_from_previous: Array of string references indicating which preceding agents this agent depends on (e.g. ["Research Agent.report", "Scraper Agent.html"]).
4. config: Includes retry_policy (max_retries, backoff), timeout_policy (timeout_sec), validation_requirements (schema_check, semantic_check, required_fields), and memory_requirements.

Return ONLY a valid JSON object (no markdown, no code fences, no extra explanation) with this structure:
{
  "workflow_name": "Resilient Outbound Outreach Pipeline",
  "description": "Decomposes search, scraping, content compilation, validation, and email outreach.",
  "complexity": "medium",
  "agents": [
    {
      "position": 1,
      "name": "Research Agent",
      "role": "researcher",
      "description": "Find contacts and pricing structures for Slack.",
      "system_prompt": "You are a professional research analyst...",
      "tools_needed": ["web_search"],
      "inputs_from_user": [],
      "inputs_from_previous": [],
      "output_type": "report",
      "output_description": "Search findings of Slack pricing and contact details",
      "config": {
        "retry_policy": { "max_retries": 3, "backoff": "exponential" },
        "timeout_policy": { "timeout_sec": 180 },
        "validation_requirements": { "schema_check": true, "semantic_check": true, "required_fields": ["report"] },
        "memory_requirements": { "compressed_short_term": true, "episodic_recall": true }
      }
    }
  ]
}

DO NOT emit any text before or after the JSON block. Ensure all JSON brackets are matched, with no trailing commas.`

  // Decide which model to use: prefer KIMI-k2.6, then mistral-large-latest, then Qwen free tier.
  const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
  const modelToUse = customModel || (kimiKey ? 'moonshotai/kimi-k2.6' : (process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'))

  let lastError: any = null
  let planOutput: PlannerOutput | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { content: rawRes } = await callLLM(
        modelToUse,
        systemPrompt,
        `User Prompt/Goal: "${prompt}"`,
        3000,
        1,
        undefined,
        'PlannerAgent'
      )

      const parsed = safeParseJSON(rawRes) as PlannerOutput

      if (!parsed.workflow_name || !parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length === 0) {
        throw new Error('Parsed object is missing workflow_name or agents array')
      }

      planOutput = parsed
      break
    } catch (err: any) {
      lastError = err
      console.warn(`[Planner] Attempt ${attempt} failed to parse planner output: ${err.message}`)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  if (!planOutput) {
    throw new Error(`Planner failed to generate a valid DAG graph: ${lastError?.message || 'Unknown error'}`)
  }

  logger.info(`[Planner] Plan successfully generated. Decomposing into ${planOutput.agents.length} nodes...`)

  // Save the workflow
  const { rows: wfRows } = await db.query(
    `INSERT INTO workflows (tenant_id, name, description, original_prompt, type, complexity, agent_count, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      tenantId,
      planOutput.workflow_name,
      planOutput.description,
      prompt,
      'sequential',
      planOutput.complexity,
      planOutput.agents.length,
      'active'
    ]
  )
  const workflowId = wfRows[0].id

  // Save the workflow agents
  for (const agent of planOutput.agents) {
    if (!VALID_ROLES.includes(agent.role)) {
      agent.role = 'researcher' // Fallback
    }

    const agentConfig = {
      model: agent.config?.model || 'Qwen/WebWorld-8B:featherless-ai',
      temperature: agent.config?.temperature ?? 0.3,
      max_tokens: agent.config?.max_tokens ?? 2000,
      tools_needed: agent.tools_needed || [],
      retry_policy: agent.config?.retry_policy || { max_retries: 2, backoff: 'exponential' },
      timeout_policy: agent.config?.timeout_policy || { timeout_sec: 180 },
      validation_requirements: agent.config?.validation_requirements || { schema_check: true, semantic_check: true },
      memory_requirements: agent.config?.memory_requirements || { compressed_short_term: true, episodic_recall: true }
    }

    await db.query(
      `INSERT INTO workflow_agents 
       (workflow_id, tenant_id, position, name, role, description, system_prompt, config, inputs_from_user, inputs_from_previous, output_type, output_description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        workflowId,
        tenantId,
        agent.position,
        agent.name,
        agent.role,
        agent.description,
        agent.system_prompt,
        JSON.stringify(agentConfig),
        JSON.stringify(agent.inputs_from_user || []),
        JSON.stringify(agent.inputs_from_previous || []),
        agent.output_type,
        agent.output_description,
        'idle'
      ]
    )
  }

  logger.info(`[Planner] ✅ Workflow ${workflowId} and agents inserted successfully into DB.`)
  return workflowId
}
