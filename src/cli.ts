#!/usr/bin/env node

import { resolve } from 'path';
import open from 'open';
import { startProxy } from './server/proxy.js';
import { editQueue } from './server/edit-queue.js';
import { ClaudeAgent, checkClaude } from './agent.js';

const args = process.argv.slice(2);

let targetPort: number | null = null;
let proxyPort = 4567;
let projectRoot = process.cwd();
let noOpen = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--port' || arg === '-p') && args[i + 1]) {
    targetPort = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--proxy-port' && args[i + 1]) {
    proxyPort = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--no-open') {
    noOpen = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
  layrr - Point, click, and edit any web app with AI

  Usage:
    npx layrr --port <dev-server-port> [options]

  Options:
    -p, --port <number>        Dev server port (required)
    --proxy-port <number>      Layrr proxy port (default: 4567)
    --no-open                  Don't open browser automatically
    -h, --help                 Show this help

  Example:
    pnpm dev                   # start your dev server on port 3000
    npx layrr --port 3000      # start layrr
`);
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    projectRoot = resolve(arg);
  }
}

if (!targetPort) {
  console.error('  Error: --port is required. Specify your dev server port.\n');
  console.error('  npx layrr --port 3000');
  process.exit(1);
}

projectRoot = resolve(projectRoot);

// ---- Preflight: check Claude Code ----
console.log('\n  Checking Claude Code...');
const check = checkClaude();

if (!check.ok) {
  if (check.error === 'not-authenticated') {
    console.error(`
  Claude Code is installed but not authenticated.

  Run this first:

    claude login

  Then try again.
`);
  } else {
    console.error(`
  Could not start Claude Code: ${check.error}

  Make sure Claude Code is working:

    claude --version

  If not installed, layrr bundles it. Try:

    claude login
`);
  }
  process.exit(1);
}

console.log('  ✓ Claude Code ready');

// ---- Start ----
console.log(`
  ✦ layrr

  Dev server:  http://localhost:${targetPort}
  Proxy:       http://localhost:${proxyPort}
  Project:     ${projectRoot}
`);

const agent = new ClaudeAgent({ projectRoot });

await startProxy(targetPort, proxyPort, projectRoot);
console.log(`  ✓ Proxy running on http://localhost:${proxyPort}`);

if (!noOpen) {
  await open(`http://localhost:${proxyPort}`);
  console.log('  ✓ Browser opened');
}

console.log('  ✓ Waiting for edits...\n');

async function editLoop() {
  while (true) {
    const request = await editQueue.waitForNext();

    const src = request.sourceLocation;
    console.log(`  ✎ Edit: "${request.instruction}" on <${request.tagName}>`);
    if (src) {
      console.log(`    → ${src.filePath}:${src.line}`);
    }

    const result = await agent.applyEdit(request);

    editQueue.notifyComplete(result.success, result.message);

    if (result.success) {
      console.log(`  ✓ Done`);
    } else {
      console.log(`  ✗ Failed: ${result.message}`);
    }
    console.log('');
  }
}

editLoop();

process.on('SIGINT', () => { console.log('\n  Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
