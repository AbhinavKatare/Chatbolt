# ChatAI Backend

Full AI customer support platform backend — Express + TypeScript + PostgreSQL + pgvector + OpenAI + Stripe.

---

## Quick Start (Local Dev)

### Option A — Docker (recommended, zero setup)
```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and STRIPE keys in .env

docker-compose up -d          # starts Postgres + pgvector
npm install
npm run db:migrate            # creates all tables
npm run dev                   # starts backend on :4000
```

### Option B — Manual
```bash
# 1. Install Postgres with pgvector extension
# 2. Create DB: createdb chatai
# 3. Copy env
cp .env.example .env          # fill in all values

npm install
npm run db:migrate
npm run dev
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register — returns JWT |
| POST | `/auth/login` | Login — returns JWT |
| GET  | `/auth/me` | Get current tenant |
| POST | `/auth/change-password` | Change password |

**Signup body:**
```json
{ "name": "Acme Inc", "email": "hello@acme.com", "password": "secure123" }
```

**All protected routes need header:**
```
Authorization: Bearer <jwt_token>
```

---

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/agents` | List all agents |
| POST   | `/agents` | Create agent |
| GET    | `/agents/:id` | Get agent |
| PATCH  | `/agents/:id` | Update agent |
| DELETE | `/agents/:id` | Deactivate agent |
| GET    | `/agents/:id/embed-code` | Get widget embed code |

**Create agent body:**
```json
{
  "name": "Support Bot",
  "system_prompt": "You are a helpful support agent for Acme Inc...",
  "persona": { "tone": "friendly" },
  "widget_config": {
    "primaryColor": "#B8FF00",
    "welcomeMessage": "Hi! How can I help?"
  }
}
```

---

### Documents (Knowledge Base)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/agents/:id/documents` | List documents |
| POST   | `/agents/:id/documents/upload` | Upload file (multipart) |
| POST   | `/agents/:id/documents/url` | Add URL |
| POST   | `/agents/:id/documents/text` | Add raw text |
| POST   | `/agents/:id/documents/:docId/reingest` | Re-process |
| GET    | `/agents/:id/documents/:docId/status` | Check status |
| DELETE | `/agents/:id/documents/:docId` | Delete |

**Upload file:**
```bash
curl -X POST /agents/:id/documents/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@manual.pdf"
```

**Add URL:**
```json
{ "url": "https://yoursite.com/faq" }
```

---

### Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/:agentId/stream` | JWT | SSE streaming response |
| POST | `/chat/:agentId/message` | JWT | Non-streaming JSON |
| POST | `/chat/widget/:agentId/stream` | API Key | Widget SSE (public) |
| GET  | `/chat/:agentId/conversations` | JWT | List conversations |
| GET  | `/chat/:agentId/conversations/:convId/messages` | JWT | Message history |
| POST | `/chat/:agentId/conversations/:convId/resolve` | JWT | Mark resolved |

**Stream chat (SSE):**
```json
{ "message": "What is your return policy?", "session_id": "user-123", "history": [] }
```

**SSE events returned:**
```
data: {"type":"sources","sources":[...],"escalate":false}
data: {"type":"delta","delta":"Our return"}
data: {"type":"delta","delta":" policy..."}
data: {"type":"done","tokens":42}
```

---

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/billing/plans` | List plans + prices |
| POST | `/billing/checkout` | Create Stripe checkout session |
| POST | `/billing/portal` | Open Stripe billing portal |
| GET  | `/billing/subscription` | Current subscription |
| GET  | `/billing/credits` | Credits balance + history |
| POST | `/billing/webhook` | Stripe webhook (raw body) |

---

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/overview?days=30&agentId=` | Key metrics |
| GET | `/analytics/conversations-over-time?days=30` | Daily chart data |
| GET | `/analytics/top-queries?limit=10` | Most asked questions |
| GET | `/analytics/credits-usage` | Daily credit consumption |

---

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api-keys` | List keys |
| POST   | `/api-keys` | Create key |
| DELETE | `/api-keys/:id` | Revoke key |

---

### Widget
| Endpoint | Description |
|----------|-------------|
| `GET /widget.js` | Embeddable script |
| `GET /widget/:agentId` | Chat UI iframe |

**Embed on any website:**
```html
<script src="https://your-api.com/widget.js" data-agent-id="YOUR_AGENT_ID" defer></script>
```

---

## Environment Variables

```env
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatai
JWT_SECRET=change-this-in-production
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_HOBBY=price_...
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_PRO=price_...
FRONTEND_URL=http://localhost:3000
WIDGET_BASE_URL=http://localhost:4000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50
```

---

## Deploy to Production

### Railway (easiest)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway add postgresql   # adds managed Postgres
```

### Render
1. Connect GitHub repo
2. Set environment variables
3. Build command: `npm install && npm run build && npm run db:migrate`
4. Start command: `npm start`

### Stripe Webhook Setup
```bash
# Local testing
stripe listen --forward-to localhost:4000/billing/webhook

# Production — add webhook endpoint in Stripe dashboard:
# https://your-api.com/billing/webhook
# Events: customer.subscription.*, invoice.payment_succeeded, payment_intent.succeeded
```

---

## Launch Checklist

### Backend ✅
- [x] Auth (signup/login/JWT)
- [x] Multi-tenant isolation (every query scoped by tenant_id)
- [x] Agent CRUD + plan limits
- [x] Document ingestion pipeline (PDF, URL, text, CSV)
- [x] Vector embeddings (OpenAI text-embedding-3-small)
- [x] RAG chat with GPT-4o streaming (SSE)
- [x] Smart escalation detection
- [x] Credit deduction per message
- [x] Stripe subscriptions + webhooks
- [x] Monthly credit refills on renewal
- [x] Embeddable widget (JS + iframe UI)
- [x] API key auth for widget
- [x] Analytics endpoints
- [x] Rate limiting + helmet security
- [x] Docker + docker-compose

### Still needed for full launch
- [ ] Email verification on signup (use Resend or SendGrid)
- [ ] Password reset flow
- [ ] Frontend dashboard (Next.js — connect to these APIs)
- [ ] WhatsApp integration (Twilio)
- [ ] Slack integration (Slack Bolt)
- [ ] Voice support (Twilio + Deepgram)
- [ ] Admin panel (manage all tenants)
- [ ] Automated tests (Jest + Supertest)
