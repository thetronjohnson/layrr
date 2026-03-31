import { spawn, type ChildProcess, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'net';
import { randomUUID } from 'crypto';

const BWRAP_MODE = process.env.LAYRR_MODE === 'bwrap';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || join(process.env.HOME || '/tmp', '.layrr', 'workspaces');

const DEV_PORT_START = 5100;
const DEV_PORT_END = 5199;
const PROXY_PORT_START = 6100;
const PROXY_PORT_END = 6299;

export type ProjectStage = 'setup' | 'installing' | 'dev-server' | 'generating' | 'fixing' | 'ready' | null;

export interface ProjectProcess {
  id: string;
  githubRepo: string;
  branch: string;
  framework: string | null;
  devProcess: ChildProcess | null;
  proxyProcess: ChildProcess | null;
  devPort: number;
  proxyPort: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  stage: ProjectStage;
  logs: string[];
  workDir: string;
  accessToken: string;
  slug?: string;
}

const projects = new Map<string, ProjectProcess>();
const usedDevPorts = new Set<number>();
const usedProxyPorts = new Set<number>();

// ── Shared utilities ──

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '0.0.0.0');
  });
}

async function allocatePort(start: number, end: number, usedSet: Set<number>): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (usedSet.has(port)) continue;
    const inUse = await isPortInUse(port);
    if (!inUse) {
      usedSet.add(port);
      return port;
    }
  }
  throw new Error(`No available ports in range ${start}-${end}`);
}

function releasePort(port: number, usedSet: Set<number>) {
  usedSet.delete(port);
}

function addLog(project: ProjectProcess, msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  project.logs.push(line);
  if (project.logs.length > 200) project.logs.shift();
  console.log(`[${project.id}] ${msg}`);
}

function detectPackageManager(workDir: string): string {
  if (existsSync(join(workDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(workDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(workDir, 'bun.lockb')) || existsSync(join(workDir, 'bun.lock'))) return 'bun';
  return 'npm';
}

function detectFramework(workDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) return 'nextjs';
    if (deps['astro']) return 'astro';
    if (deps['nuxt']) return 'nuxt';
    if (deps['vite'] || deps['@vitejs/plugin-react']) return 'vite';
    if (deps['@sveltejs/kit']) return 'sveltekit';
    if (deps['vue']) return 'vue';
    if (deps['react']) return 'react';
  } catch {}
  return 'unknown';
}

function getDevCommand(framework: string, pm: string, port: number): { cmd: string; args: string[] } {
  switch (framework) {
    case 'nextjs':
      return { cmd: 'npx', args: ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'] };
    case 'nuxt':
      return { cmd: 'npx', args: ['nuxt', 'dev', '--port', String(port), '--host', '0.0.0.0'] };
    case 'astro':
      return { cmd: 'npx', args: ['astro', 'dev', '--port', String(port), '--host', '0.0.0.0'] };
    case 'sveltekit':
    case 'vite':
    case 'vue':
      return { cmd: 'npx', args: ['vite', '--port', String(port), '--host', '0.0.0.0'] };
    default:
      return { cmd: pm, args: ['run', 'dev'] };
  }
}

function killProcess(proc: ChildProcess | null) {
  if (!proc || proc.killed) return;
  try {
    process.kill(-proc.pid!, 'SIGTERM');
  } catch {
    try { proc.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch {}
  }, 5000);
}

// ── Safe environment for sandboxed processes ──

function safeEnv(): Record<string, string> {
  const safe: Record<string, string> = {};
  const allow = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'NODE_ENV', 'NODE_PATH', 'npm_config_cache', 'XDG_CACHE_HOME', 'TERM'];
  for (const key of allow) {
    if (process.env[key]) safe[key] = process.env[key]!;
  }
  return safe;
}

// ── Bwrap helpers ──

function bwrapArgs(workDir: string): string[] {
  const args = [
    '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/bin', '/bin',
    '--ro-bind', '/lib', '/lib',
    '--ro-bind', '/etc/resolv.conf', '/etc/resolv.conf',
    '--ro-bind', '/etc/ssl', '/etc/ssl',
    '--bind', workDir, workDir,
    '--tmpfs', '/tmp',
    '--dev', '/dev',
    '--proc', '/proc',
    '--unshare-pid',
    '--die-with-parent',
    '--chdir', workDir,
  ];
  if (existsSync('/lib64')) args.push('--ro-bind', '/lib64', '/lib64');
  if (existsSync('/etc/ca-certificates')) args.push('--ro-bind', '/etc/ca-certificates', '/etc/ca-certificates');
  const cliDir = join(process.cwd(), '..', 'cli');
  if (existsSync(cliDir)) args.push('--ro-bind', cliDir, cliDir);
  const rootNodeModules = join(process.cwd(), '..', '..', 'node_modules');
  if (existsSync(rootNodeModules)) args.push('--ro-bind', rootNodeModules, rootNodeModules);
  return args;
}

