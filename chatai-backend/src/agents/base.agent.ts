import { logger } from '../services/logger.service';
import OpenAI from 'openai'
import { Tenant } from '../types'
import { traceService } from '../services/trace.service'
import { runEmitter } from '../services/sse.service'

// Clean environment variable helper (trims whitespace, trailing commas/semicolons/quotes, and handles casing mismatches)
export function cleanEnvVar(key: string): string {
  const value = process.env[key] || process.env[key.toLowerCase()] || process.env[key.toUpperCase()]
  if (!value) return ''
  let cleaned = value.trim()
  if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1).trim()
  if (cleaned.endsWith(';')) cleaned = cleaned.slice(0, -1).trim()
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  return cleaned
}

// ── Providers ─────────────────────────────────────────────────────────────

// 1. Hugging Face Router (Primary for Open Models / Free Tier)
let _hfClient: OpenAI | null = null
function getHFClient(): OpenAI {
  if (!_hfClient) {
    const key = cleanEnvVar('HUGGINGFACE_API_KEY') || cleanEnvVar('HF_API_KEY')
    _hfClient = new OpenAI({
      apiKey: key,
      baseURL: 'https://router.huggingface.co/v1',
      timeout: 15000
    })
  }            
  return _hfClient
}                                                              // its basically not usable as its for open-models and very much paid

// 1.5 Mistral AI (High-performance Alternative)
let _mistralClient: OpenAI | null = null
function getMistralClient(): OpenAI {
  if (!_mistralClient) {
    const key = cleanEnvVar('MISTRAL_API_KEY') || cleanEnvVar('mistral_api_key')
    _mistralClient = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.mistral.ai/v1',
      timeout: 15000
    })
  }
  return _mistralClient
}   // its proper alternative 

// 2. OpenAI (Paid Models & Embeddings)
let _openaiClient: OpenAI | null = null
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    const key = cleanEnvVar('OPENAI_API_KEY')
    _openaiClient = new OpenAI({
      apiKey: key || 'dummy-key-to-prevent-openai-init-crash',
      timeout: 15000
    })
  }
  return _openaiClient
} // after paid users it will be an used for the paid users only
 
// 3. NVIDIA Moonshot AI Kimi Client (Reasoning & Large Context)
let _kimiClient: OpenAI | null = null
function getKimiClient(): OpenAI {
  if (!_kimiClient) {
    const key = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
    _kimiClient = new OpenAI({
      apiKey: key || 'dummy-nvapi-key-prevent-kimi-crash',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      timeout: 15000
    })
  }
  return _kimiClient
} // a proper aI-model for the working tasks 

// ── Model selection logic (Block 1.1) ──────────────────────────────────────
const DEFAULT_FREE_MODEL = 'Qwen/WebWorld-8B:featherless-ai'

export function getModelForPlan(tenant: Tenant, requestedModel?: string): string {
  if (requestedModel) return requestedModel
  
  const plan = (tenant.plan || 'hobby').toLowerCase()
  
  if (plan === 'pro') return 'moonshotai/kimi-k2.6'
  if (plan === 'standard') return 'moonshotai/kimi-k2.0'
  
  return DEFAULT_FREE_MODEL
}

