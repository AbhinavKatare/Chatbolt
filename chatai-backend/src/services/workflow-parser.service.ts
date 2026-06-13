import { logger } from './logger.service';
import { callLLM, cleanEnvVar } from '../agents/base.agent'
import { getPrebuiltTemplate } from './templates'

const VALID_ROLES = ['researcher','writer','email-sender','scraper','data-processor','spreadsheet','code','api-caller','reporter']

function buildFallback(prompt: string) {
  return {
    workflow_name: 'AI Research & Report Pipeline',
    workflow_type: 'sequential',
    thinking: `Analyzing: "${prompt}". This requires research followed by synthesis.`,
    missing_inputs: [
      { field: 'topic', question: 'What specific topic should we research?', type: 'text', required: true }
    ],
    agents: [
      {
        position: 1,
        name: 'Research Agent',
        role: 'researcher',
        description: `Research the topic related to: ${prompt}`,
        system_prompt: `You are a senior research analyst. Your job is to gather comprehensive, accurate, and current information about the requested topic. Search multiple sources, verify facts, and present structured findings with sources cited. Always include: 1) Key facts and statistics 2) Recent developments 3) Expert opinions 4) Actionable insights.`,
        tools_needed: ['web_search'],
        inputs_from_user: [{ field: 'topic', question: 'What to research?', type: 'text', required: true }],
        inputs_from_previous: [],
        output_type: 'text',
        output_description: 'Structured research report with sources'
      },
      {
        position: 2,
        name: 'Writer Agent',
        role: 'writer',
        description: 'Write a clear, engaging report from the research findings',
        system_prompt: `You are a professional content writer. Take the research data provided and craft a compelling, well-structured report. Structure: 1) Executive Summary 2) Key Findings 3) Analysis 4) Recommendations 5) Conclusion. Use clear language suitable for a business audience.`,
        tools_needed: [],
        inputs_from_user: [],
        inputs_from_previous: ['Research Agent.report'],
        output_type: 'text',
        output_description: 'Polished written report'
      }
    ]
  }
}