function spawnSandboxed(cmd: string, args: string[], opts: any, workDir: string): ChildProcess {
  if (BWRAP_MODE) {
    const bwrap = bwrapArgs(workDir);
    return spawn('bwrap', [...bwrap, cmd, ...args], opts);
  }
  return spawn(cmd, args, opts);
}

// ── startProject ──

export async function startProject(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;

  if (existing) {
    if (existing.proxyPort) releasePort(existing.proxyPort, usedProxyPorts);
    if (existing.devPort) releasePort(existing.devPort, usedDevPorts);
  }

  const devPort = await allocatePort(DEV_PORT_START, DEV_PORT_END, usedDevPorts);
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);

  const accessToken = randomUUID();
  const project: ProjectProcess = {
    id, githubRepo, branch,
    framework: null,
    devProcess: null, proxyProcess: null,
    devPort, proxyPort,
    status: 'starting',
    stage: 'setup',
    logs: [],
    workDir,
    accessToken,
    slug,
  };
  projects.set(id, project);

  try {
    mkdirSync(WORKSPACE_DIR, { recursive: true });

    if (existsSync(join(workDir, '.git'))) {
      addLog(project, 'Workspace exists, reusing...');
    } else if (githubRepo && githubToken) {
      addLog(project, `Cloning ${githubRepo}...`);
      execSync(`git clone --depth 1 --branch ${branch} https://x-access-token:${githubToken}@github.com/${githubRepo}.git ${workDir}`, { stdio: 'pipe' });
    } else {
      throw new Error('No workspace found and no GitHub repo to clone. Try "Fresh Clone" or create a new project.');
    }

    const email = gitEmail || 'layrr@layrr.dev';
    const name = gitUsername || 'Layrr';
    execSync(`git config user.email "${email}" && git config user.name "${name}"`, { cwd: workDir, stdio: 'pipe' });

    const pm = detectPackageManager(workDir);
    project.framework = detectFramework(workDir);
    addLog(project, `Framework: ${project.framework}, PM: ${pm}`);

    project.stage = 'installing';
    addLog(project, 'Installing dependencies...');
    execSync(`${pm} install`, { cwd: workDir, stdio: 'pipe', timeout: 120000 });
    addLog(project, 'Dependencies installed');

    project.stage = 'dev-server';
    const devCmd = getDevCommand(project.framework, pm, devPort);
    addLog(project, `Starting dev server: ${devCmd.cmd} ${devCmd.args.join(' ')}`);
    project.devProcess = spawnSandboxed(devCmd.cmd, devCmd.args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...safeEnv(), PORT: String(devPort), HOST: '0.0.0.0' },
      detached: true,
    }, workDir);
    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', () => {
      if (project.status === 'running') { project.status = 'error'; releasePort(devPort, usedDevPorts); }
    });

    addLog(project, `Waiting for dev server on port ${devPort}...`);
    await waitForPort(devPort, 120000);
    addLog(project, 'Dev server ready');

    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnv: Record<string, string> = { ...safeEnv(), LAYRR_ACCESS_TOKEN: accessToken };
    if (sharePassword) proxyEnv.LAYRR_SHARE_PASSWORD = sharePassword;
    if (process.env.OPENROUTER_API_KEY) proxyEnv.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    project.proxyProcess = spawnSandboxed('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', agent], {
      cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'], env: proxyEnv, detached: true,
    }, workDir);
    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', () => {
      if (project.status === 'running') { project.status = 'error'; releasePort(proxyPort, usedProxyPorts); }
    });

    await waitForPort(proxyPort, 30000);
    project.stage = 'ready';
    project.status = 'running';
    addLog(project, `Ready! Dev: ${devPort}, Proxy: ${proxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    project.stage = null;
    killProcess(project.devProcess);
    killProcess(project.proxyProcess);
    project.devProcess = null;
    project.proxyProcess = null;
    releasePort(devPort, usedDevPorts);
    releasePort(proxyPort, usedProxyPorts);
    throw err;
  }
}

// ── createFromTemplate ──

export async function createFromTemplate(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;
  if (existing) {
    if (existing.proxyPort) releasePort(existing.proxyPort, usedProxyPorts);
    if (existing.devPort) releasePort(existing.devPort, usedDevPorts);
  }

  const devPort = await allocatePort(DEV_PORT_START, DEV_PORT_END, usedDevPorts);
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);
  const templateDir = join(process.cwd(), 'templates', 'nextjs-shadcn');

  const accessToken = randomUUID();
  const project: ProjectProcess = {
    id, githubRepo: '', branch: 'main', framework: 'nextjs',
    devProcess: null, proxyProcess: null, devPort, proxyPort,
    status: 'starting', stage: 'setup', logs: [], workDir, accessToken, slug,
  };
  projects.set(id, project);

  try {
    mkdirSync(WORKSPACE_DIR, { recursive: true });
    execSync(`cp -r "${templateDir}" "${workDir}"`, { stdio: 'pipe' });
    execSync('git init', { cwd: workDir, stdio: 'pipe' });
    const email = gitEmail || 'layrr@layrr.dev';
    const uname = gitUsername || 'Layrr';
    execSync(`git config user.email "${email}" && git config user.name "${uname}"`, { cwd: workDir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial template"', { cwd: workDir, stdio: 'pipe' });

    project.stage = 'installing';
    addLog(project, 'Installing dependencies...');
    execSync('pnpm install', { cwd: workDir, stdio: 'pipe', timeout: 120000 });

    project.stage = 'dev-server';
    const devCmd = getDevCommand('nextjs', 'pnpm', devPort);
    project.devProcess = spawnSandboxed(devCmd.cmd, devCmd.args, {
      cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...safeEnv(), PORT: String(devPort), HOST: '0.0.0.0' }, detached: true,
    }, workDir);
    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', () => { if (project.status === 'running') { project.status = 'error'; releasePort(devPort, usedDevPorts); } });

    await waitForPort(devPort, 120000);

    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnv: Record<string, string> = { ...safeEnv(), LAYRR_ACCESS_TOKEN: accessToken };
    if (sharePassword) proxyEnv.LAYRR_SHARE_PASSWORD = sharePassword;
    if (process.env.OPENROUTER_API_KEY) proxyEnv.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    project.proxyProcess = spawnSandboxed('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', agent], {
      cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'], env: proxyEnv, detached: true,
    }, workDir);
    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', () => { if (project.status === 'running') { project.status = 'error'; releasePort(proxyPort, usedProxyPorts); } });

    await waitForPort(proxyPort, 30000);

    if (prompt) {
      project.stage = 'generating';
      addLog(project, 'Generating initial version...');
      try {
        await sendEditViaProxy(proxyPort, prompt, project.accessToken);
        addLog(project, 'Initial version generated');

        // Repair loop: check for build errors and auto-fix
        for (let attempt = 1; attempt <= 3; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          const errors = extractBuildErrors(project);
          if (!errors) break;
          project.stage = 'fixing';
          addLog(project, `Build error detected (attempt ${attempt}/3), auto-fixing...`);
          try {
            await sendFixViaProxy(proxyPort, errors, project.accessToken);
            addLog(project, `Fix attempt ${attempt} applied`);
          } catch (err: any) {
            addLog(project, `Fix attempt ${attempt} failed: ${err.message}`);
            break;
          }
        }
      } catch (err: any) {
        addLog(project, `Generation warning: ${err.message}`);
      }
    }

    project.stage = 'ready';
    project.status = 'running';
    addLog(project, `Ready! Dev: ${devPort}, Proxy: ${proxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    project.stage = null;
    killProcess(project.devProcess);
    killProcess(project.proxyProcess);
    releasePort(devPort, usedDevPorts);
    releasePort(proxyPort, usedProxyPorts);
    throw err;
  }
}

