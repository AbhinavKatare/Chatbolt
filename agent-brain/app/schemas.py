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
    step_id: Optional[str] = None
    status: Literal["tool_call_required", "completed", "failed", "max_steps_reached"]
    thought: Optional[str] = None
    tool_calls: List[ToolCallRequest] = Field(default_factory=list)
    final_output: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int = 0
    tokens_used: int = 0