// ── Core LLM call with Reasoning & Confidence (Block 1.3) ──────────────────
export async function callLLM(
  model: string,
  systemPrompt: string,
  userMsg: string,
  maxTokens = 2000,
  attempt = 1,
  runId?: string,
  agentName?: string
): Promise<{ content: string; confidence: number }> {
  let currentModel = model || DEFAULT_FREE_MODEL
  
  if (currentModel === DEFAULT_FREE_MODEL && attempt === 1) {
    try {
      const { modelRouterService } = await import('../services/model-router.service')
      currentModel = modelRouterService.selectModel(userMsg)
    } catch (e) {
      // fallback
    }
  }

  const callStartTime = Date.now()
  
  // Decide which client to use based on model name and availability
  const isKimiModel = currentModel.includes('kimi') || currentModel.startsWith('moonshotai/')
  const isPaidModel = currentModel.startsWith('gpt') || currentModel.includes('claude')
  const mistralKey = cleanEnvVar('MISTRAL_API_KEY') || cleanEnvVar('mistral_api_key')
  
  let client: OpenAI
  let effectiveModel = currentModel
  
  if (isKimiModel) {
    client = getKimiClient()
  } else if (isPaidModel) {
    client = getKimiClient()
    effectiveModel = currentModel === 'gpt-4o' ? 'moonshotai/kimi-k2.6' : 'moonshotai/kimi-k2.0'
  } else if (currentModel.includes('mistral') && mistralKey) {
    client = getMistralClient()
    effectiveModel = 'mistral-large-latest'
  } else {
    client = getHFClient()
    if (effectiveModel === 'Qwen/WebWorld-8B:featherless-ai') {
      effectiveModel = 'Qwen/Qwen2.5-7B-Instruct'
    }
  }

  if (runId) {
    await traceService.traceModelStart(runId, agentName || 'Unknown Agent', effectiveModel, systemPrompt, userMsg)
  }

  try {
    logger.info(`[LLM] Calling ${currentModel} (Effective: ${effectiveModel}, Attempt ${attempt})`)

    // Inject "Think step by step" and confidence request (Block 1.3)
    const enhancedSystem = `${systemPrompt}\n\nIMPORTANT: Think step by step before answering. At the very end of your response, provide a confidence score between 0 and 1 in the format: "CONFIDENCE: 0.XX"`

    const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
    const isKimiRun = effectiveModel.includes('kimi') && kimiKey

    const params: any = {
      model: effectiveModel,
      messages: [
        { role: 'system', content: enhancedSystem },
        { role: 'user', content: userMsg },
      ],
      max_tokens: isKimiRun ? 16384 : maxTokens,
      temperature: isKimiRun ? 1.0 : 0.7,
    }

    if (isKimiRun) {
      params.chat_template_kwargs = { thinking: true }
    }

    const response = await Promise.race([
      client.chat.completions.create(params),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('LLM call timed out')), 25000))
    ])

    const rawContent = response.choices[0]?.message?.content || ''
    
    // Parse confidence score
    const confidenceMatch = rawContent.match(/CONFIDENCE:\s*(0\.\d+)/i)
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8
    const cleanContent = rawContent.replace(/CONFIDENCE:\s*0\.\d+/i, '').trim()

    // Validate JSON output if systemPrompt demands JSON
    const expectsJson = systemPrompt.toLowerCase().includes('json')
    let isValid = true
    if (expectsJson) {
      try {
        safeParseJSON(cleanContent)
      } catch (err) {
        isValid = false
      }
    }

    if (!isValid && attempt < 3) {
      logger.warn(`[LLM] JSON validation failed on model ${currentModel}. Retrying with fallback model...`)
      
      let tenantId = '00000000-0000-0000-0000-000000000000'
      if (runId) {
        try {
          const { db } = await import('../db')
          const runRow = await db.query('SELECT tenant_id FROM workflow_runs WHERE id = $1', [runId])
          if (runRow.rows[0]) {
            tenantId = runRow.rows[0].tenant_id
          }
        } catch (e) {}
      }

      // Transparently log fallback event in execution_metrics
      try {
        const { db } = await import('../db')
        await db.query(
          `INSERT INTO execution_metrics (
            user_id, run_id, task_type, outcome, error_code, retry_count
           ) VALUES ($1, $2, 'validation_fallback', 'failed', 'validation_fallback', $3)`,
          [
            tenantId,
            runId || null,
            attempt
          ]
        )
      } catch (dbErr: any) {
        // silent
      }

      // Fallback model: if we already used Kimi or others, try DEFAULT_FREE_MODEL. If we already used DEFAULT_FREE_MODEL, try Kimi.
      let fallbackModel = DEFAULT_FREE_MODEL
      if (currentModel === DEFAULT_FREE_MODEL) {
        fallbackModel = process.env.MODEL_POWERFUL || 'moonshotai/kimi-k2.6'
      }
      return callLLM(fallbackModel, systemPrompt, userMsg, maxTokens, attempt + 1, runId, agentName)
    }

    // Self-correction loop: if confidence is extremely low or empty, retry (Block 1.3)
    if ((!cleanContent || confidence < 0.3) && attempt < 3) {
      console.warn(`[LLM] Low confidence (${confidence}) or empty output. Retrying...`)
      if (runId) {
        await traceService.logTrace(runId, 'RETRY_TRIGGERED', {
          agentName: agentName || 'Unknown Agent',
          attempt: attempt,
          delayMs: 0,
          errorMessage: `Low confidence: ${confidence}`
        })
      }
      return callLLM(currentModel, systemPrompt, userMsg, maxTokens, attempt + 1, runId, agentName)
    }

    if (runId) {
      const promptTokens = response.usage?.prompt_tokens || 0
      const completionTokens = response.usage?.completion_tokens || 0
      await traceService.traceModelComplete(
        runId,
        agentName || 'Unknown Agent',
        effectiveModel,
        cleanContent,
        confidence,
        Date.now() - callStartTime,
        promptTokens,
        completionTokens
      )
    }

    return { content: cleanContent, confidence }
  } catch (err: any) {
    const isRateLimit = err.status === 429 || err.message?.includes('429') || err.lc_error_code === 'MODEL_RATE_LIMIT';
    const isTimeout = err.message?.includes('timed out') || err.message?.includes('timeout') || err.status === 408;
    
    if ((isRateLimit || isTimeout) && attempt < 3) {
      let nextModel = DEFAULT_FREE_MODEL;
      if (currentModel === DEFAULT_FREE_MODEL && mistralKey) {
        nextModel = 'mistral-large-latest';
      }
      
      const shouldWait = nextModel === currentModel;
      const waitTime = shouldWait ? attempt * 15000 : 0;
      
      logger.info(`[LLM] Model ${currentModel} rate limited or timed out. Falling back to ${nextModel}${shouldWait ? ` after waiting ${waitTime/1000}s` : ''}`);
      
      if (runId) {
        await traceService.logTrace(runId, 'RETRY_TRIGGERED', {
          agentName: agentName || 'Unknown Agent',
          attempt: attempt,
          delayMs: waitTime,
          errorMessage: isRateLimit ? 'Rate limit hit' : 'Timeout hit'
        })
      }
      
      if (shouldWait && waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime));
      }
      return callLLM(nextModel, systemPrompt, userMsg, maxTokens, attempt + 1, runId, agentName);
    }

    console.error(`[LLM] Error for ${currentModel}:`, err.message);
    
    // Fallback chain: If primary fails, try Qwen free (unless it already hit rate limit/timeout)
    if (currentModel !== DEFAULT_FREE_MODEL && attempt < 2 && !isRateLimit && !isTimeout) {
      logger.info(`[LLM] Falling back to ${DEFAULT_FREE_MODEL}`);
      return callLLM(DEFAULT_FREE_MODEL, systemPrompt, userMsg, maxTokens, attempt + 1, runId, agentName);
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
  const isKimiModel = currentModel.includes('kimi') || currentModel.startsWith('moonshotai/')
  const isPaidModel = currentModel.startsWith('gpt') || currentModel.includes('claude')
  const mistralKey = cleanEnvVar('MISTRAL_API_KEY') || cleanEnvVar('mistral_api_key')

  let client: OpenAI
  let effectiveModel = currentModel
  
  if (isKimiModel) {
    client = getKimiClient()
  } else if (isPaidModel) {
    client = getKimiClient()
    effectiveModel = currentModel === 'gpt-4o' ? 'moonshotai/kimi-k2.6' : 'moonshotai/kimi-k2.0'
  } else if (mistralKey) {
    client = getMistralClient()
    effectiveModel = 'mistral-large-latest'
  } else {
    client = getHFClient()
    if (effectiveModel === 'Qwen/WebWorld-8B:featherless-ai') {
      effectiveModel = 'Qwen/Qwen2.5-7B-Instruct'
    }
  }

  try {
    const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
    const isKimiRun = effectiveModel.includes('kimi') && kimiKey

    const params: any = {
      model: effectiveModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: isKimiRun ? 16384 : maxTokens,
      temperature: isKimiRun ? 1.0 : 0.7,
      stream: true,
    }

    if (isKimiRun) {
      params.chat_template_kwargs = { thinking: true }
    }

    logger.info(`[LLM Stream] Calling ${currentModel} (Effective: ${effectiveModel})`)
    const stream = await client.chat.completions.create(params) as any

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
    // Fallback to DEFAULT_FREE_MODEL if not already using it and primary fails
    if (currentModel !== DEFAULT_FREE_MODEL) {
      logger.info(`[LLM Stream] Falling back to ${DEFAULT_FREE_MODEL}`);
      return callLLMStream(DEFAULT_FREE_MODEL, systemPrompt, userMsg, onDelta, maxTokens);
    }
    throw err
  }
}

