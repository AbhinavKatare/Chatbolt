import { AgentExecutor, AgentResult, AgentContext } from './types';
import { llm } from '../services/llm-orchestrator.service';

export const executeWriter: AgentExecutor = async (context: AgentContext): Promise<AgentResult> => {
  const start = Date.now();
  
  const inputSource = context.inputData.synthesis 
    || context.inputData.summary
    || context.inputData.agent_1_output?.summary
    || context.inputData.agent_1_output?.synthesis 
    || "No context provided. Write a welcome message for Chatbolt.";
    
  const format = context.inputData.format || 'email_newsletter';
  const tone = context.inputData.tone || 'professional';

  try {
    console.log(`[Writer Agent] Drafting content using Llama 3.1 for format: ${format}`);
    
    // Using Llama 3.1 (WRITER) for superior prose and formatting
    const aiResponse = await llm.chat({
      model: 'WRITER',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert Content Writer. Write a ${tone} ${format} based on the provided research context. Ensure high engagement and clear structure.` 
        },
        { role: 'user', content: `Context: ${inputSource}` }
      ],
      temperature: 0.8 // Higher temperature for creative writing
    });

    const draft = aiResponse.content;

    return {
      success: true,
      data: {
        draft,
        word_count: draft?.split(/\s+/)?.length || 0,
        format,
        tone,
        tokens_used: aiResponse.usage?.total_tokens
      },
      metrics: {
        duration_ms: Date.now() - start,
        api_calls: 1,
      }
    };
  } catch (error: any) {
    console.error(`[Writer Agent ERROR]`, error);
    return {
      success: false,
      data: null,
      error: error.message,
      metrics: { duration_ms: Date.now() - start, api_calls: 0 }
    };
  }
};
