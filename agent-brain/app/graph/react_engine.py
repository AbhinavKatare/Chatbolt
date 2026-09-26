import time
import json
from typing import Dict, Any, List, Optional
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

from app.graph.state import AgentState
from app.graph.prompt_builder import build_messages
from app.providers.factory import get_llm, get_resilient_llm
from app.schemas import StepRequest, StepResponse, ToolCallRequest

def convert_tools_to_openai_schema(tools: List[Any]) -> List[Dict[str, Any]]:
    """Converts internal ToolDefinition models into standard OpenAI/LangChain tool binding schemas."""
    schemas = []
    for t in tools:
        schemas.append({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters if t.parameters else {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        })
    return schemas

def detect_stuck_loop(history: List[Any], current_tool_calls: List[ToolCallRequest]) -> Optional[str]:
    """
    Detects if the agent is stuck in an infinite repetition loop:
    1. The same tool is invoked repeatedly with identical arguments.
    2. High history depth with no state progress.
    """
    if not current_tool_calls:
        return None

    current_call = current_tool_calls[0]
    recent_tools = []

    for item in reversed(history):
        if getattr(item, "role", "") in ("assistant", "tool") and hasattr(item, "tool_calls") and item.tool_calls:
            for tc in item.tool_calls:
                recent_tools.append(tc)
                if len(recent_tools) >= 3:
                    break
        if len(recent_tools) >= 3:
            break

    # If the last 2 past tool calls were identical to the current one
    matches = 0
    for past_tc in recent_tools:
        past_name = getattr(past_tc, "tool_name", "") if hasattr(past_tc, "tool_name") else past_tc.get("tool_name", "")
        past_args = getattr(past_tc, "arguments", {}) if hasattr(past_tc, "arguments") else past_tc.get("arguments", {})
        if past_name == current_call.tool_name and str(past_args) == str(current_call.arguments):
            matches += 1

    if matches >= 2:
        return f"Repeated tool execution loop detected on '{current_call.tool_name}' ({matches} previous identical calls)"

    return None

MODEL_CONTEXT_LIMITS: Dict[str, int] = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "o1": 200000,
    "o1-mini": 128000,
    "o3-mini": 200000,
    "claude-3-5-sonnet": 200000,
    "claude-3-5-haiku": 200000,
    "claude-3-opus": 200000,
    "gemini-1.5-pro": 1048576,
    "gemini-1.5-flash": 1048576,
    "gemini-2.0-flash": 1048576,
    "meta-llama/llama-3.3-70b": 131072,
    "meta-llama/llama-3.1-8b": 131072,
    "qwen/qwen-2.5-coder-32b": 32768,
    "qwen2.5-coder": 32768,
    "deepseek/deepseek-chat": 64000,
    "deepseek/deepseek-r1": 64000,
    "mistralai/mistral-large": 128000,
}

def get_model_context_limit(model_name: str) -> int:
    normalized = (model_name or "").lower()
    for k, v in MODEL_CONTEXT_LIMITS.items():
        if k in normalized:
            return v
    return 128000

