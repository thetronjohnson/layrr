# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Layrr

Layrr is a CLI tool for visually editing web applications with AI. It proxies a running dev server, injects a browser overlay where users select elements and describe changes in natural language, then uses an AI agent (Claude Code or OpenAI Codex) to apply edits to the actual source code. Edits are auto-committed with a `[layrr]` prefix. Users can preview, restore, and permanently revert to any previous edit via the history panel.

## Build & Run

```bash
pnpm install
pnpm build          # Compiles TS + bundles overlay + copies font assets
node dist/cli.js --port <dev-server-port>  # Run locally against a dev server
```

There are no tests or lint scripts configured.

## Build System

The build (`scripts/build.ts`) does three things:
1. **Overlay bundle** — esbuild bundles `overlay/overlay.ts` → `dist/overlay.js` (IIFE, ES2020). Imports from other `overlay/` modules are bundled in.
2. **CLI + server** — `tsc` compiles `src/` → `dist/` (ESM, ES2022)
3. **Font assets** — copies Lucide icons and Geist Mono fonts from `node_modules/` → `dist/fonts/`

## Architecture

Single-package TypeScript project (ESM). Five main modules:

### `src/agents/` — Pluggable AI agents
- `base.ts` — `Agent` interface (`applyEdit()`) and shared helpers (`checkBinary()`, `spawnAgent()`)
- `claude.ts` — Claude Code agent (uses bundled `@anthropic-ai/claude-code` SDK)
- `codex.ts` — OpenAI Codex agent (spawns system `codex` CLI, needs `OPENAI_API_KEY`)
- `prompt.ts` — Builds edit prompts from element metadata + source context (single and multi-element)
- `index.ts` — Agent registry/factory

### `src/server/` — HTTP proxy + WebSocket + version control
- `proxy.ts` — Proxies to dev server, injects overlay into HTML, serves `/__layrr__/*` routes (overlay JS, fonts, edit-status, history)
- `ws-handler.ts` — Routes WebSocket messages (`edit-request`, `version-preview`, `version-restore`, `version-revert`)
- `edit-queue.ts` — FIFO queue for sequential edit processing, stores last result for status polling
- `version.ts` — Git operations for version history: preview (detached HEAD), restore (back to branch), revert (hard reset with confirmation)

### `src/editor/` — Source file resolution
- `source-mapper.ts` — Resolves which source file/line to edit. Tries React fiber / Vue instance metadata first, falls back to scored heuristic search across source files.

### `overlay/` — Browser overlay (separate build target, bundled as IIFE)
- `overlay.ts` — Entry point. Event wiring: modes (browse/edit), element selection, WebSocket messages, keyboard shortcuts, edit submission, version switching
- `constants.ts` — `L` prefix (`__layrr`) and color palette `C`
- `state.ts` — Shared mutable state (`app` object), sessionStorage persistence for mode/position/history
- `styles.ts` — All CSS with design system tokens (sizes, radii, shadows, transitions) and reusable primitives (`.icon-btn`, `.tag`, `.flyout`, `.card`, `.close`, `.confirm-overlay`)
- `elements.ts` — DOM builder (`createElements()`), `isOwn()` guard, `toast()` notifications
- `source.ts` — `element-source` integration for multi-framework source mapping (React 19+, Vue, Svelte, Solid, Preact), with manual fiber/instance fallback. Also: `getSelector()`, `posHL()`, `posLabel()`
- `history.ts` — History panel: fetches `[layrr]` commits from `/__layrr__/history`, renders paginated list with preview/revert controls and confirmation dialog

### `src/cli.ts` — Entry point
Parses args (`--port`, `--proxy-port`, `--agent`, `--no-open`), resolves/prompts for agent selection, runs preflight checks, starts proxy, and enters the edit loop with selective git staging.

### `src/config.ts` — Config persistence
Stores agent preference in `~/.layrr/config.json`.

## Key Design Decisions

- **Agent abstraction**: All AI agents implement the same `Agent` interface. Adding a new agent means implementing `applyEdit()` and registering it in `src/agents/index.ts`.
- **Overlay is vanilla TS**: No framework — bundled as IIFE and injected via HTML rewriting. All CSS is scoped with `__layrr` prefix to avoid collisions with the user's app. Never use Tailwind or unscoped styles.
- **Overlay persistence across navigations**: MutationObserver on `document.documentElement` re-injects if the overlay root is removed. Framework-specific hooks (`astro:after-swap`, `sveltekit:navigation-end`) handle full-document-swap frameworks. State survives via sessionStorage.
- **Selective staging**: Snapshots git dirty state before agent runs, only stages files that are newly changed after. Pre-existing uncommitted work is never touched.
- **Git as version control**: Every edit auto-commits. History panel shows `[layrr]` commits from `git log`. Preview uses `git checkout --detach`, restore returns to original branch, permanent revert uses `git reset --hard`. Version operations send WebSocket response BEFORE `git checkout` because the checkout triggers dev server reload which kills the connection.
- **Source resolution**: Three-tier strategy — (1) `element-source` package for React/Vue/Svelte/Solid/Preact fiber/instance metadata, (2) manual React `_debugSource` / Vue `__file` extraction as fallback, (3) heuristic text/tag/class matching across source files as last resort.
- **Design system in styles.ts**: Tokens (`size`, `radius`, `shadow`, `ease`) and reusable primitive classes (`.icon-btn`, `.flyout`, `.close`, `.tag`, `.card`, `.confirm-overlay`). New UI components should compose from these primitives.
- **Sequential edit processing**: FIFO queue ensures one edit runs at a time. No concurrent agent execution.