// ── Mathematical Vector Padding Helper ────────────────────────────────────
export function adjustEmbeddingDimension(embedding: number[], targetDimension = 1536): number[] {
  if (embedding.length === targetDimension) {
    return embedding
  }
  if (embedding.length > targetDimension) {
    return embedding.slice(0, targetDimension)
  }
  
  // Mathematical Zero Padding
  const padded = new Array(targetDimension).fill(0)
  for (let i = 0; i < embedding.length; i++) {
    padded[i] = embedding[i]
  }
  return padded
}

// ── Text embeddings (Block 1.1) ──────────────────────────────────────────
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const openaiKey = cleanEnvVar('OPENAI_API_KEY')
  const mistralKey = cleanEnvVar('MISTRAL_API_KEY') || cleanEnvVar('mistral_api_key')
  const hfKey = cleanEnvVar('HUGGINGFACE_API_KEY') || cleanEnvVar('HF_API_KEY')

  let embeddings: number[][] = []

  if (openaiKey) {
    try {
      logger.info(`[Embedding] Embedding using OpenAI text-embedding-3-small`)
      const client = getOpenAIClient()
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      })
      embeddings = response.data.map((d: any) => d.embedding)
    } catch (err: any) {
      console.error(`[Embedding] OpenAI embedding failed, attempting fallback:`, err.message)
    }
  }

  if (embeddings.length === 0 && mistralKey) {
    try {
      logger.info(`[Embedding] Embedding using Mistral mistral-embed`)
      const client = getMistralClient()
      const response = await client.embeddings.create({
        model: 'mistral-embed',
        input: texts,
      })
      embeddings = response.data.map((d: any) => d.embedding)
    } catch (err: any) {
      console.error(`[Embedding] Mistral embedding failed, attempting fallback:`, err.message)
    }
  }

  if (embeddings.length === 0 && hfKey) {
    try {
      logger.info(`[Embedding] Embedding using HuggingFace sentence-transformers/all-MiniLM-L6-v2`)
      const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: texts }),
      })
      if (!response.ok) {
        throw new Error(`HF returned status ${response.status}: ${await response.text()}`)
      }
      const data: any = await response.json()
      if (Array.isArray(data)) {
        if (Array.isArray(data[0])) {
          embeddings = data
        } else if (typeof data[0] === 'number') {
          embeddings = [data as number[]]
        }
      }
    } catch (err: any) {
      console.error(`[Embedding] HuggingFace embedding failed:`, err.message)
    }
  }

  if (embeddings.length === 0) {
    throw new Error('All embedding providers failed or were not configured.')
  }

  // Adjust all embeddings to exactly 1536 dimensions
  return embeddings.map(emb => adjustEmbeddingDimension(emb, 1536))
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const results = await embedBatch([text])
    return results[0]
  } catch (err: any) {
    console.error('Embedding failed:', err.message)
    throw err
  }
}

