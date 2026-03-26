<div align="center">

  <img src="layrr.png" alt="layrr" width="120">

  <h1>layrr</h1>

  <p>
    <strong>Point, click, and edit any web app with AI</strong>
  </p>
  <p>
    A CLI that injects a visual overlay into your running dev server. Select any element, describe what you want to change in plain English, and AI applies the edit to your source code.
  </p>

  <p>
    <a href="https://layrr.dev">Website</a> &middot;
    <a href="#features">Features</a> &middot;
    <a href="#installation">Install</a> &middot;
    <a href="#usage">Usage</a>
  </p>

  <p>
    <a href="https://www.npmjs.com/package/layrr"><img src="https://img.shields.io/npm/v/layrr?style=flat-square&color=18181b" alt="npm"></a>
    <a href="https://github.com/thetronjohnson/layrr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-18181b?style=flat-square" alt="License"></a>
  </p>
</div>

---

## Overview

**layrr** turns your browser into a visual code editor powered by AI. Instead of hunting through source files, you click on any element in your running app, describe the change you want, and your AI agent edits the actual source code — with hot reload.

Works with **Claude Code** or **OpenAI Codex CLI**. Supports React, Vue, Svelte, Solid, Preact, Astro, and any dev server.

## Features

### Visual Element Selection
- **Click to Select** — switch to Edit mode and click any element on the page
- **Multi-Select** — Shift+click to select multiple elements, apply one instruction to all
- **Element Highlighting** — visual feedback shows exactly which element you're targeting
- **Browse & Edit Modes** — toggle seamlessly between browsing and editing

### AI-Powered Edits
- **Natural Language** — describe changes in plain English: "make this red", "add padding", "change the text"
- **Source Code Editing** — AI reads the actual source file and makes minimal, precise edits
- **Hot Reload** — changes appear instantly via your dev server's HMR
- **Sequential Queue** — multiple edits are queued and processed one at a time

### Version History
- **Auto-Commit** — every edit is committed to git with a `[layrr]` prefix
- **Preview Versions** — click any past edit in the history panel to preview how the app looked at that point
- **Permanent Revert** — revert to any previous version with confirmation
- **Selective Staging** — only files changed by AI are committed, your uncommitted work is never touched

### Multi-Framework Source Mapping
- **React** (including 19+) — fiber owner stacks via `element-source`
- **Vue** — component instance metadata
- **Svelte, Solid, Preact** — framework-specific resolvers
- **Astro, HTML, others** — heuristic text/tag/class matching fallback
- **Any dev server** — Vite, Next.js, Astro, Webpack, and more

### Multi-Agent Support
- **Claude Code** — Anthropic's coding agent (bundled)
- **Codex CLI** — OpenAI's coding agent
- **Interactive Picker** — choose on first run, saved to `~/.layrr/config.json`
- **CLI Override** — switch anytime with `--agent claude` or `--agent codex`

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+K` / `Cmd+K` | Toggle Browse / Edit mode |
| `Shift+Click` | Multi-select elements |
| `Enter` | Send edit instruction |
| `Escape` | Close panel / deselect / exit edit |

## Installation

### Prerequisites

- Node.js 18+
- A running dev server (Vite, Next.js, Astro, etc.)
- One AI agent authenticated (see below)

### Install

```bash
npm install -g layrr
```

Or run directly:

```bash
npx layrr --port 3000
```

### Agent Setup

**Claude Code** (bundled — just authenticate):

```bash
claude login            # API key
claude login --sso      # SSO
claude login --bedrock  # AWS Bedrock
```

**Codex CLI**:

```bash
npm install -g @openai/codex
export OPENAI_API_KEY=<your-key>
```

## Usage

### Quick Start

```bash
# Start your dev server
pnpm dev                    # runs on port 3000

# In another terminal
npx layrr --port 3000       # opens browser at localhost:4567
```

Your browser opens with a floating toolbar at the bottom right. Click **Edit**, select an element, type your change, press Enter.

### How It Works

```
Browser (overlay)          layrr proxy                    Dev server
    |                          |                               |
    |-- click element -------->|                               |
    |-- "make this red" ------>|                               |
    |                          |-- AI edits source file ------>|
    |                          |                               |-- hot reload
    |<-- page updates --------|                               |
```

### CLI Options

```
npx layrr --port <dev-server-port> [options]

Options:
  -p, --port <number>        Dev server port (required)
  --proxy-port <number>      Layrr proxy port (default: 4567)
  --agent <name>             AI agent: claude or codex
  --no-open                  Don't open browser automatically
  -h, --help                 Show help
```

## Development

```bash
git clone https://github.com/thetronjohnson/layrr.git
cd layrr
pnpm install
pnpm build
node dist/cli.js --port 3000
```

### Project Structure

```
src/
  cli.ts              Entry point
  config.ts           Agent config (~/.layrr/config.json)
  agents/             Pluggable AI agent system
  server/             HTTP proxy + WebSocket + version control
  editor/             Source file resolution
overlay/              Browser overlay (vanilla TS, bundled as IIFE)
  overlay.ts          Entry point + event wiring
  styles.ts           CSS design system
  animate.ts          Spring animations (motion library)
  elements.ts         DOM builder + toasts
  history.ts          Version history panel
  source.ts           Element source mapping
  state.ts            Shared state + persistence
  constants.ts        Color palette + tokens
```

## Author

Built by [Kiran Johns](https://kiranjohns.com)

## License

MIT
