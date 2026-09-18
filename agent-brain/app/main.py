import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routes.agent import router as agent_router

app = FastAPI(
    title="Chatbolt Agent-Brain Reasoning Engine",
    description="LangGraph-powered ReAct agent reasoning service with universal multi-provider support",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agent_router)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "agent-brain",
        "engine": "langgraph-react",
        "version": "1.0.0",
        "timestamp_ms": int(time.time() * 1000)
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", os.environ.get("BRAIN_PORT", 8082)))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
