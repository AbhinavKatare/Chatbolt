from typing import Sequence, List, Optional, Dict, Any
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from app.schemas import ToolCallRequest

class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    task: str
    context: Optional[str]
    thought: Optional[str]
    tool_calls: List[ToolCallRequest]
    final_output: Optional[str]
    status: str
    step_count: int
    max_steps: int
    tokens_used: int
    error: Optional[str]
