# Changelog

All notable changes to Chatbolt will be documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and uses the [Business Source License 1.1](LICENSE).

---

## [2.0.0-polyglot] - 2026-09-22

### 🚀 Major Architectural Enhancements
- **Tri-Tier Polyglot Microservices**:
  - **Go `agent-runtime` (:8081)**: High-concurrency agent supervisor with bounded goroutine worker pool, dynamic resource throttling, CPU/RAM telemetry, inter-agent Pub/Sub `AgentBus`, and OS-level isolated sandbox code execution.
  - **Python `agent-brain` (:8082)**: Open-ended LangGraph ReAct reasoning loop (`plan → act → observe → repeat`), multi-provider adapters (OpenRouter, OpenAI, Anthropic, Google, NVIDIA, HuggingFace), and self-healing critic passes.
  - **Node.js `chatai-backend` (:5000)**: API gateway, JWT auth, database persistence, SSE event distribution, rollback ledgers, and billing entitlements.
- **Team & Company Orchestration**:
  - Starter templates for Marketing, Technical, Operations, and Compliance squads.
  - Cross-team dependency graph decomposition via `CompanyOrchestrator`.
  - Team-scoped shared memory backed by pgvector semantic embeddings.
  - Agent accountability ledger logging decision rationales.
  - 4-Tier organizational autonomy levels (`observe_only`, `suggest_only`, `act_with_approval`, `fully_autonomous`).

### 🛡️ Security Hardening & Prompt 0 Regression Verification
- **Fail-Fast Vault**: Immediate boot failure if `VAULT_ENCRYPTION_KEY` is missing or under 32 bytes.
- **Fail-Closed Authentication**: Eliminated all mock-token bypasses; strict JWT verification on every protected route.
- **Inter-Service Authentication Gate**: Hardened with `X-Internal-Service-Key` matching `INTERNAL_SERVICE_SECRET`.
- **Sandbox Environment Isolation**: Child process execution scrubs all host secrets, keys, and tokens (`KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `DATABASE`, `VAULT`, `SUPABASE`).
- **Destructive Action Protection**: Mandatory pre-execution approval gate for destructive actions (`file_delete`, `drop_table`, `rm -rf`).

### ⚡ Performance & Load Benchmarks
- **Concurrent Agents**: Verified 20+ concurrent agents executing simultaneously in ~3048ms (~152ms / task) without deadlock.
- **Memory Footprint**: Go runtime baseline ~11.5 MB RAM with ~10 idle goroutines.

### 📊 Radical Metering Transparency & Pre-Execution Budgeting
- **Itemized Live Provider Pricing**: Real-time per-agent, per-task cost and token tracking across OpenAI, Anthropic, Gemini, DeepSeek, Llama, and Ollama BYOK.
- **Honest Context Indicator**: Real token tracking against authoritative context limits with proactive degradation alerts at 60% and critical warnings at 85% saturation.
- **Pre-Execution Budget Guard**: Halts operations *before* spending tokens/money if projected step spend would breach task, team, or tenant budget limits.
- **Upfront Spend Forecasting**: Pre-commitment task queue cost & time estimates.
- **Audit Ledger & RFC-4180 CSV Export**: Complete historical audit log queryable via REST and exportable to RFC-4180 CSV.
- **Zero Silent Changes Commitment**: In-product policy change notices feed and public pricing catalog.

### 📜 Source-Available Licensing
- Distributed under **Business Source License 1.1 (BUSL-1.1)**, converting automatically to **Apache 2.0** on `2030-01-01`.
- Added `TRADEMARK.md` and updated `CONTRIBUTING.md` with Contributor License Agreement (CLA).

