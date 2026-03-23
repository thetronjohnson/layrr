<div align="center">

  <h1>layrr</h1>

  <p>
    <strong>Point, click, and edit any web app with AI</strong>
  </p>
  <p>
    <strong>A CLI that injects a visual overlay into your running dev server. Select any element, describe what you want to change in plain English, and AI applies the edit to your source code.</strong>
  </p>

  <p>
    <a href="#features"><img src="https://img.shields.io/badge/Features-✨-blue?style=for-the-badge" alt="Features"></a>
    <a href="#installation"><img src="https://img.shields.io/badge/Install-🚀-green?style=for-the-badge" alt="Installation"></a>
    <a href="#usage"><img src="https://img.shields.io/badge/Usage-📖-purple?style=for-the-badge" alt="Usage"></a>
    <a href="#development"><img src="https://img.shields.io/badge/Develop-🛠️-orange?style=for-the-badge" alt="Development"></a>
  </p>
</div>

> [!NOTE]
> This project is not affiliated with, endorsed by, or sponsored by Anthropic. Claude is a trademark of Anthropic, PBC. This is an independent developer tool using Claude Code.

## Overview

**layrr** turns your browser into a visual code editor powered by AI. Instead of hunting through source files, you click on any element in your running app, describe the change you want, and your AI agent edits the actual source code for you — with hot reload.

