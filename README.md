# layrr

Point, click, and edit any web app with AI.

layrr is a CLI that injects a visual overlay into your running dev server. Select any element, describe what you want to change in plain English, and Claude applies the edit to your source code.

## Install

```bash
npm install -g layrr
```

## Quick start

```bash
# In your web project directory
pnpm dev                    # start your dev server on port 3000

# In another terminal
layrr --port 3000           # opens browser at localhost:4567
```

Your browser opens with an overlay toolbar in the bottom-right corner. Click **Edit**, select an element, type your change, and hit Enter.

## How it works

```
Browser (overlay)          layrr proxy (localhost:4567)          Dev server (localhost:3000)
     │                              │                                    │
     │──── select element ─────────>│                                    │
     │──── "make this red" ────────>│                                    │
     │                              │──── Claude Code edits file ──────> │
     │                              │                                    │── HMR reload
     │<──── Done! ─────────────────│                                    │
```

1. layrr proxies your dev server and injects a small overlay
2. You switch to Edit mode and click any element on the page
3. You describe the change in natural language
4. Claude Code reads the source file, makes the minimal edit, and saves it
5. Your dev server hot-reloads the page

## Requirements

- Node.js 18+
- A running dev server (Astro, Next.js, Vite, etc.)
- Claude Code authenticated (`claude login`)

## CLI options

```
Usage:
  npx layrr --port <dev-server-port> [options]

Options:
  -p, --port <number>        Dev server port (required)
  --proxy-port <number>      Layrr proxy port (default: 4567)
  --no-open                  Don't open browser automatically
  -h, --help                 Show this help
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+K` / `Cmd+K` | Toggle between Browse and Edit mode |
| `Enter` | Send edit instruction |
| `Esc` | Deselect element or exit Edit mode |

## Supported frameworks

layrr works with any framework that runs a local dev server. Source file resolution has specific support for:

- React (via fiber metadata)
- Vue (via component metadata)
- Astro, Svelte, HTML (via file search heuristics)

For other frameworks, layrr uses text and class matching to find the right source file.

## Development

```bash
git clone <repo>
cd layrr
pnpm install
pnpm build
node dist/cli.js --port 3000
```

## License

MIT
