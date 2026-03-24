# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Layrr

Layrr is a CLI tool for visually editing web applications with AI. It proxies a running dev server, injects a browser overlay where users select elements and describe changes in natural language, then uses an AI agent (Claude Code or OpenAI Codex) to apply edits to the actual source code. Edits are auto-committed with a `[layrr]` prefix and can be undone via `git revert`.

## Build & Run

```bash
pnpm install
pnpm build          # Compiles TS + bundles overlay + copies font assets
node dist/cli.js --port <dev-server-port>  # Run locally against a dev server
```

There are no tests or lint scripts configured.

## Build System

The build (`scripts/build.ts`) does three things:
1. **Overlay bundle** — esbuild bundles `overlay/overlay.ts` → `dist/overlay.js` (IIFE, ES2020)
2. **CLI + server** — `tsc` compiles `src/` → `dist/` (ESM, ES2022)
3. **Font assets** — copies Lucide icons and Geist Mono fonts from `node_modules/` → `dist/fonts/`

## Architecture

Single-package TypeScript project (ESM). Four main modules:

### `src/agents/` — Pluggable AI agents
- `base.ts` — `Agent` interface (`applyEdit()`) and shared helpers (`checkBinary()`, `spawnAgent()`)
- `claude.ts` — Claude Code agent (uses bundled `@anthropic-ai/claude-code` SDK)
- `codex.ts` — OpenAI Codex agent (spawns system `codex` CLI, needs `OPENAI_API_KEY`)
- `prompt.ts` — Builds edit prompts from element metadata + source context (supports single and multi-element edits)
- `index.ts` — Agent registry/factory

### `src/server/` — HTTP proxy + WebSocket
- `proxy.ts` — Proxies requests to the target dev server, injects overlay script into HTML responses, serves `/__layrr__/*` routes (overlay JS, fonts, edit-status, WebSocket)
- `ws-handler.ts` — Handles `edit-request` and `undo-request` WebSocket messages
- `edit-queue.ts` — FIFO queue for edits, manages git-based undo (checks if last commit has `[layrr]` prefix)

### `src/editor/` — Source file resolution
- `source-mapper.ts` — Resolves which source file/line to edit. First tries React fiber / Vue instance metadata from the overlay. Falls back to a scored heuristic search across `.tsx/.jsx/.vue/.svelte/.html/.astro/.ts/.js` files, matching by text content, tag name, and CSS classes.

### `overlay/` — Browser overlay (separate build target, not in `src/`)
- `overlay.ts` — ~1000 lines of vanilla TypeScript injected into the proxied page. Handles element selection (including multi-select with Shift+Click), edit panel UI, keyboard shortcuts (Alt/Cmd+K to toggle, Esc to deselect), WebSocket communication, and toast notifications.

### `src/cli.ts` — Entry point
Parses args (`--port`, `--proxy-port`, `--agent`, `--no-open`), resolves/prompts for agent selection, runs preflight checks, starts proxy, and enters the edit loop.

### `src/config.ts` — Config persistence
Stores agent preference in `~/.layrr/config.json`.

## Key Design Decisions

- **Agent abstraction**: All AI agents implement the same `Agent` interface. Adding a new agent means implementing `applyEdit()` and registering it in `src/agents/index.ts`.
- **Overlay is vanilla TS**: No framework — it's bundled as IIFE and injected via HTML rewriting in the proxy.
- **Git-based undo**: Every successful edit is auto-committed. Undo uses `git revert HEAD --no-edit` to safely create a reverting commit (preserves history and uncommitted work). Only works for the most recent `[layrr]` edit.
- **Selective staging**: Only files changed by the agent are staged for commit. Pre-existing dirty files in the working tree are left untouched by snapshotting dirty state before the agent runs and diffing after.
- **Source resolution strategy**: Prefers metadata from React/Vue internals when available, falls back to heuristic file scoring.
