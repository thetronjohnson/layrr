# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Layrr

Layrr is a visual AI code editor. It lets users point at any element in a running web app, describe a change in plain English, and an AI agent edits the source code. It exists in two forms:

1. **CLI** (`npx layrr --port 3000`) — open-source tool that proxies a local dev server and injects a browser overlay for visual editing
2. **Web App** (app.layrr.dev) — hosted dashboard where users connect GitHub repos, and Layrr spins up a dev server + editor for them without touching the terminal

## Monorepo Structure

pnpm workspaces + Turborepo. Three packages:

```
packages/
  cli/        — standalone CLI tool (npm: "layrr")
  app/        — Next.js 16 dashboard
  server/     — Hono process manager API
```

## Build & Run

```bash
pnpm install                    # install all packages
pnpm build                      # build all via turbo

# Local development (starts server + app)
./dev.sh                        # or: pnpm dev

# CLI only
cd packages/cli && pnpm build
node dist/cli.js --port 3000

# Database
cd packages/app && npx drizzle-kit push
```

Dashboard runs at `http://localhost:3000`, server at `http://localhost:8787`.

No tests or lint scripts configured.

## Environment Variables

`packages/app/.env.local`:
```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
SESSION_SECRET=               # 32+ char random string
LAYRR_SERVER_URL=http://localhost:8787
LAYRR_SERVER_SECRET=dev-secret
```

## Architecture

### `packages/cli` — Visual Editor CLI

Proxies a dev server, injects a browser overlay, sends edit requests to an AI agent.

**`src/`** — Node.js server:
- `cli.ts` — Entry point. Parses args, resolves agent, ensures git repo, enters edit loop with selective staging
- `server/proxy.ts` — HTTP proxy that injects overlay into HTML, serves `/__layrr__/*` routes (overlay JS, fonts, edit-status, history)
- `server/ws-handler.ts` — Routes WebSocket messages to edit queue or version operations
- `server/version.ts` — Git preview/restore/revert (detached HEAD for preview, reset for revert)
- `server/edit-queue.ts` — Sequential edit processing
- `agents/` — Pluggable AI agents. `Agent` interface with `applyEdit()`. Claude Code (bundled SDK) and Codex (system CLI)
- `editor/source-mapper.ts` — Maps DOM elements to source files. Three-tier: `element-source` package → manual fiber/instance extraction → heuristic text/tag/class search

**`overlay/`** — Browser UI (vanilla TS, bundled as IIFE by esbuild):
- `overlay.ts` — Entry point. Modes (browse/edit), element selection, WebSocket, keyboard shortcuts
- `styles.ts` — CSS design system with tokens and reusable primitives. All classes scoped with `__layrr` prefix. Never use Tailwind in the overlay.
- `animate.ts` — Spring animations via `motion` library. Bar expand/collapse, panel swaps, toasts, stagger
- `elements.ts` — DOM builder, `toast()`, `isOwn()` guard
- `history.ts` — Version history panel with preview/revert
- `source.ts` — `element-source` integration for React 19+, Vue, Svelte, Solid, Preact
- `state.ts` — Shared mutable state, sessionStorage persistence
- `constants.ts` — `L` prefix and color palette `C`

**Key patterns**:
- Overlay persists across SPA navigations via MutationObserver + framework-specific hooks (`astro:after-swap`, `sveltekit:navigation-end`)
- Every edit auto-commits with `[layrr]` prefix. Selective staging only commits agent-changed files.
- `barExpand`/`barCollapse` animations use `motion` with `springSmooth` config. `cancelBarAnim()` with `.stop()` handles interruptions.
- Version operations send WebSocket response BEFORE `git checkout` (checkout triggers reload which kills WS)

### `packages/app` — Next.js Dashboard

Users sign in with GitHub, import repos, start/stop editors, view edit history, push changes.

**Stack**: Next.js 16 (App Router) + Tailwind 4 + Drizzle ORM + SQLite + arctic (GitHub OAuth) + iron-session + Framer Motion

**`src/lib/`**:
- `auth.ts` — GitHub OAuth via `arctic`, encrypted sessions via `iron-session`
- `db.ts` — Drizzle + better-sqlite3. DB file at `layrr.db` in cwd
- `schema.ts` — Three tables: `users`, `projects`, `editEvents`
- `server-api.ts` — HTTP client to the process manager server (auth via shared secret)
- `github.ts` — GitHub API (list repos, get repo)

**`src/app/`** pages:
- `/` — Landing, redirects to dashboard if logged in
- `/sign-in` — GitHub OAuth button
- `/dashboard` — Project grid with status pills, import modal
- `/dashboard/project/[id]` — Editor controls (start/stop/open), edit history from git, push to GitHub, fresh clone

**Auth flow**: GitHub OAuth → `arctic` exchanges code → fetch user + email from GitHub API → upsert in SQLite → set `iron-session` cookie

**Design language**: Dark-only, Geist Mono font, glassmorphic cards (`bg-card`, `ring-1 ring-foreground/10`), Tailwind 4 with `@theme inline` color tokens matching layrr.dev site

### `packages/server` — Process Manager

Hono API that manages user projects as local child processes. No containers.

**Endpoints** (all require `Authorization: Bearer` with shared secret):
- `POST /projects/:id/start` — Clone repo (if needed), detect framework/PM, install deps, spawn dev server + layrr proxy
- `POST /projects/:id/stop` — Kill processes, release ports
- `GET /projects/:id/status` — Process state, ports, framework, edit count from git
- `GET /projects/:id/edits` — `[layrr]` commits from git log
- `POST /projects/:id/push` — Push edits to GitHub branch
- `POST /projects/:id/fresh-clone` — Delete workspace for re-clone on next start

**Key patterns**:
- Workspaces at `~/.layrr/workspaces/{projectId}/`
- Port pools: dev 5100-5199, proxy 6100-6199. Checks actual port availability before allocating.
- Framework detection from `package.json` deps → framework-specific dev commands (e.g., `npx next dev -p PORT -H 0.0.0.0`)
- Orphan process cleanup on startup: scans port ranges, kills any PIDs found via `lsof`
- Workspace reuse: starting an existing project skips clone, preserves edits. Only `fresh-clone` deletes.
- Git identity set from user's GitHub username + email
- `detached: true` on child processes for clean group kills via `process.kill(-pid)`

## How the Packages Connect

```
Browser → Next.js App (:3000) → Hono Server (:8787) → Child Processes
                                                        ├── dev server (:5100+)
                                                        └── layrr proxy (:6100+)
         Browser (new tab) → layrr proxy (:6100+) → dev server (:5100+)
```

The dashboard calls the server via `server-api.ts`. The server spawns the CLI's proxy process which serves the overlay. Users open the proxy URL in a new tab to use the visual editor.