// ── stopProject ──

export function stopProject(id: string): boolean {
  const project = projects.get(id);
  if (!project) return false;

  killProcess(project.proxyProcess);
  killProcess(project.devProcess);
  project.proxyProcess = null;
  project.devProcess = null;
  releasePort(project.devPort, usedDevPorts);
  releasePort(project.proxyPort, usedProxyPorts);
  project.status = 'stopped';
  addLog(project, 'Stopped — ports released');
  return true;
}

// ── freshClone ──

export function freshClone(id: string): boolean {
  const project = projects.get(id);
  if (!project) return false;
  if (project.status === 'running') return false;
  try {
    execSync(`rm -rf "${project.workDir}"`, { stdio: 'pipe' });
    addLog(project, 'Workspace deleted');
    return true;
  } catch { return false; }
}

// ── linkGithubRepo ──

export function linkGithubRepo(id: string, githubRepo: string, githubToken: string): { success: boolean; message: string } {
  const project = projects.get(id);
  const workDir = project?.workDir || join(WORKSPACE_DIR, id);
  if (!existsSync(join(workDir, '.git'))) return { success: false, message: 'No workspace found' };
  try {
    const remoteUrl = `https://x-access-token:${githubToken}@github.com/${githubRepo}.git`;
    try { execSync('git remote get-url origin', { cwd: workDir, stdio: 'pipe' }); execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' }); }
    catch { execSync(`git remote add origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' }); }
    execSync('git push -u origin HEAD:main', { cwd: workDir, stdio: 'pipe' });
    execSync('git fetch origin', { cwd: workDir, stdio: 'pipe' });
    if (project) { project.githubRepo = githubRepo; project.branch = 'main'; }
    return { success: true, message: `Pushed to ${githubRepo}` };
  } catch (err: any) { return { success: false, message: err.message || 'Failed to push' }; }
}

// ── pushChanges ──

export function pushChanges(id: string, targetBranch: string, githubToken: string, githubRepo?: string): { success: boolean; message: string } {
  const project = projects.get(id);
  const workDir = project?.workDir || join(WORKSPACE_DIR, id);
  const repo = githubRepo || project?.githubRepo;
  if (!existsSync(join(workDir, '.git'))) return { success: false, message: 'No workspace found' };
  if (!repo) return { success: false, message: 'No GitHub repo linked' };
  try {
    const remoteUrl = `https://x-access-token:${githubToken}@github.com/${repo}.git`;
    try { execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' }); }
    catch { execSync(`git remote add origin "${remoteUrl}"`, { cwd: workDir, stdio: 'pipe' }); }
    const log = execSync(`git log --oneline --grep="\\[layrr\\]" origin/${targetBranch}..HEAD 2>/dev/null || echo ""`, { cwd: workDir, encoding: 'utf-8' }).trim();
    if (!log) return { success: false, message: 'No layrr edits to push' };
    const commitCount = log.split('\n').filter(Boolean).length;
    execSync(`git push origin HEAD:${targetBranch}`, { cwd: workDir, stdio: 'pipe' });
    if (project) addLog(project, `Pushed ${commitCount} edit(s) to ${targetBranch}`);
    return { success: true, message: `Pushed ${commitCount} edit(s) to ${targetBranch}` };
  } catch (err: any) { return { success: false, message: err.message || 'Push failed' }; }
}

// ── getProject ──

export function getProject(id: string): ProjectProcess & { editCount?: number } | undefined {
  const project = projects.get(id);
  if (!project) return undefined;
  return { ...project, editCount: getEditCount(id) };
}

export function getProjectBySlug(slug: string): ProjectProcess | undefined {
  for (const project of projects.values()) {
    if (project.slug === slug && project.status === 'running') return project;
  }
  return undefined;
}

// ── getEditCount / getEditHistory / getLogs ──

export function getEditCount(id: string): number {
  const workDir = join(WORKSPACE_DIR, id);
  try {
    if (existsSync(join(workDir, '.git'))) {
      const log = execSync('git log --oneline --grep="\\[layrr\\]" 2>/dev/null || echo ""', { cwd: workDir, encoding: 'utf-8' }).trim();
      return log ? log.split('\n').filter(Boolean).length : 0;
    }
  } catch {}
  return 0;
}

export function getProjectLogs(id: string): string[] {
  return projects.get(id)?.logs || [];
}

export function getEditHistory(id: string): Array<{ message: string; timeAgo: string; hash: string }> {
  const workDir = join(WORKSPACE_DIR, id);
  if (!existsSync(join(workDir, '.git'))) return [];
  try {
    const log = execSync('git log --grep="\\[layrr\\]" --format="%H|%s|%ar" -20 2>/dev/null || echo ""', { cwd: workDir, encoding: 'utf-8' }).trim();
    if (!log) return [];
    return log.split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split('|');
      const timeAgo = rest.pop()!;
      const message = rest.join('|').replace('[layrr] ', '');
      return { hash, message, timeAgo };
    });
  } catch { return []; }
}

// ── cleanup ──

export async function cleanupOrphanProcesses() {
  console.log('[layrr-server] Checking for orphan processes...');
  let killed = 0;
  for (let port = DEV_PORT_START; port <= PROXY_PORT_END; port++) {
    const inUse = await isPortInUse(port);
    if (inUse) {
      try {
        const pid = execSync(`lsof -ti :${port} 2>/dev/null || echo ""`, { encoding: 'utf-8' }).trim();
        if (pid) { pid.split('\n').forEach(p => { try { process.kill(Number(p), 'SIGKILL'); killed++; } catch {} }); }
      } catch {}
    }
  }
  if (killed > 0) {
    console.log(`[layrr-server] Killed ${killed} orphan process(es)`);
    await new Promise(r => setTimeout(r, 1000));
  } else {
    console.log('[layrr-server] No orphan processes found');
  }
}

// ── internal helpers ──

function extractBuildErrors(project: ProjectProcess): string | null {
  // Look at recent logs for compilation errors
  const recent = project.logs.slice(-30);
  const errorLines: string[] = [];
  for (const line of recent) {
    const content = line.replace(/^\[.*?\]\s*/, ''); // strip timestamp
    if (
      content.includes('Export') && content.includes("doesn't exist") ||
      content.includes('Module not found') ||
      content.includes('Cannot find module') ||
      content.includes('SyntaxError') ||
      content.includes('TypeError') ||
      content.includes('Unexpected token') ||
      (content.includes('⨯') && content.includes('.tsx'))
    ) {
      errorLines.push(content);
    }
  }
  if (errorLines.length === 0) return null;
  // Deduplicate and limit
  const unique = [...new Set(errorLines)].slice(0, 10);
  return unique.join('\n');
}

async function sendFixViaProxy(proxyPort: number, errors: string, accessToken?: string): Promise<void> {
  const fixPrompt = `The code you just wrote has build errors. Fix them.\n\nErrors:\n${errors}\n\nRead the files that have errors, fix the imports and code, and save. Do not rewrite the entire file — only fix the broken parts.`;
  return sendRawEditViaProxy(proxyPort, fixPrompt, accessToken);
}

async function sendEditViaProxy(proxyPort: number, prompt: string, accessToken?: string): Promise<void> {
  const enhancedPrompt = `You are building a Next.js web application with Tailwind CSS and shadcn/ui components.\n\nThe user wants: ${prompt}\n\nEdit the files in this project to build what the user described. Focus on src/app/page.tsx as the main page. Use shadcn Button component where appropriate. Use lucide-react for icons and framer-motion for animations (both already installed). Make it look professional and modern.\n\nIMPORTANT: For lucide-react icons, use these exact names (PascalCase): ArrowRight, ArrowLeft, Check, ChevronDown, ChevronRight, Code, ExternalLink, Github, Globe, Heart, Home, Layers, Linkedin, Loader2, Lock, Mail, MapPin, Menu, MessageCircle, Moon, MoveRight, Pencil, Phone, Play, Plus, Search, Send, Settings, Sparkles, Star, Sun, Terminal, Trash2, Trophy, Upload, User, Users, X, Zap. Do NOT use names ending in "Icon" (e.g. use "Github" not "GithubIcon").`;
  return sendRawEditViaProxy(proxyPort, enhancedPrompt, accessToken);
}

async function sendRawEditViaProxy(proxyPort: number, instruction: string, accessToken?: string): Promise<void> {
  const WebSocket = (await import('ws')).default;
  return new Promise((resolve, reject) => {
    const url = accessToken
      ? `ws://localhost:${proxyPort}/__layrr__/ws?token=${accessToken}`
      : `ws://localhost:${proxyPort}/__layrr__/ws`;
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Edit timed out')); }, 180000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'edit-request', selector: 'body', tagName: 'body', className: '', textContent: '', instruction, sourceInfo: { file: 'src/app/page.tsx', line: 1 } }));
    });
    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'edit-result') { clearTimeout(timeout); ws.close(); if (msg.success) resolve(); else reject(new Error(msg.message || 'Edit failed')); }
      } catch {}
    });
    ws.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(`http://localhost:${port}`).catch(() => null); if (res) return; } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Timeout waiting for port ${port}`);
}
