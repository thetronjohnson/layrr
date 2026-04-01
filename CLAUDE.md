# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Layrr

Layrr is a visual AI code editor. Users point at any element in a running web app, describe a change in plain English, and an AI agent edits the source code. Two modes:

1. **CLI** (`npx layrr --port 3000`) — open-source, proxies a local dev server, injects browser overlay
2. **Web App** — dashboard where users import GitHub repos or create new websites from templates, Layrr spins up a dev server + editor

## Monorepo Structure

pnpm workspaces + Turborepo. Three packages:

```
packages/
  cli/        — standalone CLI (npm: "layrr")
  app/        — Next.js 16 dashboard
  server/     — Hono process manager API
```

## Build & Run

```bash
pnpm install
pnpm build                      # build all via turbo
./dev.sh                        # starts server (:8787) + app (:3000), loads root .env
```

Individual packages:
```bash
pnpm --filter layrr build       # CLI only
pnpm --filter @layrr/app build  # dashboard only
pnpm --filter @layrr/server build # server only
```

Database:
```bash
cd packages/app && npx drizzle-kit push  # push schema to SQLite
```

No tests configured. App package has eslint: `pnpm --filter @layrr/app lint`.

## Environment

Single root `.env` file. `dev.sh` sources it and exports to all child processes.

```
GITHUB_CLIENT_ID=               # GitHub OAuth app
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
SESSION_SECRET=                 # 32+ char random string
SERVER_PORT=8787
SERVER_SECRET=dev-secret
LAYRR_SERVER_URL=http://localhost:8787
LAYRR_SERVER_SECRET=dev-secret
OPENROUTER_API_KEY=             # for pi-mono agent
LAYRR_AGENT=pi-mono             # default agent for hosted editor
```

## Architecture

### `packages/cli` — Visual Editor CLI

Proxies a dev server, injects browser overlay, sends edits to an AI agent.

**`src/agents/`** — Pluggable AI agents:
- `base.ts` — `Agent` interface, `AgentName` type (`'claude' | 'codex' | 'pi-mono'`), `PUBLIC_AGENTS` (excludes pi-mono from CLI picker)
- `claude.ts` — Claude Code (bundled `@anthropic-ai/claude-code` SDK)
- `codex.ts` — OpenAI Codex (spawns system `codex` CLI)
- `pi-mono.ts` — Pi Mono (SDK mode, `@mariozechner/pi-coding-agent`). Uses Claude Sonnet 4.6 via OpenRouter. Internal-only — hidden from CLI users, used by hosted editor.
- `index.ts` — Agent registry. `AGENT_LIST` shows only public agents. `isValidAgent()` accepts all including pi-mono.
- `prompt.ts` — Builds edit prompts from element metadata + source context

**`src/server/`** — HTTP proxy + WebSocket:
- `proxy.ts` — Proxies to dev server, injects overlay into HTML, serves `/__layrr__/*` routes. Strips `content-encoding` and `content-length` from proxied responses to prevent gzip mismatch.
- `ws-handler.ts` — Routes WebSocket messages (edit-request, version-preview/restore/revert)
- `version.ts` — Git operations for version history
- `edit-queue.ts` — Sequential edit processing

**`overlay/`** — Browser UI (vanilla TS, IIFE bundle):
- `overlay.ts` — Entry point, event wiring, mode switching
- `styles.ts` — CSS design system with tokens and primitives. All scoped with `__layrr` prefix. Never use Tailwind in overlay.
- `elements.ts` — DOM builder + toast notifications
- `state.ts` — Shared state + persistence
- `constants.ts` — Color palette + tokens
- `animate.ts` — Spring animations via `motion` library
- `history.ts` — Version history panel with preview/revert
- `source.ts` — `element-source` integration for multi-framework source mapping

**Build**: `scripts/build.ts` — esbuild bundles overlay (IIFE), tsc compiles src (ESM), copies fonts

### `packages/app` — Next.js Dashboard

**Stack**: Next.js 16, Tailwind 4, Drizzle ORM + SQLite, arctic (GitHub OAuth), iron-session, Framer Motion, Lucide React

