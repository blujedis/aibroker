# AiBroker

An opinionated, OpenAI-compatible LLM proxy with profiles, virtual API keys, budgets, guardrails, MCP support, and a first-class dashboard.

Built with **Node.js**, **TypeScript**, **SvelteKit 2 (Svelte 5 runes)**, **Tailwind CSS 4**, **shadcn-svelte-style** components, and **PostgreSQL** via **drizzle-orm**.

## Features

- OpenAI-compatible endpoints: `POST /v1/chat/completions` (streaming + non-streaming), `GET /v1/models`
- Parallel request handling with a configurable upstream concurrency limit
- **Client profiles** with optional global `daily` / `weekly` / `monthly` / unlimited budgets
- **Virtual API keys** tied to a profile, with their own budgets and optional model allow-lists
- Profile-scoped resources with global fallback for backends, guardrails, MCP servers, and skills
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

Run schema migrations before starting the app on a fresh environment:

```bash
pnpm db:migrate
pnpm db:seed
```

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

## Profile-scoped resources

AiBroker supports two scope types for configurable resources:

- `Global` scope (`profile_id = null`): resource is available to every profile
- `Profile` scope (`profile_id = <profile id>`): resource is only available to that profile

Effective scope at request time uses this rule:

- accessible resources = global resources + resources owned by the key's profile

Behavior notes:

- Backends inherit scope to all models attached to that backend
- Virtual-key allow-lists are auto-cleaned on save; ineligible models are removed
- Router rejects model usage when backend scope does not match key profile
- Guardrails execute only from the effective scope of the request profile

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@local` | Created on first run if no users exist |
| `BOOTSTRAP_ADMIN_PASSWORD` | `admin` | Password for the bootstrap user |
| `SESSION_TTL` | `1h` | Session lifetime; supports `m`, `h`, `d`, `y` (e.g. `90m`, `12h`, `7d`, `1y`) |
| `REFRESH_TOKEN_TTL` | `30d` | Refresh-token lifetime for silent re-authentication; supports `m`, `h`, `d`, `y` |
| `MFA_BREAK_GLASS_EXPIRY_MINUTES` | `10` | Expiry window for emailed emergency MFA recovery links |
| `MAX_CONCURRENT_UPSTREAM` | `32` | Max parallel upstream fetches across the whole server |
| `SCOPE_OBSERVABILITY_LOGS` | `1` | Set to `0` to disable structured scope decision logs |

## Scripts

```bash
pnpm dev         # dev server with HMR
pnpm build       # production build (adapter-node)
pnpm start       # run the built server
pnpm check       # svelte-check / tsc
pnpm test        # alias for unit tests (runs test:unit)
pnpm test:unit   # vitest unit/action tests
pnpm test:smoke  # runtime smoke flow checks (requires running dev server)
```

## Testing

- Unit tests:

```bash
pnpm test
```

- Smoke tests (run with a live app process):

```bash
pnpm dev
pnpm test:smoke
```

Smoke tests exercise login/session/logout and protected-route access using bootstrap credentials from env (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`).

- Build gating:

`pnpm build` automatically runs `prebuild`, which executes:

```bash
pnpm check && pnpm run test:unit
```

Smoke tests are intentionally not part of `prebuild` because they depend on a running server and runtime environment.

## Layout

- `src/lib/server/db/` — drizzle schema, bootstrap DDL, seed
- `src/lib/server/auth/` — argon2 password hashing, session cookies
- `src/lib/server/proxy/` — backend adapter, router, cost, budget, concurrency limit
- `src/lib/server/guardrails/` — three-stage guardrail engine
- `src/lib/server/stats.ts` — dashboard aggregations
- `src/routes/v1/*` — OpenAI-compatible public endpoints
- `src/routes/(app)/*` — authenticated dashboard (profiles, keys, models, guardrails, requests, mcp, skills, settings, profile)
