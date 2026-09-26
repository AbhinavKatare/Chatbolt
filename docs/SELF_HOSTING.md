# Self-Hosting Chatbolt

This guide covers running and operating Chatbolt on your own infrastructure under the Business Source License 1.1 (BUSL-1.1).

---

## 1. System Requirements & Hardware Sizing

Running the complete polyglot three-service stack (Node.js Gateway + Go Agent-Runtime + Python Agent-Brain + PostgreSQL) has the following minimum and recommended requirements:

| Spec Component | Minimum (Evaluation / Dev) | Recommended (Production / Multi-Agent) |
|---|---|---|
| **CPU** | 2 cores (x86_64 / ARM64) | 4+ physical cores (3.0 GHz+) |
| **RAM** | 4 GB total | 8 GB - 16 GB total |
| **Storage** | 20 GB SSD | 50+ GB NVMe SSD |
| **OS** | Linux (Ubuntu 22.04+, Debian 12+), macOS, Windows 10/11 | Linux (Ubuntu 22.04 LTS / Debian 12) |
| **Container Engine** | Docker Engine 24.0+ & Docker Compose v2.20+ | Docker Engine 26.0+ with cgroups v2 |

### Service Footprint Metrics (Measured Benchmarks)
- **Go `agent-runtime`**: ~11.5 MB RAM at baseline; scales elastically under 20+ concurrent agents using bounded worker pools with goroutines.
- **Python `agent-brain`**: ~45-65 MB RAM at baseline (FastAPI + LangChain + LangGraph runtime).
- **Node.js `chatai-backend`**: ~70-110 MB RAM (Express gateway, SSE subscriptions, route handlers).
- **PostgreSQL 15 + pgvector**: ~50-150 MB RAM base footprint.

---

## 2. Environment Variables & Secret Configuration

Create a `.env` file in the repository root (never commit secrets to version control):

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:your_secure_db_password@postgres:5432/chatai
DB_PASSWORD=your_secure_db_password
DB_PORT=5432

# Master Encryption Key (32+ bytes for AES-256-GCM Vault)
VAULT_ENCRYPTION_KEY=production_vault_master_key_32_bytes_length!!

# Inter-Service Authentication Secret (Secures Node -> Go -> Python communication)
INTERNAL_SERVICE_SECRET=your_high_entropy_internal_cluster_token_64_chars

# Model Provider Keys (Encrypted in Vault or injected per-request)
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Supabase Auth / Local JWT Authentication
SUPABASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Enterprise & Billing (Optional for Self-Hosters)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 3. Quickstart with Docker Compose

1. Clone repository:
   ```bash
   git clone https://github.com/AbhinavKatare/Chatbolt.git
   cd Chatbolt
   ```

2. Generate master keys:
   ```bash
   # Generate 32-byte hex key for vault
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Launch polyglot cluster:
   ```bash
   docker compose up -d
   ```

4. Verify service health:
   ```bash
   # Check cluster status
   docker compose ps

   # Node Gateway
   curl http://localhost:5000/health
   # Go Agent-Runtime
   curl http://localhost:8081/health
   # Python Agent-Brain
   curl http://localhost:8082/health
   ```

---

## 4. Bare-Metal / Local Development Setup

If running directly on the host without containers:

### A. Start Go Agent-Runtime (Port 8081)
```bash
cd agent-runtime
go build -o bin/agent-runtime.exe ./cmd/server
./bin/agent-runtime.exe
```

### B. Start Python Agent-Brain (Port 8082)
```bash
cd agent-brain
python -m venv venv
# Windows:
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8082
# Linux / macOS:
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8082
```

### C. Start Node.js API Gateway (Port 5000)
```bash
cd chatai-backend
npm install
npm run dev
```

---

## 5. Security & Network Hardening Best Practices

1. **Keep Ports 8081 & 8082 Internal**: Never expose Go (`8081`) or Python (`8082`) ports to the public internet. Use internal Docker network or reverse proxy (e.g. Nginx, Caddy, Cloudflare Tunnel) to only expose port `5000` / `443`.
2. **Configure `INTERNAL_SERVICE_SECRET`**: Ensure all inter-service requests present `X-Internal-Service-Key` matching `INTERNAL_SERVICE_SECRET`.
3. **Sandbox Isolation**: Go runtime sanitizes execution environments, stripping all environment variables containing `KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `DATABASE`, `VAULT`, `SUPABASE`.
4. **Volume Backups**: Regularly backup PostgreSQL pgdata directory or schedule automated WAL archiving.