Think of layrr as a bridge between your browser and your codebase — making frontend edits as easy as pointing and talking. Works with **Claude Code** or **OpenAI Codex CLI**.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Visual Element Selection](#-visual-element-selection)
  - [AI-Powered Edits](#-ai-powered-edits)
  - [Multi-Agent Support](#-multi-agent-support)
  - [Undo](#-undo)
  - [Framework Support](#-framework-support)
  - [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Usage](#usage)
  - [Quick Start](#quick-start)
  - [How It Works](#how-it-works)
  - [CLI Options](#cli-options)
- [Installation](#installation)
- [Development](#development)
- [License](#license)

## Features

### ✨ **Visual Element Selection**
- **Overlay Toolbar**: A non-intrusive toolbar injected into your running app
- **Click to Select**: Switch to Edit mode and click any element on the page
- **Multi-Select**: Shift-click to select multiple elements and apply a single instruction to all of them
- **Element Highlighting**: Visual feedback shows exactly which element you're targeting
- **Browse & Edit Modes**: Seamlessly toggle between browsing your app and editing elements

### 🤖 **AI-Powered Edits**
- **Natural Language**: Describe changes in plain English — "make this red", "add padding", "change the text"
- **Source Code Editing**: Your AI agent reads the actual source file and makes minimal, precise edits
- **Hot Reload**: Changes appear instantly via your dev server's HMR
- **Edit Queue**: Multiple edits are queued and processed sequentially

### 🔀 **Multi-Agent Support**
- **Claude Code**: Anthropic's coding agent (bundled via `@anthropic-ai/claude-code`)
- **Codex CLI**: OpenAI's coding agent (`npm install -g @openai/codex`)
- **Interactive Picker**: On first run, layrr prompts you to choose an agent and saves your preference to `~/.layrr/config.json`
- **CLI Override**: Switch agents anytime with `--agent claude` or `--agent codex`

### ↩ **Undo**
- **One-Click Revert**: Each AI edit is auto-committed with a `[layrr]` prefix — undo rolls back the last commit instantly
- **Safe**: Only reverts layrr commits, never your own work

### 🔌 **Framework Support**
- **React**: Source file resolution via fiber metadata
- **Vue**: Source file resolution via component metadata
- **Astro, Svelte, HTML**: Source file resolution via file search heuristics
- **Any Framework**: Falls back to text and class matching for other frameworks
- **Works with any dev server**: Vite, Next.js, Astro, Webpack, and more

### ⌨️ **Keyboard Shortcuts**

| Shortcut | Action |
|---|---|
| `Alt+K` / `Cmd+K` | Toggle between Browse and Edit mode |
| `Shift+Click` | Add/remove element from multi-selection |
| `Enter` | Send edit instruction |
| `Esc` | Deselect element or exit Edit mode |

## Usage

### Quick Start

```bash
# In your web project directory
pnpm dev                    # start your dev server on port 3000

# In another terminal
layrr --port 3000           # opens browser at localhost:4567
```

Your browser opens with an overlay toolbar in the bottom-right corner. Click **Edit**, select an element, type your change, and hit Enter.

### How It Works

```
Browser (overlay)          layrr proxy (localhost:4567)          Dev server (localhost:3000)
     │                              │                                    │
     │──── select element ─────────>│                                    │
     │──── "make this red" ────────>│                                    │
     │                              │──── AI agent edits file ─────────> │
     │                              │                                    │── HMR reload
     │<──── Done! ─────────────────│                                    │
```

1. **Proxy & Inject**: layrr proxies your dev server and injects a small overlay
2. **Select**: You switch to Edit mode and click any element on the page
3. **Describe**: You describe the change in natural language
4. **Edit**: Your AI agent reads the source file, makes the minimal edit, and saves it
5. **Reload**: Your dev server hot-reloads the page

### CLI Options

```
Usage:
  npx layrr --port <dev-server-port> [options]

Options:
  -p, --port <number>        Dev server port (required)
  --proxy-port <number>      Layrr proxy port (default: 4567)
  --agent <name>             AI agent to use (claude, codex)
  --no-open                  Don't open browser automatically
  -h, --help                 Show this help
```

## Installation

### Prerequisites

- **Node.js** 18+
- **A running dev server** (Astro, Next.js, Vite, etc.)
- **One of the supported AI agents** (see below)

### Agent Setup

#### Claude Code (bundled)

Claude Code is included as a dependency. Just authenticate:

- **Bedrock** (recommended for AWS users): `claude login --bedrock`
- **SSO**: `claude login --sso`
- **API key**: `claude login`

#### Codex CLI

Install globally and set your API key:

```bash
npm install -g @openai/codex
export OPENAI_API_KEY=<your-key>
```

### Install via npm

```bash
npm install -g layrr
```

Or run directly with npx:

```bash
npx layrr --port 3000
```

## Development

### Tech Stack

- **Runtime**: Node.js + TypeScript
- **Proxy Server**: Custom HTTP proxy with WebSocket support
- **Overlay**: Vanilla TypeScript injected into the browser
- **AI Agents**: Claude Code (`@anthropic-ai/claude-code`), Codex CLI (`@openai/codex`)
- **Build Tool**: esbuild (via tsx)
- **Package Manager**: pnpm

### Project Structure

```
layrr/
├── src/                   # Core source code
│   ├── cli.ts             # CLI entry point
│   ├── config.ts          # Agent config (~/.layrr/config.json)
│   ├── agents/            # Pluggable AI agent system
│   │   ├── base.ts        # Agent interface & shared helpers
│   │   ├── claude.ts      # Claude Code agent
│   │   ├── codex.ts       # Codex CLI agent
│   │   ├── prompt.ts      # Shared prompt builder
│   │   └── index.ts       # Agent registry & factory
│   ├── server/            # Proxy server & WebSocket handler
│   │   ├── proxy.ts       # HTTP proxy for dev server
│   │   ├── ws-handler.ts  # WebSocket communication
│   │   └── edit-queue.ts  # Edit processing & undo
│   └── editor/            # Source file resolution
│       └── source-mapper.ts
├── overlay/               # Injected browser overlay
│   └── overlay.ts         # Overlay UI & interaction logic
├── scripts/               # Build scripts
└── dist/                  # Compiled output
```

### Development Commands

```bash
# Clone and install
git clone <repo>
cd layrr
pnpm install

# Build
pnpm build

# Run from source
node dist/cli.js --port 3000
```

## License

MIT
