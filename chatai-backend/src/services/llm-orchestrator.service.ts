import { logger } from './logger.service';
import { OpenAI } from 'openai';

/**
 * NVIDIA NIM Models mapped to their specific roles in Chatbolt
 */
export const NIM_MODELS = {
  AUTOGEN: process.env.AUTOGEN_MODEL || 'nvidia/autogen-23-llama3-70b', // Provided by user or fallback
  REASONER: 'qwen/qwen2.5-72b-instruct', // Best for planning and logic
  WRITER: 'meta/llama-3.1-8b-instruct',  // Best for prose and creative output
  EXTRACTOR: 'mistralai/mixtral-8x7b-instruct-v0.1', // Best for data extraction
  FAST: 'microsoft/phi-3-mini-128k-instruct', // Best for simple/cheap tasks
  HEAVY_AGENT: 'meta/llama-3.1-8b-instruct',
};

export class LLMOrchestrator {
  private client: OpenAI;

  constructor() {
    const nvidiaApiKey = process.env.NVIDIA_API_KEY_2 || process.env.NVIDIA_API_KEY;
    if (!nvidiaApiKey) {
      throw new Error('NVIDIA API key is not configured');
    }

    this.client = new OpenAI({
      apiKey: nvidiaApiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
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
