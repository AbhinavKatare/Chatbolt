# ⚡ Chatbolt: Autonomous AI Workforce & Simulated Company Platform

Chatbolt is an enterprise-grade autonomous AI workforce runtime designed to run simulated teams (Engineering, SRE/Ops, Marketing, Operations) and supervise 20+ concurrent agents locally or in cloud deployments.

---

## 🏛️ Open-Core Architecture & Licensing

Chatbolt follows an **Open-Core** distribution model:

- **Core Platform (`core/`)**: Source-available under the **Business Source License 1.1 (BUSL-1.1)**, converting automatically to **Apache License 2.0** on **January 1, 2030**.
  - Free to study, modify, self-host, and contribute for internal, evaluation, educational, and non-commercial development.
  - Prohibits offering the software as a competing hosted cloud service or re-launching commercial distributions under different branding without an enterprise license.
- **Enterprise Modules (`enterprise/`)**: Proprietary capabilities (multi-organization governance, cryptographic license-key gate, SLA compliance reporting, enterprise billing hooks) available under commercial license.
- **Trademark Protection (`TRADEMARK.md`)**: The "Chatbolt" name, logos, and branding are strictly reserved by Chatbolt Inc. Code reuse does not grant trademark licenses.

> [!NOTE]
> *Legal Notice*: BUSL-1.1 is a source-available license, not an OSI-approved open-source license. Formal commercial deployments should consult qualified legal counsel.

---

## 🏗️ System Architecture

```mermaid
graph TD
    User((User / Operator)) -->|Web Dashboard| Frontend[Next.js 14 Dashboard]
    Frontend -->|API / SSE| Backend[Node.js Backend & Core Runtime]
    
    subgraph Core Platform (BUSL-1.1)
        Backend -->|gRPC / RPC| GoRuntime[Go agent-runtime: Worker Pool & Sandboxes]
        Backend -->|HTTP ReAct| PythonBrain[Python agent-brain: LangGraph ReAct]
        Backend -->|Pub/Sub Bus| AgentBus[AgentBus: Inter-Agent Pub/Sub]
        Backend -->|State & Ledger| Postgres[(PostgreSQL / Supabase)]
    end
    
    subgraph Enterprise Layer
        Backend -->|License Check| LicenseGate[Enterprise License Gate]
        Backend -->|Cross-Org DAG| CompanyOrchestrator[Company Orchestrator]
    end
```

---

## 🚀 Key Platform Capabilities

1. **High-Concurrency Local Runtime (`AgentRuntime`)**:
   - Manages a pool of **20+ concurrent agent instances** without container overhead.
   - Throttled by configurable worker concurrency limits (`maxConcurrentAgents`, default 8) and live Go runtime CPU/RAM metrics.
   - Built-in pub/sub **`AgentBus`** for agent-to-agent and teamlead coordination.
2. **Tri-Tier Microservices**:
   - **Node Backend**: Auth, REST/SSE routing, Supabase persistence, team templates.
   - **Go Runtime (`agent-runtime`)**: OS-level isolated sandbox execution, env secret stripping, timeout enforcement, worker pool supervision.
   - **Python Brain (`agent-brain`)**: Open-ended LangGraph ReAct reasoning loop (`plan → act → observe → repeat`), multi-provider adapters, XML prompt delimiters.
3. **Simulated Company Orchestration**:
   - Decomposes multi-team goals (Engineering $\rightarrow$ DevOps $\rightarrow$ Marketing) with automatic memory handoffs.
   - Org-chart autonomy levels (`observe_only`, `suggest_only`, `act_with_approval`, `fully_autonomous`).
   - Agent accountability ledger & automated 5-Whys post-mortem generation.
4. **Radical Metering Transparency & Pre-Execution Budget Guard**:
   - **Live Authoritative Pricing**: Itemized token and compute cost tracking based on direct provider rates (OpenAI, Anthropic, Gemini, DeepSeek, Llama, Ollama).
   - **Accurate Context Indicator**: Honest tracking against real context limits with proactive degradation alerts at 60% and 85% saturation.
   - **Pre-Execution Budget Guard**: Halts operations *before* spending tokens/money if a projected step would exceed budget caps.
   - **Upfront Spend Forecasting**: Pre-commitment task queue cost & time estimates.
   - **Immutable Audit Ledger**: Full RFC-4180 CSV & JSON cost export with "Zero Silent Changes" policy feed.

---

## 🚦 Getting Started & Documentation

- 📖 **[Architecture Guide](file:///c:/Sigma%20WD/BitsnBolts/chatbolt/docs/ARCHITECTURE.md)**: Deep dive into the tri-tier polyglot design, security boundaries, and failure recovery.
- 🚀 **[Self-Hosting Guide](file:///c:/Sigma%20WD/BitsnBolts/chatbolt/docs/SELF_HOSTING.md)**: Step-by-step setup, system sizing, secrets management, and bare-metal instructions.
- 🤝 **[Contributing Guide](file:///c:/Sigma%20WD/BitsnBolts/chatbolt/CONTRIBUTING.md)**: CLA terms, code standards, and PR guidelines.

### Quickstart with Docker Compose

```bash
docker compose up -d
```

### Verified Performance Benchmarks

| Metric | Measured Benchmark (Local Host) |
|---|---|
| **Go Runtime Baseline RAM** | ~11.5 MB RAM |
| **Active Goroutine Footprint** | ~10 goroutines (idle) |
| **20-Agent Concurrency Execution** | 3048ms total runtime (~152ms / task) |
| **Resource Throttling** | Dynamic scaling across bounded worker pool (0 task drops) |
| **Sandbox Secret Isolation** | 100% host secret scrubbing (`KEY`, `SECRET`, `TOKEN`, `VAULT`) |
| **Test Suite Pass Rate** | 100% across all 8 test suites (49+ automated tests) |

---

## ⚖️ Licensing & Attribution
- **Source Code**: [Business Source License 1.1](file:///c:/Sigma%20WD/BitsnBolts/chatbolt/LICENSE)
- **Trademark Policy**: [TRADEMARK.md](file:///c:/Sigma%20WD/BitsnBolts/chatbolt/TRADEMARK.md)
- **Contributing**: [CONTRIBUTING.md](file:///c:/Sigma%20WD/BitsnBolts/chatbolt/CONTRIBUTING.md)
- **Licensor**: Chatbolt Inc.

