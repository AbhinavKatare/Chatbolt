from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)

class ToolCallRequest(BaseModel):
    call_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)

class ToolObservation(BaseModel):
    call_id: str
    tool_name: str
    output: Any
    error: Optional[str] = None

class MessageItem(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "observation"]
    content: str
    tool_calls: Optional[List[ToolCallRequest]] = None
    tool_call_id: Optional[str] = None

class ProviderConfig(BaseModel):
    provider: Literal[
        "openai",
        "anthropic",
        "nvidia",
        "nim",
        "google",
        "gemini",
        "custom",
        "openai_compatible",
        "ollama",
        "groq",
        "openrouter",
        "huggingface",
        "hf",
    ] = "openrouter"
    model: str = "meta-llama/llama-3.3-70b-instruct"
    api_key: Optional[str] = None  # Ephemeral, decrypted key passed per request
    base_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096

class StepRequest(BaseModel):
    run_id: str
    step_id: Optional[str] = None
    agent_id: Optional[str] = None
    agent_role: str = "general"
    agent_name: str = "Agent"
    system_prompt: Optional[str] = None
    task: str
    context: Optional[str] = None
    history: List[MessageItem] = Field(default_factory=list)
    available_tools: List[ToolDefinition] = Field(default_factory=list)
    provider_config: ProviderConfig = Field(default_factory=ProviderConfig)
    max_steps: int = 10
    step_number: int = 1

class StepResponse(BaseModel):
    run_id: str
    status: Literal[
        "tool_call_required",
        "completed",
        "failed",
        "max_steps_reached",
        "escalation_required",
        "provider_exhausted_pause",
    ]
    thought: Optional[str] = None
    tool_calls: List[ToolCallRequest] = Field(default_factory=list)
    final_output: Optional[str] = None
    error: Optional[str] = None
    critic_applied: bool = False
    failure_reason: Optional[str] = None
    duration_ms: int = 0
    tokens_used: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_tokens: int = 0
    context_limit: int = 128000
    context_utilization_pct: float = 0.0
    degradation_warning: Optional[str] = None  # None | "degradation_risk" | "critical_saturation"
    degradation_message: Optional[str] = None


class CriticRequest(BaseModel):
    run_id: str
    agent_role: str = "general"
    task: str
    draft_output: str
    criteria: Optional[List[str]] = None

class CriticResponse(BaseModel):
    run_id: str
    passed: bool
    score: float
    critique: Optional[str] = None
    improved_output: Optional[str] = None
    feedback: Optional[str] = None
    revised_output: Optional[str] = None

class DiffHunk(BaseModel):
    start_line: int
    end_line: int
    target_content: str
    replacement_content: str
    allow_multiple: bool = False

class FileDiffRequest(BaseModel):
    file_path: str
    original_content: Optional[str] = None
    hunks: List[DiffHunk] = Field(default_factory=list)
    unified_diff: Optional[str] = None
    fallback_to_full: bool = False

class FileDiffResult(BaseModel):
    success: bool
    file_path: str
    patched_content: Optional[str] = None
    hunks_applied: int = 0
    total_hunks: int = 0
    error: Optional[str] = None
    retry_with_context: bool = False

class SemanticSearchQuery(BaseModel):
    query: str
    top_k: int = 5
    path_filter: Optional[str] = None

class CodeChunkResult(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    content: str
    score: float

class TruncatedToolOutput(BaseModel):
    is_truncated: bool
    total_bytes: int
    total_lines: int
    preview: str
    content_ref: Optional[str] = None
    summary: Optional[str] = None
