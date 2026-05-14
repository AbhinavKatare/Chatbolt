import { AgentExecutor } from './types';
import { executeResearcher } from './researcher.agent';
import { executeWriter } from './writer.agent';
import { executeEmailSender } from './email_sender.agent';

// Registry mapping agent roles to their execution microservices
export const AgentRegistry: Record<string, AgentExecutor> = {
  researcher: executeResearcher,
  writer: executeWriter,
  email_sender: executeEmailSender,
  
  // Future agents can be added here
  // data_processor: executeDataProcessor,
  // web_scraper: executeScraper,
  // code_executor: executeCodeRunner,
};

export function getAgentExecutor(role: string): AgentExecutor {
  const normalizedRole = role.toLowerCase();
  
  if (AgentRegistry[normalizedRole]) {
    return AgentRegistry[normalizedRole];
  }

  // Fallback for unknown agents
  return async (context) => {
    console.warn(`[Agent Registry] No specific executor found for role: ${role}. Using generic executor.`);
    await new Promise(r => setTimeout(r, 1000));
    return {
      success: true,
      data: { message: `Generic execution for ${role}` },
      metrics: { duration_ms: 1000, api_calls: 0 }
    };
  };
}

export * from './types';
