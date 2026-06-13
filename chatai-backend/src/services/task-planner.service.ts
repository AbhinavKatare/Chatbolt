import { logger } from './logger.service';
import { callLLM, safeParseJSON } from '../agents/base.agent'

export interface TaskPlanNode {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting'
  role?: string
  tools_needed?: string[]
  system_prompt?: string
  depends_on?: string[]
  parallel_group?: string
}

export interface HierarchicalPlan {
  goal: string
  sub_goals: {
    id: string
    title: string
    description: string
    milestones: string[]
  }[]
  steps: TaskPlanNode[]
}

class TaskPlannerService {
  /**
   * Decomposes a user prompt into a hierarchical execution plan with dependency resolution.
   */
  async generatePlan(prompt: string, tenantId: string): Promise<HierarchicalPlan> {
    logger.info(`[Task Planner] Generating hierarchical plan for: "${prompt}"...`)

    const systemPrompt = `You are the Chatbolt Hierarchical Task Planner.
    Analyze the user prompt and decompose it into a tree structure:
    1. Overall Goal
    2. Sub-goals (major milestones/achievements)
    3. Atomic steps (individual agent actions that execute specific roles with tools).

    Each step must specify:
    - id: unique string identifier (e.g. "step1", "step2")
    - title: short step description
    - role: one of the allowed agent roles: 'researcher', 'writer', 'email-sender', 'scraper', 'data-processor', 'spreadsheet', 'code', 'api-caller', 'reporter', 'stripe', 'linear', 'github', 'hubspot'
    - tools_needed: array of tools like ['web_search', 'scraper', 'spreadsheet', 'code_executor'] or []
    - system_prompt: detailed instruction prompt tailored for the agent executing this step.
    - depends_on: array of step IDs that must finish before this step can start (e.g., ["step1"])
    - parallel_group: (optional) group identifier if multiple steps have no dependencies and can be run concurrently (e.g. "group1")

    Sequential Chaining Guidelines:
    If the user's prompt contains sequential chaining intent phrases like 'then', 'after that', 'and then send', or 'once that is done', you MUST decompose it into sequential steps where each step depends on the previous step (e.g., step 2 depends_on ["step1"]). In the description and system_prompt of step[N], you must explicitly instruct it to read and use the output/results of step[N-1] (e.g., "take the results of step1 and...").

    Return ONLY valid JSON (no markdown fences, no other text) matching this format:
    {
      "goal": "Overall goal name",
      "sub_goals": [
        {
          "id": "sg1",
          "title": "Sub-goal title",
          "description": "Sub-goal description",
          "milestones": ["step1"]
        }
      ],
      "steps": [
        {
          "id": "step1",
          "title": "Gather competitor list",
          "description": "Search web for top competitors",
          "status": "pending",
          "role": "researcher",
          "tools_needed": ["web_search"],
          "system_prompt": "You are a researcher. Find invoicing competitors...",
          "depends_on": []
        },
        {
          "id": "step2",
          "title": "Synthesize spreadsheet",
          "description": "Compile competitors in CSV",
          "status": "pending",
          "role": "spreadsheet",
          "tools_needed": ["spreadsheet"],
          "system_prompt": "You are a spreadsheet specialist. Write the competitors found by step1 into a spreadsheet...",
          "depends_on": ["step1"]
        }
      ]
    }`

    const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'

    try {
      let hydratedUserContext = ''
      try {
        const { hydrateContext } = await import('./memory.service')
        // 500ms timeout gate for context hydration
        const timeoutPromise = new Promise<string>((resolve) => setTimeout(() => resolve(''), 500))
        const queryPromise = hydrateContext(tenantId, 'planner', prompt)
        hydratedUserContext = await Promise.race([queryPromise, timeoutPromise])
      } catch (memErr: any) {
        console.warn('[Task Planner] Context hydration failed:', memErr.message)
      }

      let finalSystemPrompt = systemPrompt
      if (hydratedUserContext && hydratedUserContext.trim()) {
        // Strip out the bracket header if it exists so we format it exactly as specified
        const cleanContext = hydratedUserContext.replace('[RECALLED SESSION FACTS & PREFERENCES]', '').trim()
        finalSystemPrompt = `Known context about this user:\n${cleanContext}\n\n${systemPrompt}`
      }

      const { content: rawRes } = await callLLM(
        modelToUse, 
        finalSystemPrompt, 
        `Decompose prompt: "${prompt}"`
      )
      const parsed = safeParseJSON(rawRes) as HierarchicalPlan

      if (!parsed.goal || !parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error('Invalid hierarchical plan schema')
      }

      return parsed
    } catch (err: any) {
      console.warn('[Task Planner] LLM generation failed, running fallback planner:', err.message)
      return this.buildFallbackPlan(prompt)
    }
  }

  private buildFallbackPlan(prompt: string): HierarchicalPlan {
    return {
      goal: 'Sequential Task Execution',
      sub_goals: [
        {
          id: 'sg1',
          title: 'Initial Execution Phase',
          description: 'Gather inputs and compile research',
          milestones: ['step1', 'step2']
        }
      ],
      steps: [
        {
          id: 'step1',
          title: 'Research Analysis',
          description: 'Crawl relevant sources',
          status: 'pending',
          role: 'researcher',
          tools_needed: ['web_search'],
          system_prompt: `You are a researcher analyst. Extract facts related to: "${prompt}".`,
          depends_on: []
        },
        {
          id: 'step2',
          title: 'Outcome Drafting',
          description: 'Synthesize outcomes and write report',
          status: 'pending',
          role: 'writer',
          tools_needed: [],
          system_prompt: 'Take the research and outline the final summary.',
          depends_on: ['step1']
        }
      ]
    }
  }
}

export const taskPlannerService = new TaskPlannerService()