/**
 * Highly robust JSON parsing utility that handles unescaped control characters,
 * trailing commas, markdown fences, and typical LLM format issues safely.
 *
 * Key design decisions:
 * - Only strips OUTER markdown fences (not ``` inside string values)
 * - Sanitizes raw control chars inside JSON strings BEFORE brace-balancing
 * - Brace-counting is string-aware (skips chars inside quoted values)
 */
export function safeParseJSON(str: string): any {
  if (!str) return {}

  // ── Step 1: Strip OUTER markdown fences only ──────────────────────────
  // Only strip if the entire response is wrapped in a fence.
  let stripped = str.trim()
  if (stripped.startsWith('```json')) {
    stripped = stripped.slice(7)
    const closingFence = stripped.lastIndexOf('```')
    if (closingFence !== -1) stripped = stripped.slice(0, closingFence)
    stripped = stripped.trim()
  } else if (stripped.startsWith('```')) {
    stripped = stripped.slice(3)
    const closingFence = stripped.lastIndexOf('```')
    if (closingFence !== -1) stripped = stripped.slice(0, closingFence)
    stripped = stripped.trim()
  }

  // ── Step 2: Control-char sanitizer ───────────────────────────────────
  // Escapes raw newlines/tabs/CRs *inside* JSON string values only.
  // LLMs (Mistral, Qwen) frequently embed literal newlines in system_prompt fields.
  const sanitizeControlChars = (src: string): string => {
    let inString = false
    let escapeNext = false
    let out = ''
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (escapeNext) { out += c; escapeNext = false; continue }
      if (c === '\\') { out += c; if (inString) escapeNext = true; continue }
      if (c === '"') { inString = !inString; out += c; continue }
      if (inString) {
        if      (c === '\n') out += '\\n'
        else if (c === '\r') out += '\\r'
        else if (c === '\t') out += '\\t'
        else {
          const code = c.charCodeAt(0)
          out += code < 32 ? `\\u${code.toString(16).padStart(4, '0')}` : c
        }
      } else {
        out += c
      }
    }
    return out
  }

  // ── Step 3: Trailing-comma remover ───────────────────────────────────
  const stripTrailingCommas = (s: string): string => s.replace(/,\s*([\]}])/g, '$1')

  // ── Step 4: Candidate parser – tries 3 strategies in order ──────────
  const tryParse = (candidate: string): any => {
    // A) direct
    try { return JSON.parse(candidate) } catch {}
    // B) strip trailing commas
    const noComma = stripTrailingCommas(candidate)
    try { return JSON.parse(noComma) } catch {}
    // C) sanitize control chars + strip trailing commas
    const clean = stripTrailingCommas(sanitizeControlChars(candidate))
    try { return JSON.parse(clean) } catch {}
    return null
  }

  // ── Step 5: String-aware outermost brace extractor ───────────────────
  // Finds first `{` and walks to its matching `}`, skipping string contents.
  const extractOutermostBlock = (src: string): string | null => {
    let depth = 0
    let start = -1
    let inStr = false
    let esc = false
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (esc) { esc = false; continue }
      if (c === '\\' && inStr) { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (!inStr) {
        if (c === '{') { if (depth === 0) start = i; depth++ }
        else if (c === '}') {
          depth--
          if (depth === 0 && start !== -1) return src.substring(start, i + 1)
        }
      }
    }
    return null
  }

  // ── Attempt 1: Try entire stripped string directly ────────────────────
  const r1 = tryParse(stripped)
  if (r1 !== null) return r1

  // ── Attempt 2: Sanitize first, then extract outermost block ──────────
  const sanitized = sanitizeControlChars(stripped)
  const block = extractOutermostBlock(sanitized)
  if (block) {
    const r2 = tryParse(block)
    if (r2 !== null) return r2
  }

  // ── Attempt 3: Naive first-{ to last-} slice as last resort ──────────
  const si = stripped.indexOf('{')
  const ei = stripped.lastIndexOf('}')
  if (si !== -1 && ei !== -1) {
    const r3 = tryParse(stripped.substring(si, ei + 1))
    if (r3 !== null) return r3
  }

  throw new Error(`Robust JSON parsing failed on all candidate strategies. Original content length: ${str.length}`)
}

export const BaseAgent = {
  emitStep(runId: string, message: string) {
    runEmitter.emitEvent(runId, 'agent_progress', { message })
  }
}

