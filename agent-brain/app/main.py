import os
import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
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

# Internal Service Authentication Middleware
@app.middleware("http")
async def internal_auth_middleware(request: Request, call_next):
    internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET", "")
    public_paths = {"/health", "/docs", "/redoc", "/openapi.json"}
    
    # Bypass auth if secret is not configured or for public endpoints / preflight
    if not internal_secret or request.url.path in public_paths or request.method == "OPTIONS":
        return await call_next(request)
    
    provided_key = request.headers.get("X-Internal-Service-Key", "")
    if not provided_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            provided_key = auth_header[7:]
    
    if provided_key != internal_secret:
        return JSONResponse(
            status_code=401,
            content={
                "error": "UNAUTHORIZED",
                "message": "Invalid or missing X-Internal-Service-Key for internal agent-brain communication"
            }
        )
    
    return await call_next(request)

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

