<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="layrr-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="layrr-light.svg">
    <img src="layrr-dark.svg" alt="layrr" width="120">
  </picture>

  <h1>layrr</h1>

  <p>
    <strong>Point at anything. Describe the change. Done.</strong>
  </p>
  <p>
    Layrr is a visual AI code editor. Import a GitHub repo or start from a template, click any element in the running app, describe what you want in plain English, and AI edits the source code — live. Push changes back to GitHub when you're done.
  </p>

  <p>
    <a href="https://layrr.dev">Website</a> &middot;
    <a href="#get-started">Get Started</a> &middot;
    <a href="#how-it-works">How It Works</a> &middot;
    <a href="#cli">CLI</a>
  </p>

  <p>
    <a href="https://www.npmjs.com/package/layrr"><img src="https://img.shields.io/npm/v/layrr?style=flat-square&color=18181b" alt="npm"></a>
    <a href="https://github.com/thetronjohnson/layrr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-18181b?style=flat-square" alt="License"></a>
  </p>
</div>

---

## Why Layrr

AI coding tools are powerful, but you still have to describe *where* to make the change — which file, which component, which line. Layrr skips all of that. You point at the thing on screen, say what you want, and the code changes.

**No context-switching.** You stay in the browser, looking at the actual app. No jumping between editor tabs, no grepping for the right file, no copy-pasting selectors into a prompt.

**Every edit is a git commit.** Each AI change is auto-committed with a `[layrr]` prefix. Preview how the app looked at any past edit, or revert to a previous version in one click. You always have a clean undo path.

**Works with any framework.** React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Solid, Astro, Vite — Layrr maps clicked elements back to source files across all of them.

## Get Started

Go to [layrr.dev](https://layrr.dev) and sign up. You can:

- **Import a GitHub repo** — Layrr clones it, spins up a dev server, and opens the visual editor. When you're done, push your changes back to GitHub.
- **Start from a template** — Describe what you want to build in plain English. Layrr generates a working Next.js app and drops you into the editor to keep iterating visually.

## How It Works

```
You click an element          Layrr figures out             AI edits the
in the browser          →     the source file + line    →   actual code
                                                            ↓
You see it instantly    ←     Dev server hot reloads    ←   Saved & committed
```

Click any element on the page to select it. Type what you want to change. The AI reads the source file, makes targeted edits, and your dev server hot-reloads the result instantly.

**Multi-select** — Shift+click to select multiple elements and apply one instruction to all of them.

**History** — Open the history panel to preview how the app looked at any past edit, or permanently revert to a previous version.

**Publish** — Push your changes to a GitHub branch when you're ready. Share a live preview link with anyone, protected by a password you set.

## CLI

Layrr also ships as an open-source CLI you can run against any local dev server.

```bash
npx layrr --port 3000
```

See the [CLI docs](packages/cli/README.md) for setup and options.

## License

MIT — Built by [Kiran Johns](https://kiranjohns.com)