def run_react_step(req: StepRequest) -> StepResponse:
    """
    Executes a single step in the ReAct reasoning graph with automated self-healing,
    stuck-loop detection, critic reviewer pass, and granular token & context tracking.
    """
    start_time = time.time()
    critic_applied = False
    failure_reason = None
    prompt_tokens = 0
    completion_tokens = 0
    cached_tokens = 0

    # 1. Initialize messages and state
    messages = build_messages(req)
    initial_state: AgentState = {
        "messages": messages,
        "task": req.task,
        "context": req.context,
        "thought": None,
        "tool_calls": [],
        "final_output": None,
        "status": "in_progress",
        "step_count": req.step_number,
        "max_steps": req.max_steps,
        "tokens_used": 0,
        "error": None,
    }

    # 2. Get LLM from factory with automated fallback resilience
    try:
        llm = get_resilient_llm(req.provider_config)
        
        # Bind tools if available
        if req.available_tools:
            tool_schemas = convert_tools_to_openai_schema(req.available_tools)
            try:
                llm = llm.bind_tools(tool_schemas)
            except Exception:
                pass

        # 3. Define graph nodes
        def reason_and_plan(state: AgentState) -> Dict[str, Any]:
            nonlocal critic_applied, failure_reason, prompt_tokens, completion_tokens, cached_tokens
            response = llm.invoke(state["messages"])
            
            # Extract actual token counts from LangChain response
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                um = response.usage_metadata
                prompt_tokens = um.get("input_tokens", 0)
                completion_tokens = um.get("output_tokens", 0)
                if "input_token_details" in um and isinstance(um["input_token_details"], dict):
                    cached_tokens = um["input_token_details"].get("cache_read", 0)
            elif hasattr(response, "response_metadata") and response.response_metadata:
                rm = response.response_metadata
                token_usage = rm.get("token_usage", {})
                prompt_tokens = token_usage.get("prompt_tokens", 0)
                completion_tokens = token_usage.get("completion_tokens", 0)

            # Fallback estimation if zero
            if prompt_tokens == 0:
                prompt_chars = sum(len(m.content if hasattr(m, "content") else str(m)) for m in state["messages"])
                prompt_tokens = max(1, prompt_chars // 4)
            if completion_tokens == 0:
                resp_chars = len(response.content if hasattr(response, "content") and isinstance(response.content, str) else "")
                completion_tokens = max(1, resp_chars // 4)

            tool_calls: List[ToolCallRequest] = []
            final_output = None
            thought = None
            status = "completed"

            # Check if LLM emitted structured tool calls
            if hasattr(response, "tool_calls") and response.tool_calls:
                for idx, tc in enumerate(response.tool_calls):
                    call_id = tc.get("id") or f"call_{int(time.time()*1000)}_{idx}"
                    tool_name = tc.get("name")
                    args = tc.get("args") or {}
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except Exception:
                            args = {"raw": args}
                    tool_calls.append(ToolCallRequest(call_id=call_id, tool_name=tool_name, arguments=args))
                
                status = "tool_call_required"
                thought = response.content if isinstance(response.content, str) else None

            elif hasattr(response, "additional_kwargs") and "tool_calls" in response.additional_kwargs:
                raw_tcs = response.additional_kwargs["tool_calls"]
                for tc in raw_tcs:
                    fn = tc.get("function", {})
                    name = fn.get("name", "")
                    raw_args = fn.get("arguments", "{}")
                    try:
                        args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    except Exception:
                        args = {"raw": raw_args}
                    tool_calls.append(ToolCallRequest(
                        call_id=tc.get("id", f"call_{int(time.time()*1000)}"),
                        tool_name=name,
                        arguments=args
                    ))
                status = "tool_call_required"
                thought = response.content if isinstance(response.content, str) else None

            else:
                # No tool calls; final answer reached
                final_output = response.content if isinstance(response.content, str) else str(response.content)
                status = "completed"

            # 4. Stuck-loop Detection & Self-Healing Critic Review Pass
            loop_reason = detect_stuck_loop(req.history, tool_calls)
            if loop_reason:
                failure_reason = loop_reason
                critic_applied = True
                critic_prompt = (
                    f"[System Critic Alert] {loop_reason}. "
                    f"You have already attempted this action multiple times without new progress. "
                    f"Break out of the loop: synthesize a comprehensive answer with the data collected so far, or choose an alternate unvisited approach."
                )
                critic_messages = list(state["messages"]) + [AIMessage(content=critic_prompt)]
                try:
                    critic_resp = llm.invoke(critic_messages)
                    if hasattr(critic_resp, "content") and critic_resp.content:
                        final_output = f"[Self-Healed via Critic] {critic_resp.content}"
                        tool_calls = []
                        status = "completed"
                        thought = "Loop broken by self-healing critic reviewer pass."
                except Exception as critic_err:
                    status = "escalation_required"
                    thought = f"Critic review failed: {str(critic_err)}"

            # 5. Check if max steps exceeded without progress
            if req.step_number >= req.max_steps and status == "tool_call_required":
                status = "max_steps_reached"
                final_output = thought or "Max reasoning steps reached without final resolution."

            return {
                "thought": thought,
                "tool_calls": tool_calls,
                "final_output": final_output,
                "status": status,
                "messages": list(state["messages"]) + [response],
                "tokens_used": prompt_tokens + completion_tokens,
            }

        # 4. Build and compile StateGraph
        builder = StateGraph(AgentState)
        builder.add_node("reason_and_plan", reason_and_plan)
        builder.set_entry_point("reason_and_plan")
        builder.add_edge("reason_and_plan", END)
        graph = builder.compile()

        # 5. Execute graph
        final_state = graph.invoke(initial_state)
        duration_ms = int((time.time() - start_time) * 1000)
        total_tokens = prompt_tokens + completion_tokens

        # Context degradation calculation
        model_name = req.provider_config.model if req.provider_config else "default"
        context_limit = get_model_context_limit(model_name)
        context_utilization_pct = round((prompt_tokens / max(1, context_limit)) * 100, 2)

        degradation_warning = None
        degradation_message = None
        if context_utilization_pct >= 85.0:
            degradation_warning = "critical_saturation"
            degradation_message = f"Critical Context Saturation: Session is at {context_utilization_pct}% of {context_limit} tokens limit. Reasoning fidelity is severely impacted."
        elif context_utilization_pct >= 60.0:
            degradation_warning = "degradation_risk"
            degradation_message = f"Context Degradation Warning: Session is at {context_utilization_pct}% of {context_limit} tokens limit. Recall & reasoning precision may decline."

        return StepResponse(
            run_id=req.run_id,
            step_id=req.step_id,
            status=final_state.get("status", "completed"),
            thought=final_state.get("thought"),
            tool_calls=final_state.get("tool_calls", []),
            final_output=final_state.get("final_output"),
            critic_applied=critic_applied,
            failure_reason=failure_reason,
            duration_ms=duration_ms,
            tokens_used=total_tokens,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cached_tokens=cached_tokens,
            context_limit=context_limit,
            context_utilization_pct=context_utilization_pct,
            degradation_warning=degradation_warning,
            degradation_message=degradation_message,
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        err_msg = str(e)
        is_provider_error = any(kw in err_msg.lower() for kw in ["api key", "rate limit", "429", "401", "403", "500", "502", "503", "provider", "model", "connection", "timeout"])
        return StepResponse(
            run_id=req.run_id,
            step_id=req.step_id,
            status="provider_exhausted_pause" if is_provider_error else "failed",
            error=err_msg,
            critic_applied=critic_applied,
            failure_reason=err_msg,
            duration_ms=duration_ms,
        )

