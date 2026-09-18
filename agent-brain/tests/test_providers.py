import pytest
from app.schemas import ProviderConfig
from app.providers.factory import get_llm
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI

def test_openrouter_provider():
    cfg = ProviderConfig(
        provider="openrouter",
        model="openai/gpt-4o",
        api_key="sk-or-test-key",
        temperature=0.5,
        max_tokens=2048,
    )
    llm = get_llm(cfg)
    assert isinstance(llm, ChatOpenAI)
    assert llm.model_name == "openai/gpt-4o"
    assert "openrouter.ai" in str(llm.openai_api_base or "")
    assert llm.temperature == 0.5

def test_huggingface_provider():
    cfg = ProviderConfig(
        provider="huggingface",
        model="Qwen/Qwen2.5-72B-Instruct",
        api_key="hf_test_token",
        temperature=0.7,
    )
    llm = get_llm(cfg)
    assert isinstance(llm, ChatOpenAI)
    assert llm.model_name == "Qwen/Qwen2.5-72B-Instruct"
    assert "huggingface.co" in str(llm.openai_api_base or "")

def test_openai_provider():
    cfg = ProviderConfig(
        provider="openai",
        model="gpt-4o-mini",
        api_key="test-openai-key",
        temperature=0.2,
    )
    llm = get_llm(cfg)
    assert isinstance(llm, ChatOpenAI)
    assert llm.model_name == "gpt-4o-mini"
    assert llm.temperature == 0.2

def test_anthropic_provider():
    cfg = ProviderConfig(
        provider="anthropic",
        model="claude-3-5-sonnet-20241022",
        api_key="test-anthropic-key",
        temperature=0.3,
    )
    llm = get_llm(cfg)
    assert isinstance(llm, ChatAnthropic)
    assert llm.model == "claude-3-5-sonnet-20241022"
    assert llm.temperature == 0.3

def test_google_gemini_provider():
    cfg = ProviderConfig(
        provider="google",
        model="gemini-1.5-pro",
        api_key="test-google-key",
        temperature=0.4,
    )
    llm = get_llm(cfg)
    assert isinstance(llm, ChatGoogleGenerativeAI)
    assert llm.model == "gemini-1.5-pro"
    assert llm.temperature == 0.4

def test_custom_ollama_provider():
    cfg = ProviderConfig(
        provider="ollama",
        model="qwen2.5-coder:7b",
        api_key="ollama",
        base_url="http://localhost:11434/v1",
    )
    llm = get_llm(cfg)
    assert isinstance(llm, ChatOpenAI)
    assert llm.model_name == "qwen2.5-coder:7b"
    assert "11434" in str(llm.openai_api_base or "")
