# Chatbolt System Architecture

Chatbolt is an autonomous multi-agent simulation and orchestration platform designed to execute complex organizational missions using collaborative AI agent teams (Marketing, Technical, Operations, Compliance).

---

## 1. High-Level Polyglot Topology

```
+-------------------------------------------------------------------------------+
|                                CLIENTS / APIS                                 |
|          Web Dashboard / CLI / Webhook Ingestion / Public REST API            |
+-------------------------------------------------------------------------------+
                                       |
                                       | HTTPS / WSS / SSE
                                       v
+-------------------------------------------------------------------------------+
|                       NODE.JS API GATEWAY (Port 5000)                        |
|                                                                               |
|  - Auth Middleware (Supabase JWT / Fail-Closed Verification)                  |
|  - AES-256-GCM Credential Vault (Master Key Fail-Fast)                        |
|  - Team & Company Orchestrator (Dependency Graphs, Phase Transition)          |
|  - Action Rollback Journal (120s TTL Reversible Actions)                      |
|  - Server-Sent Events (SSE Real-Time Stream Distribution)                     |
|  - Stripe Subscription Entitlements & Metering Verification                   |
+-------------------------------------------------------------------------------+
           |                                                      |
           | HTTP (X-Internal-Service-Key)                        | HTTP (X-Internal-Service-Key)
           v                                                      v
+------------------------------------+  +---------------------------------------+
|    GO AGENT-RUNTIME (Port 8081)    |  |     PYTHON AGENT-BRAIN (Port 8082)    |
|                                    |  |                                       |
|  - Goroutine Bounded Worker Pool   |  |  - LangGraph Open-Ended ReAct Loop    |
|  - Real-Time Resource Throttling   |  |  - Plan -> Act -> Observe -> Repeat   |
|  - OS-Level Sandboxed Code Exec    |  |  - Multi-Provider Adapter Engine      |
|  - Strict Env Variable Sanitizer   |  |  - Self-Healing Critic Pass           |
|  - Inter-Agent Pub/Sub AgentBus    |  |  - Fallback Provider Cascades         |
|  - Circuit Breakers & Auto-Retry   |  |  - Token & Latency Metrics Tracking   |
+------------------------------------+  +---------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
|                   POSTGRESQL 15 + PGVECTOR / STATE STORE                      |
|                                                                               |
|  - `workflows` & `workflow_agents`: Team configurations & prompt definitions   |
|  - `workflow_runs` & `workflow_steps`: Mission execution records & SSE steps  |
|  - `agent_memory`: Team-scoped shared memory & semantic vector embeddings     |
|  - `action_journal`: Rollback ledgers and automated failure recovery logs    |
|  - `agent_accountability_ledger`: Cryptographically chained decision audit   |
|  - `tenants` & `subscriptions`: Tier gating and billing status                |
+-------------------------------------------------------------------------------+
```

---

## 2. Core Service Roles & Separation of Concerns

### A. Node.js API Gateway (`chatai-backend`)
- **Domain**: Ingestion, Authentication, Authorization, Database Persistence, SSE Streaming, Rollback Ledgers, Stripe Billing Entitlements.
- **Why Node**: Rich ecosystem for web APIs, event emitters, WebSocket/SSE multiplexing, and rapid database access layer.

### B. Go Agent-Runtime (`agent-runtime`)
- **Domain**: Concurrency Control, Bounded Goroutine Worker Pools, Sandboxed Process Execution, Inter-Agent Bus Pub/Sub, System Telemetry.
- **Why Go**: Native lightweight concurrency (goroutines), deterministic memory footprint (~11.5 MB baseline), zero runtime garbage collection latency spikes, and safe OS-level process management without crashing the Node event loop.

### C. Python Agent-Brain (`agent-brain`)
- **Domain**: LangGraph ReAct Reasoning Loop, Dynamic Tool Selection, Multi-LLM Provider Integration, Critic & Self-Healing Passes.
- **Why Python**: First-class support for LangChain/LangGraph, OpenAI/Anthropic/NVIDIA/Hugging Face SDKs, and cutting-edge cognitive loop orchestration.

---

## 3. Security Architecture & Boundary Invariants

1. **Inter-Service Authentication (`X-Internal-Service-Key`)**: All communication from Node to Go (`:8081`) or Python (`:8082`) must pass a cryptographically strong shared cluster token. Unauthorized requests receive `401 Unauthorized`.
2. **Environment Sanitization in Sandboxes**: The Go sandbox executes untrusted scripts in sanitized environments with strict environment variable scrubbing. No host secrets, API keys, database URLs, or encryption master keys can leak to executed code.
3. **Fail-Fast Encryption Vault**: Application boots fail immediately if `VAULT_ENCRYPTION_KEY` is missing or insufficient length (minimum 32 bytes).
4. **Fail-Closed Auth Boundary**: Auth middleware strictly validates Supabase JWT signatures. No mock tokens or default tenant bypasses are allowed in production mode.
5. **Autonomy Matrix & Destructive Action Gates**: The platform enforces 4 autonomy tiers (`observe_only`, `suggest_only`, `act_with_approval`, `fully_autonomous`). Destructive actions (`file_delete`, `drop_table`, `rm -rf`) are rejected unless explicit approval is attached.

---

## 4. Failure Recovery & Self-Healing Matrix

| Failure Class | Detection Point | Automated Recovery Mechanism |
|---|---|---|
| **Go Sandbox Crash / Timeout** | Go `agent-runtime` returns timeout (`124`) or non-zero exit | Automated retry in clean sandbox (exponential backoff); logged to `action_journal` (`failure_recovery:go_runtime`). |
| **Python Brain Reasoning Loop** | Brain detects infinite looping or low-quality output | Self-healing Critic review pass revises output; escalates to supervisor if repetitive. |
| **Provider API Outage** | Primary LLM endpoint returns 4xx/5xx or timeout | Cascade to secondary fallback provider in provider list without failing the run. |
| **Team Subtask Failure** | Sub-agent role fails to complete subtask | TeamLead reviews failure, reassigns to alternative role or synthesizes deliverable. |
| **Destructive Side Effect** | Human user notices erroneous external action | Action Rollback Journal reverts action via recorded undo handlers within 120s TTL. |
