import { callLLM } from '../agents/base.agent'

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

  let lastError: any = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { content: response } = await callLLM(
        'Qwen/WebWorld-8B:featherless-ai',
        systemPrompt,
        `User Request: ${prompt}`
      )
      console.log(`[Parser] Attempt ${attempt + 1} raw response length: ${response.length}`)

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

      console.log(`[Parser] ✅ Parsed ${parsed.agents.length} agents successfully`)
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
