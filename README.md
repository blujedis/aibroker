# Nostraproxy

An opinionated, OpenAI-compatible LLM proxy with profiles, virtual API keys, budgets, guardrails, MCP support, and a first-class dashboard.

Built with **Node.js**, **TypeScript**, **SvelteKit 2 (Svelte 5 runes)**, **Tailwind CSS 4**, **shadcn-svelte-style** components, and **SQLite** via **drizzle-orm**.

## Features

- OpenAI-compatible endpoints: `POST /v1/chat/completions` (streaming + non-streaming), `GET /v1/models`
- Parallel request handling with a configurable upstream concurrency limit
- **Client profiles** with optional global `daily` / `weekly` / `monthly` / unlimited budgets
- **Virtual API keys** tied to a profile, with their own budgets and optional model allow-lists
- Per-request cost attribution (input/output tokens × per-1M pricing)
- **Guardrails** in three stages:
  - `pre` — inspect and redact (or block) the inbound payload
  - `during` — inspect streaming deltas live
  - `post` — inspect / redact the final response text
- Kinds: `regex_block`, `regex_redact`, `keyword_block`, `max_tokens`, `pii_redact`
- Guardrails produce the same shape of OpenAI error envelope when they block
- Full tracking of requests, tokens, cost, latency, streaming, success, and errors
- Dashboard with KPI cards and charts for requests, spend, tokens, and guardrail blocks
- Date-range filtering (today, 7d, last month, MTD, last year, custom)
- Multiple backends (OpenAI-compatible, Anthropic) with enable/disable toggles
- MCP server registry and reusable skill instructions
- Collapsible sidebar, sticky header, user dropdown (profile / settings / logout)
- Dark mode by default

## Quick start

```bash
pnpm install
pnpm dev
```

The server starts at http://localhost:5173. Sign in with the bootstrap admin:

- Email: `admin@local`
- Password: `admin`

Override via env:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD=changeme pnpm dev
```

The SQLite DB is created automatically at `./data/nostraproxy.db` — no migrations to run.

## Using the proxy

Once you have configured a backend, a model, a profile, and issued a virtual key, call the proxy exactly like OpenAI:

```bash
curl http://localhost:5173/v1/chat/completions \
  -H "Authorization: Bearer np-<your-virtual-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"hello"}],
    "stream": false
  }'
```

The `model` field uses the **public id** you configured on the Models page, which is mapped to the upstream id and backend automatically.

Streaming works identically — set `"stream": true` and the proxy forwards SSE frames end-to-end while running `during`-stage guardrails on each delta.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@local` | Created on first run if no users exist |
| `BOOTSTRAP_ADMIN_PASSWORD` | `admin` | Password for the bootstrap user |
| `MAX_CONCURRENT_UPSTREAM` | `32` | Max parallel upstream fetches across the whole server |

## Scripts

```bash
pnpm dev      # dev server with HMR
pnpm build    # production build (adapter-node)
pnpm start    # run the built server
pnpm check    # svelte-check / tsc
```

## Layout

- `src/lib/server/db/` — drizzle schema, bootstrap DDL, seed
- `src/lib/server/auth/` — argon2 password hashing, session cookies
- `src/lib/server/proxy/` — backend adapter, router, cost, budget, concurrency limit
- `src/lib/server/guardrails/` — three-stage guardrail engine
- `src/lib/server/stats.ts` — dashboard aggregations
- `src/routes/v1/*` — OpenAI-compatible public endpoints
- `src/routes/(app)/*` — authenticated dashboard (profiles, keys, models, guardrails, requests, mcp, skills, settings, profile)
