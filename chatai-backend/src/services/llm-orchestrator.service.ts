import { OpenAI } from 'openai';

/**
 * NVIDIA NIM Models mapped to their specific roles in Chatbolt
 */
export const NIM_MODELS = {
  REASONER: 'qwen/qwen2.5-72b-instruct', // Best for planning and logic
  WRITER: 'meta/llama-3.1-70b-instruct',  // Best for prose and creative output
  EXTRACTOR: 'mistralai/mixtral-8x7b-instruct-v0.1', // Best for data extraction
  FAST: 'microsoft/phi-3-mini-128k-instruct', // Best for simple/cheap tasks
  NEMOTRON: 'nvidia/nemotron-4-340b-instruct', // Best for strict instruction following
};

export class LLMOrchestrator {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.NVIDIA_NIM_API_KEY || 'placeholder',
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
      console.log(`[LLMOrchestrator] Dispatching to ${modelId}`);
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
}

export const llm = new LLMOrchestrator();