export async function parseUserPrompt(prompt: string, tenantId: string) {
  const lowerPrompt = prompt.toLowerCase().trim()

  // ── INTENT CLARIFICATION GATE (Requirements Discovery) ──
  const isAmbiguous = lowerPrompt.length < 15 || lowerPrompt.split(/\s+/).length <= 3
  if (isAmbiguous && !lowerPrompt.includes('weather') && !lowerPrompt.includes('food')) {
    logger.info(`[Parser] 🔐 Intent Clarification Gate triggered: prompt is ambiguous. Requesting targets.`)
    return {
      workflow_name: 'Outcome Discovery & Setup',
      workflow_type: 'sequential',
      thinking: 'Evaluating goal intent. The prompt lacks key target specifications. Initiating requirements discovery.',
      missing_inputs: [
        { field: 'outcome_goal', question: 'What is the primary target outcome or objective you wish to achieve?', type: 'text', required: true },
        { field: 'industry_context', question: 'Which industry, company, or market context does this apply to?', type: 'text', required: false },
        { field: 'execution_budget', question: 'What is your maximum USD compute budget for this workflow?', type: 'number', required: false }
      ],
      agents: []
    }
  }

  const template = getPrebuiltTemplate(lowerPrompt)
  if (template) {
    logger.info(`[Parser] Found matching pre-built industry template: "${template.workflow_name}"`)
    return template
  }

  // Fast Simple Task Classifier (0ms latency bypass)
  const isSimpleRestaurant = lowerPrompt.includes('restaurant') || lowerPrompt.includes('food') || lowerPrompt.includes('cafe') || lowerPrompt.includes('dining') || lowerPrompt.includes('bar')
  const isSimpleWeather = lowerPrompt.includes('weather') || lowerPrompt.includes('temperature') || lowerPrompt.includes('rain') || lowerPrompt.includes('forecast')
  const isSimpleLookup = lowerPrompt.includes('youtube') || lowerPrompt.includes('twitter') || lowerPrompt.includes('channel') || lowerPrompt.includes('profile') || lowerPrompt.startsWith('who is') || lowerPrompt.startsWith('what is') || lowerPrompt.startsWith('where is') || lowerPrompt.startsWith('find ')

  if (isSimpleRestaurant || isSimpleWeather || isSimpleLookup) {
    logger.info(`[Parser] ⚡ Direct Simple Task detected: "${prompt}". Activating 0ms fast-bypass.`)
    return {
      workflow_name: 'Direct Tool Execution',
      workflow_type: 'simple',
      thinking: `Classified as high-speed direct execution. Bypassing heavy multi-agent planning to execute tools immediately.`,
      missing_inputs: [],
      agents: [
        {
          position: 1,
          name: 'Direct Tool Executor',
          role: 'researcher',
          description: prompt,
          system_prompt: `You are a high-speed direct tool execution agent. Search the web, scrape the primary source, and output the absolute highest-fidelity direct answer to the user's question without preambles or long explanations. Focus on accuracy, clean lists, and direct usefulness.`,
          tools_needed: ['web_search'],
          inputs_from_user: [],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Direct query response and statistics',
          config: {
            workflow_type: 'simple'
          }
        }
      ]
    }
  }

  const systemPrompt = `You are the ChatAI Workflow Architect.
  Decompose the user request into a sequence of specialized AI agents.
  
  Available roles: researcher, writer, email-sender, scraper, data-processor, spreadsheet, code, api-caller, reporter
  
  Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
  {
    "workflow_name": "descriptive name",
    "workflow_type": "sequential",
    "thinking": "1-2 sentence explanation of your plan",
    "missing_inputs": [{"field": "key", "question": "What value is needed?", "type": "text", "required": true}],
    "agents": [
      {
        "position": 1,
        "name": "Agent Name",
        "role": "researcher",
        "description": "Specific task (1 sentence)",
        "system_prompt": "Detailed 200+ word role instructions",
        "tools_needed": ["web_search"],
        "inputs_from_user": [{"field": "topic", "question": "?", "type": "text", "required": true}],
        "inputs_from_previous": [],
        "output_type": "text",
        "output_description": "What this agent produces"
      }
    ]
  }
  
  OUTPUT EXACTLY ONE VALID JSON OBJECT. NO TRAILING COMMAS. DO NOT INCLUDE ANY MARKDOWN FENCES OR EXPLANATION OUTSIDE THE JSON.`

  const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
  const modelToUse = kimiKey ? 'moonshotai/kimi-k2.6' : (process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai')

  let lastError: any = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { content: response } = await callLLM(
        modelToUse,
        systemPrompt,
        `User Request: ${prompt}`
      )
      logger.info(`[Parser] Attempt ${attempt + 1} raw response length: ${response.length}`)

      // Strip markdown code fences if present
      const stripped = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim()

      // Find outermost JSON object
      const startIdx = stripped.indexOf('{')
      const endIdx = stripped.lastIndexOf('}')
      if (startIdx === -1 || endIdx === -1) throw new Error('No JSON object in response')

      let jsonStr = stripped.substring(startIdx, endIdx + 1)
      // Fix common LLM JSON errors like trailing commas before closing braces/brackets
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1')

      const parsed = JSON.parse(jsonStr)

      // Validate required fields
      if (!parsed.workflow_name) throw new Error('Missing workflow_name')
      if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) throw new Error('Missing agents array')

      // Ensure every agent has required fields + valid role
      for (const agent of parsed.agents) {
        if (!agent.role || !VALID_ROLES.includes(agent.role)) {
          agent.role = 'researcher' // safe default
        }
        if (!agent.system_prompt || agent.system_prompt.length < 50) {
          agent.system_prompt = `You are a specialized ${agent.role} agent. Complete your assigned task: ${agent.description || 'execute your role'}.`
        }
        agent.inputs_from_user = agent.inputs_from_user || []
        agent.inputs_from_previous = agent.inputs_from_previous || []
        agent.tools_needed = agent.tools_needed || []
      }

      // Ensure required top-level fields
      parsed.thinking = parsed.thinking || `Workflow designed for: ${prompt}`
      parsed.missing_inputs = parsed.missing_inputs || []
      parsed.workflow_type = parsed.workflow_type || 'sequential'

      logger.info(`[Parser] ✅ Parsed ${parsed.agents.length} agents successfully`)
      return parsed

    } catch (err: any) {
      lastError = err
      console.warn(`[Parser] Attempt ${attempt + 1} failed: ${err.message}`)
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000))
    }
  }

  // All 3 attempts failed — use deterministic fallback
  console.warn('[Parser] ⚠ All LLM attempts failed, using fallback config')
  return buildFallback(prompt)
}
