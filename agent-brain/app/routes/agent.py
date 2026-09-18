from fastapi import APIRouter, HTTPException, Depends
from app.schemas import StepRequest, StepResponse
from app.graph.react_engine import run_react_step

router = APIRouter(prefix="/agent", tags=["agent"])

@router.post("/step", response_model=StepResponse)
async def execute_agent_step(request: StepRequest):
    """
    Executes a single reasoning step in the LangGraph ReAct loop.
    Returns structured tool calls for the Go runtime to execute,
    or the final completed response.
    """
    try:
        response = run_react_step(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ReAct reasoning error: {str(e)}")

@router.get("/providers")
async def list_providers():
    """
    Lists all supported LLM providers and standard configurations.
    """
    return {
        "providers": [
            {
                "id": "openrouter",
                "name": "OpenRouter Universal Gateway",
                "default_model": "openai/gpt-4o",
                "endpoint": "https://openrouter.ai/api/v1"
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "default_model": "gpt-4o",
                "endpoint": "https://api.openai.com/v1"
            },
            {
                "id": "huggingface",
                "name": "Hugging Face Router",
                "default_model": "Qwen/Qwen2.5-72B-Instruct",
                "endpoint": "https://router.huggingface.co/v1"
            },
            {
                "id": "anthropic",
                "name": "Anthropic Claude",
                "default_model": "claude-3-5-sonnet-20241022",
                "endpoint": "https://api.anthropic.com"
            },
            {
                "id": "google",
                "name": "Google Gemini",
                "default_model": "gemini-1.5-pro",
                "endpoint": "https://generativelanguage.googleapis.com"
            },
            {
                "id": "custom",
                "name": "Custom / Ollama / Groq / Self-Hosted",
                "default_model": "qwen2.5-coder:7b",
                "endpoint": "Custom configurable base_url"
            }
        ]
    }
