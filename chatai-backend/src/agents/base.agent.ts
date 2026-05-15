import OpenAI from 'openai'
import { Tenant } from '../types'

// ── Providers ─────────────────────────────────────────────────────────────

// 1. Hugging Face Router (Primary for Open Models / Free Tier)
let _hfClient: OpenAI | null = null
function getHFClient(): OpenAI {
  if (!_hfClient) {
    _hfClient = new OpenAI({
      apiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || '',
      baseURL: 'https://router.huggingface.co/v1',
    })
  }
  return _hfClient
}

// 1.5 Mistral AI (High-performance Alternative)
let _mistralClient: OpenAI | null = null
function getMistralClient(): OpenAI {
  if (!_mistralClient) {
    _mistralClient = new OpenAI({
      apiKey: process.env.MISTRAL_API_KEY || process.env.mistral_api_key || '',
      baseURL: 'https://api.mistral.ai/v1',
    })
  }
  return _mistralClient
}

// 2. OpenAI (Paid Models & Embeddings)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// ── Model selection logic (Block 1.1) ──────────────────────────────────────
const DEFAULT_FREE_MODEL = 'Qwen/WebWorld-8B:featherless-ai'

export function getModelForPlan(tenant: Tenant, requestedModel?: string): string {
  if (requestedModel) return requestedModel
  
  const plan = (tenant.plan || 'hobby').toLowerCase()
  
  if (plan === 'pro') return 'gpt-4o' // Fallback to GPT-4o if Claude not configured
  if (plan === 'standard') return 'gpt-4o-mini'
  
  return DEFAULT_FREE_MODEL
}

// ── Core LLM call with Reasoning & Confidence (Block 1.3) ──────────────────
export async function callLLM(
  model: string,
  systemPrompt: string,
  userMsg: string,
  maxTokens = 2000,
  attempt = 1
): Promise<{ content: string; confidence: number }> {
  const currentModel = model || DEFAULT_FREE_MODEL
  
  // Decide which client to use based on model name and availability
  const isPaidModel = currentModel.startsWith('gpt') || currentModel.includes('claude')
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.mistral_api_key
  
  let client: OpenAI
  let effectiveModel = currentModel
  
  if (isPaidModel) {
    client = openai
  } else if (mistralKey) {
    // FORCE Mistral if available, because HF credits are depleted in the log
    client = getMistralClient()
    // ALWAYS force a Mistral model if we are using the Mistral client
    effectiveModel = 'mistral-large-latest'
  } else {
    client = getHFClient()
  }

  try {
    console.log(`[LLM] Calling ${currentModel} (Attempt ${attempt})`)

    // Inject "Think step by step" and confidence request (Block 1.3)
    const enhancedSystem = `${systemPrompt}\n\nIMPORTANT: Think step by step before answering. At the very end of your response, provide a confidence score between 0 and 1 in the format: "CONFIDENCE: 0.XX"`

    const response = await client.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: 'system', content: enhancedSystem },
        { role: 'user', content: userMsg },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    })

    const rawContent = response.choices[0]?.message?.content || ''
    
    // Parse confidence score
    const confidenceMatch = rawContent.match(/CONFIDENCE:\s*(0\.\d+)/i)
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8
    const cleanContent = rawContent.replace(/CONFIDENCE:\s*0\.\d+/i, '').trim()

    // Self-correction loop: if confidence is extremely low or empty, retry (Block 1.3)
    if ((!cleanContent || confidence < 0.3) && attempt < 3) {
      console.warn(`[LLM] Low confidence (${confidence}) or empty output. Retrying...`)
      return callLLM(currentModel, systemPrompt, userMsg, maxTokens, attempt + 1)
    }

    return { content: cleanContent, confidence }
  } catch (err: any) {
    const isRateLimit = err.status === 429 || err.message?.includes('429') || err.lc_error_code === 'MODEL_RATE_LIMIT';
    
    if (isRateLimit && attempt < 3) {
      const waitTime = attempt * 15000; // Mistral free is 4 RPM, so wait 15s/30s
      console.warn(`[LLM] Rate limit hit (429). Waiting ${waitTime/1000}s before retry...`);
      await new Promise(r => setTimeout(r, waitTime));
      return callLLM(model, systemPrompt, userMsg, maxTokens, attempt + 1);
    }

    console.error(`[LLM] Error for ${currentModel}:`, err.message);
    
    // Fallback chain: If primary fails, try Qwen free (unless it already hit rate limit)
    if (currentModel !== DEFAULT_FREE_MODEL && attempt < 2 && !isRateLimit) {
      console.log(`[LLM] Falling back to ${DEFAULT_FREE_MODEL}`);
      return callLLM(DEFAULT_FREE_MODEL, systemPrompt, userMsg, maxTokens, attempt + 1);
    }
    
    throw new Error(`LLM Failure: ${err.message}`);
  }
}

// ── Streaming LLM call (Block 1.1) ─────────────────────────────────────────
export async function callLLMStream(
  model: string,
  systemPrompt: string,
  userMsg: string,
  onDelta: (delta: string) => void,
  maxTokens = 2000
): Promise<string> {
  const currentModel = model || DEFAULT_FREE_MODEL
  const isPaidModel = currentModel.startsWith('gpt') || currentModel.includes('claude')
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.mistral_api_key

  let client: OpenAI
  let effectiveModel = currentModel
  
  if (isPaidModel) {
    client = openai
  } else if (mistralKey && !currentModel.includes('Qwen')) {
    client = getMistralClient()
    if (effectiveModel === DEFAULT_FREE_MODEL) effectiveModel = 'mistral-large-latest'
  } else {
    client = getHFClient()
  }

  try {
    const stream = await client.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    })

    let fullResponse = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      if (delta) {
        fullResponse += delta
        onDelta(delta)
      }
    }
    return fullResponse
  } catch (err: any) {
    console.error(`[LLM Stream] Failed:`, err.message)
    throw err
  }
}

// ── Text embeddings (Block 1.1) ──────────────────────────────────────────
export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  } catch (err: any) {
    console.error('Embedding failed:', err.message)
    throw err
  }
}
