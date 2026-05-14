# ⚡ Chatbolt: Autonomous AI Orchestration Platform

Chatbolt is a high-fidelity, production-grade AI platform designed to deploy autonomous digital workforces. Built for speed and scale, it leverages specialized LLMs to handle everything from research and writing to daily operational reporting.

![Chatbolt Dashboard](https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200)

## 🏗️ Architecture
Chatbolt uses a multi-agent orchestration pattern powered by **NVIDIA NIM** and **Supabase**.

```mermaid
graph TD
    User((User)) -->|Interact| Frontend[Next.js 14 Dashboard]
    Frontend -->|Auth| SupabaseAuth[Supabase Auth]
    Frontend -->|API| Backend[Node.js Orchestrator]
    
    subgraph AI Workforce (NVIDIA NIM)
        Backend -->|Reasoning| Qwen[Qwen 2.5 - REASONER]
        Backend -->|Content| Llama[Llama 3.1 - WRITER]
        Backend -->|Schema| Nemotron[Nemotron 4 - ARCHITECT]
    end
    
    Backend -->|Persistence| Postgres[(PostgreSQL)]
    Backend -->|Reports| Resend[Resend Email API]
```

## 🚀 Key Features
- **Autopilot Workforce**: One-click deployment of specialized agent teams (Researcher, Writer, Analyst).
- **Executive Reporting**: AI-synthesized daily business reports delivered via email.
- **BYOK (Bring Your Own Key)**: Support for enterprise keys (NVIDIA, OpenAI, etc.) stored in a secure vault.
- **Embedded Widget**: Deploy support agents to any website with a single script tag.

## 🛠️ Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, tsx.
- **Database**: Supabase (PostgreSQL + Auth).
- **AI Orchestration**: NVIDIA NIM, OpenRouter.
- **Communication**: Resend (Transactional Email).

## 🚦 Getting Started

### 1. Prerequisites
- Node.js 18+
- Supabase Account
- NVIDIA NIM API Key
- Resend API Key

### 2. Setup Backend
```bash
cd chatai-backend
npm install
# Copy .env.example to .env and fill in your keys
npm run dev
```

### 3. Setup Frontend
```bash
cd frontend
npm install
# Copy .env.example to .env and fill in your Supabase keys
npm run dev
```

## 📂 Project Structure
```text
chatbolt/
├── frontend/           # Next.js 14 Dashboard & Landing
├── chatai-backend/     # Node.js Agent Orchestrator
└── schema.sql          # Master Supabase Database Schema
```

## ⚖️ License
MIT License - Copyright (c) 2026 Chatbolt Inc.
