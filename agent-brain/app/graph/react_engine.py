import time
import json
from typing import Dict, Any, List
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

from app.graph.state import AgentState
from app.graph.prompt_builder import build_messages
from app.providers.factory import get_llm
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

def run_react_step(req: StepRequest) -> StepResponse:
    """
    Executes a single step in the ReAct reasoning graph.
    Returns whether a tool call is required (to be executed by Go runtime)
    or if the step/task has reached final completion.
    """
    start_time = time.time()

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

    # 2. Get LLM from factory
    try:
        llm = get_llm(req.provider_config)
        
        # Bind tools if available
        if req.available_tools:
            tool_schemas = convert_tools_to_openai_schema(req.available_tools)
            try:
                llm = llm.bind_tools(tool_schemas)
            except Exception as bind_err:
                # If bind_tools is not supported by specific mock/provider, continue with standard invocation
                pass

        # 3. Define graph nodes
        def reason_and_plan(state: AgentState) -> Dict[str, Any]:
            response = llm.invoke(state["messages"])
            
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

            return {
                "thought": thought,
                "tool_calls": tool_calls,
                "final_output": final_output,
                "status": status,
                "messages": list(state["messages"]) + [response],
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

        return StepResponse(
            run_id=req.run_id,
            step_id=req.step_id,
            status=final_state.get("status", "completed"),
            thought=final_state.get("thought"),
            tool_calls=final_state.get("tool_calls", []),
            final_output=final_state.get("final_output"),
            duration_ms=duration_ms,
            tokens_used=final_state.get("tokens_used", 0),
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        return StepResponse(
            run_id=req.run_id,
            step_id=req.step_id,
            status="failed",
            error=str(e),
            duration_ms=duration_ms,
        )