**`src/lib/`**:
- `auth.ts` — GitHub OAuth via arctic, sessions via iron-session
- `db.ts` — Drizzle + better-sqlite3 (lazy proxy to avoid build-time connection)
- `schema.ts` — Tables: `users`, `projects` (with `sourceType`: github/template, `initialPrompt`), `editEvents`
- `server-api.ts` — HTTP client to Hono server (startContainer, stopContainer, getContainerStatus, createFromTemplate, pushProject, freshCloneProject, getEditHistory)
- `github.ts` — GitHub API (list/get repos)

**Key pages**:
- `/dashboard` — Project grid with status pills, "New Website" + "Import" buttons
- `/dashboard/new` — Template project creation (name + prompt → AI generates first version)
- `/dashboard/import` — GitHub repo selector modal (search, keyboard nav, pagination)
- `/dashboard/project/[id]` — Editor controls, edit history from git, push to GitHub, fresh clone
- `/sign-in` — GitHub OAuth

**Auth flow**: GitHub OAuth → arctic → fetch user + email → upsert SQLite → iron-session cookie

**Design**: Dark-only, Geist Mono, glassmorphic cards, Tailwind 4 `@theme inline` color tokens

### `packages/server` — Process Manager

**Stack**: Hono + @hono/node-server, ws, dotenv

Manages user projects as local child processes. Loads root `.env` via dotenv.

**Endpoints** (all require `Authorization: Bearer` secret):
- `POST /projects/:id/start` — Clone (if needed), detect framework/PM, install deps, start dev server + layrr proxy
- `POST /projects/:id/stop` — Kill processes, release ports
- `GET /projects/:id/status` — Process state + edit count from git
- `POST /projects/:id/create-from-template` — Copy template, install, git init, start servers, run initial AI prompt via WebSocket
- `POST /projects/:id/push` — Push `[layrr]` commits to GitHub branch
- `POST /projects/:id/fresh-clone` — Delete workspace for re-clone
- `GET /projects/:id/edits` — `[layrr]` commits from git log
- `GET /projects/:id/logs` — Process stdout/stderr

**Key behaviors**:
- Workspaces at `~/.layrr/workspaces/{projectId}/`
- Port pools: dev 5100-5199, proxy 6100-6199. Checks actual availability via `net.createServer`.
- Framework detection from `package.json` → framework-specific dev commands
- Orphan process cleanup on startup (scans port ranges, kills via `lsof`)
- Workspace reuse: starting existing project skips clone. Only `fresh-clone` deletes.
- Git identity from user's GitHub username + email
- `detached: true` on spawn for clean group kills
- Template creation sends initial prompt to proxy via WebSocket (`sendEditViaProxy`)

### `packages/server/templates/nextjs-shadcn/`

Pre-built Next.js + shadcn + Tailwind template. Copied (not cloned) for new websites. Contains:
- Next.js with App Router
- Tailwind CSS 4 + shadcn/ui (Base Nova style)
- Button component pre-installed
- `pnpm-lock.yaml` for fast install

## How Packages Connect

```
Browser → Next.js App (:3000) → Hono Server (:8787) → Child Processes
                                                        ├── dev server (:5100+)
                                                        └── layrr proxy (:6100+)
Browser (new tab) → layrr proxy (:6100+) → dev server (:5100+)
```

Two project creation flows:
1. **Import**: Dashboard → select GitHub repo → server clones → starts servers
2. **New Website**: Dashboard → name + prompt → server copies template → installs → starts servers → sends prompt via WebSocket to proxy → AI generates code

## Known Issues

- Process manager state is in-memory (lost on server restart, but workspaces persist on disk)
- Template projects: if server restarts, clicking "Start Editor" works (reuses workspace) but the start API previously required GitHub token even for template projects (fixed with `sourceType` check)
- Pi-mono agent requires `OPENROUTER_API_KEY` — fails silently if not set
- `pnpm install` runs on every start (even if node_modules exists) — could skip if lockfile unchanged
