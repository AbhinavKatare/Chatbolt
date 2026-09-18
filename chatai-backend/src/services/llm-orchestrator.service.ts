import { logger } from './logger.service';
import { OpenAI } from 'openai';

/**
 * Universal Multi-Provider Models (OpenRouter, OpenAI, Hugging Face)
 */
export const CHATBOLT_MODELS = {
  AUTOGEN: process.env.AUTOGEN_MODEL || 'openai/gpt-4o',
  REASONER: 'anthropic/claude-3.5-sonnet', // Top tier reasoning & planning via OpenRouter
  WRITER: 'openai/gpt-4o-mini',            // Fast, high-quality prose
  EXTRACTOR: 'meta-llama/llama-3.3-70b-instruct', // Fast structured data extraction
  FAST: 'openai/gpt-4o-mini',             // Budget/fast tasks
  HEAVY_AGENT: 'openai/gpt-4o',
  CODE: 'qwen/qwen-2.5-coder-32b-instruct', // Premier coding model
  NEMOTRON: 'nvidia/llama-3.1-nemotron-70b-instruct', // Legacy alias
  DEFAULT: 'openai/gpt-4o',
};

// Aliased for seamless backward compatibility across agent references
export const NIM_MODELS = CHATBOLT_MODELS;

export class LLMOrchestrator {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY || 
                   process.env.OPENAI_API_KEY || 
                   process.env.HUGGINGFACE_API_KEY || 
                   process.env.HF_API_KEY || 
                   'mock_key';

    const baseURL = process.env.OPENROUTER_API_KEY 
      ? 'https://openrouter.ai/api/v1'
      : process.env.HUGGINGFACE_API_KEY 
        ? 'https://router.huggingface.co/v1' 
        : 'https://api.openai.com/v1';

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 20000,
      defaultHeaders: process.env.OPENROUTER_API_KEY ? {
        'HTTP-Referer': 'https://chatbolt.ai',
        'X-Title': 'Chatbolt AI Agent Workforce'
      } : undefined
    });
  }

  async chat(params: {
    model: keyof typeof NIM_MODELS | string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    jsonMode?: boolean;
  }) {
    const modelId = NIM_MODELS[params.model as keyof typeof NIM_MODELS] || params.model;
    
    try {
      logger.info(`[LLMOrchestrator] Dispatching to ${modelId}`);
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 1024,
        response_format: params.jsonMode ? { type: 'json_object' } : undefined,
      });

      return {
        content: response.choices[0].message.content,
        usage: response.usage,
        modelUsed: modelId,
      };
    } catch (error: any) {
      console.error(`[LLMOrchestrator ERROR] ${error.message}`);
      throw new Error(`LLM dispatch failed: ${error.message}`);
    }
  }

  /**
   * High-level reasoning call (uses Qwen)
   */
  async plan(prompt: string, context: string = '') {
    return this.chat({
      model: 'REASONER',
      messages: [
        { role: 'system', content: 'You are the Chatbolt Strategy Engine. Create a structured execution plan based on the user request and context.' },
        { role: 'user', content: `Context: ${context}\n\nRequest: ${prompt}` }
      ],
      temperature: 0.1, // Low temperature for stability
    });
  }

  /**
   * Heavy Agent Work (Streaming)
   */
  async heavyAgentWork(prompt: string, context: string = '') {
    const messages = [
      { role: 'user' as const, content: context ? `Context: ${context}\n\nRequest: ${prompt}` : prompt }
    ];

    const stream = await this.client.chat.completions.create({
      model: NIM_MODELS.HEAVY_AGENT,
      messages: messages,
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 4096,
      stream: true
    });

    return stream;
  }
}

export const llm = new LLMOrchestrator();
