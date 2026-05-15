import { nvidia, embedText } from './rag.service'
import { query } from '../db'
import { v4 as uuid } from 'uuid'
import { llm } from './llm-orchestrator.service'

interface AutopilotInput {
  company_type: string
  description: string
  goals: string
}

interface AgentConfig {
  name: string
  description: string
  system_prompt: string
  escalation_keywords: string[]
  welcome_message: string
  suggested_questions: string[]
  agent_type: string
}

const AUTOPILOT_PROMPT = (input: AutopilotInput) => `You are a world-class AI solutions architect.
Configure exactly 5 specialized AI agents for: ${input.company_type}
Description: ${input.description}
Strategic Goals: ${input.goals}

Generate config for these roles:
1. support_bot - Customer satisfaction and problem resolution
2. lead_qualifier - Conversion optimization and sales lead capture
3. ops_reporter - Internal reporting and daily performance tracking
4. outreach_agent - Proactive customer engagement via WhatsApp/Email
5. booking_agent - Direct scheduling and demo coordination

Return JSON array of 5 objects with: name, description, system_prompt (200 words), escalation_keywords (5), welcome_message, suggested_questions (3 sample Q&A pairs), agent_type.`;

export async function generateAutopilotAgents(
  tenantId: string,
  input: AutopilotInput
): Promise<{ agents: any[]; setup_complete: boolean }> {
  
  // 1. Generate via NVIDIA NIM (Nemotron for high-fidelity JSON)
  const aiResponse = await llm.chat({
    model: 'NEMOTRON',
    messages: [
      { role: 'system', content: 'Output ONLY valid JSON. You are configuring a 5-agent team for a business.' },
      { role: 'user', content: AUTOPILOT_PROMPT(input) }
    ],
    temperature: 0.1,
    jsonMode: true
  });

  const rawContent = aiResponse.content || '[]'
  let agentConfigs: AgentConfig[]
  
  try {
    const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    agentConfigs = JSON.parse(cleaned)
  } catch (parseErr) {
    console.error('Failed to parse autopilot response:', rawContent)
    throw new Error('AI returned invalid configuration. Please try again.')
  }

  if (!Array.isArray(agentConfigs) || agentConfigs.length < 5) {
    throw new Error('AI did not return 5 agents. Please try again.')
  }

  // 3. Create all 5 agents in DB
  const createdAgents: any[] = []

  const agentTypeIcons: Record<string, string> = {
    support_bot: '🛟',
    lead_qualifier: '🎯',
    ops_reporter: '📊',
    outreach_agent: '📣',
    booking_agent: '📅',
  }

  const agentTypeColors: Record<string, string> = {
    support_bot: '#B8FF00',
    lead_qualifier: '#4ECDC4',
    ops_reporter: '#FFB400',
    outreach_agent: '#FF6B6B',
    booking_agent: '#845EF7',
  }

  for (const config of agentConfigs.slice(0, 5)) {
    const agentType = config.agent_type || 'support_bot'

    // Insert agent
    const [agent] = await query(
      `INSERT INTO agents (tenant_id, name, description, system_prompt, persona, escalation_rules, config, widget_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, is_active, created_at`,
      [
        tenantId,
        config.name,
        config.description,
        config.system_prompt,
        JSON.stringify({
          tone: 'professional',
          language: 'en',
          agent_type: agentType,
          icon: agentTypeIcons[agentType] || '🤖',
        }),
        JSON.stringify({
          keywords: config.escalation_keywords || ['human', 'agent', 'manager', 'supervisor', 'help'],
          low_confidence_threshold: 0.35,
        }),
        JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          temperature: 0.3,
          max_tokens: 800,
        }),
        JSON.stringify({
          primaryColor: agentTypeColors[agentType] || '#B8FF00',
          position: 'bottom-right',
          welcomeMessage: config.welcome_message || 'Hi! How can I help you today?',
        }),
      ]
    )

    // Create a seed knowledge base document from suggested questions
    if (config.suggested_questions && config.suggested_questions.length > 0) {
      const seedContent = config.suggested_questions.join('\n\n')
      const docId = uuid()

      await query(
        `INSERT INTO documents (id, agent_id, tenant_id, filename, source_type, status, chunk_count)
         VALUES ($1, $2, $3, $4, 'text', 'ready', $5)`,
        [docId, agent.id, tenantId, `${config.name} - Seed Knowledge`, config.suggested_questions.length]
      )

      // Embed and store each question as a chunk
      for (let i = 0; i < config.suggested_questions.length; i++) {
        const questionText = config.suggested_questions[i]
        try {
          const embedding = await embedText(questionText)
          await query(
            `INSERT INTO chunks (document_id, agent_id, tenant_id, content, embedding, metadata, chunk_index)
             VALUES ($1, $2, $3, $4, $5::vector, $6, $7)`,
            [
              docId,
              agent.id,
              tenantId,
              questionText,
              `[${embedding.join(',')}]`,
              JSON.stringify({ source: 'autopilot_seed', agent_type: agentType }),
              i,
            ]
          )
        } catch (embedErr) {
          console.error(`Failed to embed seed question for ${config.name}:`, embedErr)
          // Continue — embedding failure shouldn't block agent creation
        }
      }
    }

    createdAgents.push({
      ...agent,
      agent_type: agentType,
      icon: agentTypeIcons[agentType] || '🤖',
      color: agentTypeColors[agentType] || '#B8FF00',
      welcome_message: config.welcome_message,
    })
  }

  return { agents: createdAgents, setup_complete: true }
}
