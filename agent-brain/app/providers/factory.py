import os
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatResult, ChatGeneration

from app.schemas import ProviderConfig

class MockChatModel(BaseChatModel):
    """
    Mock chat model for testing and offline development. Never calls external APIs.
    """
    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        last_msg = messages[-1].content if messages else ""
        has_tool_response = any(getattr(m, "type", "") == "tool" or hasattr(m, "tool_call_id") for m in messages)
        
        # If tool response was already returned, complete the ReAct step
        if has_tool_response:
            ai_msg = AIMessage(content="[TeamLead] Mission decomposed, tasks assigned, and team coordination completed successfully.")
        # If prompt includes delegation or team lead tasks
        elif "delegate" in last_msg.lower() or "mission" in last_msg.lower() or "campaign" in last_msg.lower():
            ai_msg = AIMessage(
                content="I will decompose the mission and delegate the initial research task to our market researcher.",
                tool_calls=[{
                    "name": "delegate_task",
                    "args": {
                        "target_role": "researcher",
                        "task_description": "Analyze competitor positioning and customer pain points for product announcement",
                        "priority": "high"
                    },
                    "id": "call_mock_delegate_1"
                }]
            )
        # If prompt includes tool mentions or search request, emit a mock tool call
        elif "search" in last_msg.lower() or "find" in last_msg.lower() or "tools" in str(kwargs).lower():
            ai_msg = AIMessage(
                content="I will search for the requested information.",
                tool_calls=[{
                    "name": "web_search",
                    "args": {"query": "Autonomous agent teams and multi-agent coordination"},
                    "id": "call_mock_auto_1"
                }]
            )
        else:
            ai_msg = AIMessage(content="[Agent-Brain LangGraph] Reasoning step completed successfully.")
        
        gen = ChatGeneration(message=ai_msg)
        return ChatResult(generations=[gen])

    def bind_tools(self, tools, **kwargs):
        return self

    @property
    def _llm_type(self) -> str:
        return "mock"

def get_llm(config: ProviderConfig) -> BaseChatModel:
    """
    Universal multi-provider factory that creates LangChain ChatModel instances
    using per-request decrypted credentials. Never stores or logs API keys.
    """
    provider = config.provider.lower()
    model = config.model
    api_key = config.api_key or ""
    temp = config.temperature
    max_tokens = config.max_tokens

    # Check for explicit mock requests, mock provider, or mock environment flag
    if (
        provider in ("mock", "fake")
        or api_key in ("mock", "mock-chat-model", "fake")
        or os.environ.get("AGENT_BRAIN_MOCK_LLM") == "true"
        or (not api_key and not os.environ.get("OPENROUTER_API_KEY") and not os.environ.get("OPENAI_API_KEY") and provider not in ("ollama", "custom", "openai_compatible"))
    ):
        return MockChatModel()

    # 1. OpenRouter (Universal Multi-Model Gateway)
    if provider in ("openrouter", "open_router"):
        if not api_key:
            api_key = os.environ.get("OPENROUTER_API_KEY", "mock-openrouter-key")
        return ChatOpenAI(
            model=model or "openai/gpt-4o",
            api_key=api_key,
            base_url=config.base_url or "https://openrouter.ai/api/v1",
            temperature=temp,
            max_tokens=max_tokens,
            default_headers={
                "HTTP-Referer": "https://chatbolt.ai",
                "X-Title": "Chatbolt AI Agent Workforce",
            },
        )

    # 2. Hugging Face Router
    elif provider in ("huggingface", "hf", "hugging_face"):
        if not api_key:
            api_key = os.environ.get("HUGGINGFACE_API_KEY", os.environ.get("HF_API_KEY", "mock-hf-key"))
        return ChatOpenAI(
            model=model or "Qwen/Qwen2.5-72B-Instruct",
            api_key=api_key,
            base_url=config.base_url or "https://router.huggingface.co/v1",
            temperature=temp,
            max_tokens=max_tokens,
        )

    # 3. Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
    elif provider == "anthropic":
        if not api_key:
            api_key = os.environ.get("ANTHROPIC_API_KEY", "mock-anthropic-key")
        return ChatAnthropic(
            model=model if model and "claude" in model.lower() else "claude-3-5-sonnet-20241022",
            api_key=api_key,
            temperature=temp,
            max_tokens=max_tokens,
        )

    # 4. Google Gemini (Gemini 1.5 Pro, Flash, etc.)
    elif provider in ("google", "gemini"):
        if not api_key:
            api_key = os.environ.get("GOOGLE_API_KEY", os.environ.get("GEMINI_API_KEY", "mock-google-key"))
        return ChatGoogleGenerativeAI(
            model=model if model and "gemini" in model.lower() else "gemini-1.5-pro",
            google_api_key=api_key,
            temperature=temp,
            max_output_tokens=max_tokens,
        )

    # 5. Generic OpenAI-Compatible (Ollama, LM Studio, Groq, vLLM, self-hosted)
    elif provider in ("custom", "openai_compatible", "ollama", "groq"):
        if not api_key:
            api_key = os.environ.get("CUSTOM_LLM_API_KEY", "mock-custom-key")
        base_url = config.base_url or (
            "http://localhost:11434/v1" if provider == "ollama" else
            "https://api.groq.com/openai/v1" if provider == "groq" else
            "http://localhost:8000/v1"
        )
        return ChatOpenAI(
            model=model or "qwen2.5-coder:7b",
            api_key=api_key,
            base_url=base_url,
            temperature=temp,
            max_tokens=max_tokens,
        )

    # 6. Standard OpenAI (GPT-4o, GPT-4o-mini, o1, o3-mini)
    else:
        if not api_key:
            api_key = os.environ.get("OPENAI_API_KEY", "mock-openai-key")
        return ChatOpenAI(
            model=model or "gpt-4o",
            api_key=api_key,
            temperature=temp,
            max_tokens=max_tokens,
            base_url=config.base_url or None,
        )

def get_resilient_llm(config: ProviderConfig) -> BaseChatModel:
    """
    Creates an LLM with automated fallback chains (e.g. OpenRouter -> HF -> Anthropic -> OpenAI -> Ollama/Mock).
    If the primary model fails or rate-limits, LangChain automatically executes the next provider.
    """
    primary = get_llm(config)
    if isinstance(primary, MockChatModel) or os.environ.get("AGENT_BRAIN_MOCK_LLM") == "true":
        return primary

    fallbacks = []
    # Configure fallback list based on available keys
    if os.environ.get("OPENROUTER_API_KEY") and config.provider != "openrouter":
        fallbacks.append(get_llm(ProviderConfig(provider="openrouter", model="meta-llama/llama-3.3-70b-instruct")))
    if os.environ.get("HUGGINGFACE_API_KEY") and config.provider != "huggingface":
        fallbacks.append(get_llm(ProviderConfig(provider="huggingface", model="Qwen/Qwen2.5-72B-Instruct")))
    if os.environ.get("ANTHROPIC_API_KEY") and config.provider != "anthropic":
        fallbacks.append(get_llm(ProviderConfig(provider="anthropic", model="claude-3-5-sonnet-20241022")))
    if os.environ.get("OPENAI_API_KEY") and config.provider != "openai":
        fallbacks.append(get_llm(ProviderConfig(provider="openai", model="gpt-4o-mini")))

    if fallbacks:
        try:
            return primary.with_fallbacks(fallbacks)
        except Exception:
            return primary

    return primary

