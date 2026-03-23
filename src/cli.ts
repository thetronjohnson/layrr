#!/usr/bin/env node

import { resolve } from 'path';
import { execSync } from 'child_process';
import open from 'open';
import { startProxy } from './server/proxy.js';
import { editQueue } from './server/edit-queue.js';
import { createAgent, checkAgent, getAgentDisplayName, getInstallHint, getAuthHint, isValidAgent, AGENT_LIST } from './agents/index.js';
import { resolveAgent, promptAgentSelection } from './config.js';

const args = process.argv.slice(2);

let targetPort: number | null = null;
let proxyPort = 4567;
let projectRoot = process.cwd();
let noOpen = false;
let agentOverride: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--port' || arg === '-p') && args[i + 1]) {
    targetPort = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--proxy-port' && args[i + 1]) {
    proxyPort = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--agent' && args[i + 1]) {
    agentOverride = args[i + 1];
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
    --agent <name>             AI agent to use (${AGENT_LIST.map(a => a.name).join(', ')})
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

// ---- Validate --agent flag if provided ----
if (agentOverride && !isValidAgent(agentOverride)) {
  console.error(`  Error: Unknown agent "${agentOverride}"\n`);
  console.error(`  Available agents: ${AGENT_LIST.map(a => `${a.name} (${a.displayName})`).join(', ')}`);
  process.exit(1);
}

// ---- Resolve agent ----
let agentName = resolveAgent(agentOverride);

if (!agentName) {
  agentName = await promptAgentSelection();
}

const displayName = getAgentDisplayName(agentName);

// ---- Preflight: check agent ----
console.log(`\n  Checking ${displayName}...`);
const check = checkAgent(agentName);

if (!check.ok) {
  if (check.error === 'not-authenticated') {
    console.error(`\n  ${displayName} is not authenticated.\n`);
    console.error(getAuthHint(agentName));
    console.error('\n  Then try layrr again.\n');
  } else if (check.error === 'not-found') {
    console.error(`\n  ${displayName} not found.\n`);
    console.error(`  Install it: ${getInstallHint(agentName)}\n`);
  } else {
    console.error(`\n  Could not start ${displayName}: ${check.error}\n`);
  }
  process.exit(1);
}

console.log(`  ✓ ${displayName} ready`);

// ---- Start ----
console.log(`
  ✦ layrr

  Dev server:  http://localhost:${targetPort}
  Proxy:       http://localhost:${proxyPort}
  Agent:       ${displayName}
  Project:     ${projectRoot}
`);

const agent = createAgent(agentName, { projectRoot });
editQueue.projectRoot = projectRoot;

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
    if (request.elements && request.elements.length > 1) {
      console.log(`  ✎ Edit: "${request.instruction}" on ${request.elements.length} elements`);
      for (const el of request.elements) {
        if (el.sourceLocation) {
          console.log(`    → <${el.tagName}> at ${el.sourceLocation.filePath}:${el.sourceLocation.line}`);
        } else {
          console.log(`    → <${el.tagName}>`);
        }
      }
    } else {
      console.log(`  ✎ Edit: "${request.instruction}" on <${request.tagName}>`);
      if (src) {
        console.log(`    → ${src.filePath}:${src.line}`);
      }
    }

    const result = await agent.applyEdit(request);

    if (result.success) {
      // Auto-commit so each edit can be undone individually
      try {
        execSync('git add -A', { cwd: projectRoot, stdio: 'pipe' });
        const msg = `[layrr] ${request.instruction.slice(0, 72)}`;
        execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: projectRoot, stdio: 'pipe' });
        console.log(`  ✓ Done (committed)`);
      } catch {
        console.log(`  ✓ Done (no commit)`);
      }
    } else {
      console.log(`  ✗ Failed: ${result.message}`);
    }

    editQueue.notifyComplete(result.success, result.message);
    console.log('');
  }
}

editLoop();

process.on('SIGINT', () => { console.log('\n  Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
