export interface AgentContext {
  workflowId: string;
  runId: string;
  tenantId: string;
  inputData: Record<string, any>;
  agentConfig: any;
  vaultKeys: Record<string, string>; // injected securely by the engine
}

export interface AgentResult {
  success: boolean;
  data: any;
  error?: string;
  metrics: {
    duration_ms: number;
    api_calls: number;
    tokens_used?: number;
  };
}

export type AgentExecutor = (context: AgentContext) => Promise<AgentResult>;
