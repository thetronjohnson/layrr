import { spawn, type ChildProcess, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'net';
import { randomUUID } from 'crypto';

const INCUS_MODE = process.env.LAYRR_MODE === 'incus';
const DOCKER_MODE = process.env.LAYRR_MODE === 'docker';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || join(process.env.HOME || '/tmp', '.layrr', 'workspaces');
const INCUS_IMAGE = process.env.LAYRR_INCUS_IMAGE || 'layrr-workspace';

const DEV_PORT_START = 5100;
const DEV_PORT_END = 5199;
const PROXY_PORT_START = 6100;
const PROXY_PORT_END = 6299;

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
  logs: string[];
  workDir: string;
  accessToken: string;
  slug?: string;
  userId?: string;
  internalDevPort?: number;
  internalProxyPort?: number;
}

const projects = new Map<string, ProjectProcess>();
const usedDevPorts = new Set<number>();
const usedProxyPorts = new Set<number>();

// Track internal port allocation per container
const containerInternalPorts = new Map<string, Set<number>>();

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

// ── Incus helpers ──

function incusContainerName(userId: string): string {
  return `layrr-${userId}`;
}

function incusExec(containerName: string, cmd: string, timeout = 300000): string {
  return execSync(`incus exec ${containerName} -n -- sh -c "${cmd.replace(/"/g, '\\"')}" 2>&1`, {
    encoding: 'utf-8',
    timeout,
  }).trim();
}

function incusContainerExists(containerName: string): boolean {
  try {
    execSync(`incus info ${containerName}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function incusContainerRunning(containerName: string): boolean {
  try {
    const output = execSync(`incus info ${containerName}`, { encoding: 'utf-8' });
    return output.includes('Status: RUNNING');
  } catch {
    return false;
  }
}

function ensureUserContainer(userId: string): string {
  const containerName = incusContainerName(userId);

  if (incusContainerExists(containerName)) {
    if (!incusContainerRunning(containerName)) {
      console.log(`[incus] Starting existing container ${containerName}`);
      execSync(`incus start ${containerName}`, { stdio: 'pipe' });
      // Wait for container to be ready
      execSync(`incus exec ${containerName} -n -- true`, { stdio: 'pipe', timeout: 30000 });
    }
    return containerName;
  }

  console.log(`[incus] Creating container ${containerName}`);
  execSync(`incus launch ${INCUS_IMAGE} ${containerName} --config limits.cpu=2 --config limits.memory=1GiB`, { stdio: 'pipe' });

  // Wait for container to be ready
  for (let i = 0; i < 30; i++) {
    try {
      execSync(`incus exec ${containerName} -n -- true`, { stdio: 'pipe', timeout: 5000 });
      break;
    } catch {
      execSync('sleep 1', { stdio: 'pipe' });
    }
  }

  // Setup
  incusExec(containerName, 'mkdir -p /workspace /opt/layrr');

  // Copy layrr CLI into container
  const cliDist = join(process.cwd(), '..', 'cli', 'dist');
  const cliPkg = join(process.cwd(), '..', 'cli', 'package.json');
  execSync(`incus file push -r ${cliDist} ${containerName}/opt/layrr/`, { stdio: 'pipe' });
  execSync(`incus file push ${cliPkg} ${containerName}/opt/layrr/`, { stdio: 'pipe' });
  incusExec(containerName, 'cd /opt/layrr && npm install --omit=dev 2>/dev/null', 120000);

  console.log(`[incus] Container ${containerName} ready`);
  return containerName;
}

function allocateInternalPort(containerName: string): number {
  if (!containerInternalPorts.has(containerName)) {
    containerInternalPorts.set(containerName, new Set());
  }
  const used = containerInternalPorts.get(containerName)!;
  for (let port = 4001; port <= 4050; port++) {
    if (!used.has(port)) {
      used.add(port);
      return port;
    }
  }
  throw new Error('No available internal ports');
}

function releaseInternalPort(containerName: string, port: number) {
  containerInternalPorts.get(containerName)?.delete(port);
}

function getDevCommandStr(framework: string, port: number): string {
  switch (framework) {
    case 'nextjs': return `npx next dev -p ${port} -H 0.0.0.0`;
    case 'nuxt': return `npx nuxt dev --port ${port} --host 0.0.0.0`;
    case 'astro': return `npx astro dev --port ${port} --host 0.0.0.0`;
    case 'sveltekit':
    case 'vite':
    case 'vue': return `npx vite --port ${port} --host 0.0.0.0`;
    default: return `npx next dev -p ${port} -H 0.0.0.0`;
  }
}

// ── startProject ──

export async function startProject(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string, userId?: string): Promise<ProjectProcess> {
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;

  if (existing) {
    if (existing.proxyPort) releasePort(existing.proxyPort, usedProxyPorts);
    if (existing.devPort) releasePort(existing.devPort, usedDevPorts);
  }

  if (INCUS_MODE && userId) {
    return startProjectIncus(id, githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword, slug, userId);
  }
  return startProjectLocal(id, githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword, slug);
}

async function startProjectIncus(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string, userId?: string): Promise<ProjectProcess> {
  const hostPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const accessToken = randomUUID();
  const containerName = ensureUserContainer(userId!);
  const internalProxyPort = allocateInternalPort(containerName);
  const internalDevPort = internalProxyPort + 1000; // dev=5001 for proxy=4001, etc.
  const workDir = `/workspace/${id}`;

  const project: ProjectProcess = {
    id, githubRepo, branch,
    framework: null,
    devProcess: null, proxyProcess: null,
    devPort: 0, proxyPort: hostPort,
    status: 'starting',
    logs: [],
    workDir,
    accessToken,
    slug,
    userId,
    internalDevPort,
    internalProxyPort,
  };
  projects.set(id, project);

  try {
    // Check if workspace exists, clone if not
    try {
      incusExec(containerName, `test -d ${workDir}/.git`);
      addLog(project, 'Workspace exists, reusing...');
    } catch {
      if (githubRepo && githubToken) {
        addLog(project, `Cloning ${githubRepo}...`);
        incusExec(containerName, `git clone --depth 1 --branch ${branch} https://x-access-token:${githubToken}@github.com/${githubRepo}.git ${workDir}`, 600000);
      } else {
        throw new Error('No workspace found and no GitHub repo to clone');
      }
    }

    // Git config
    const email = gitEmail || 'layrr@layrr.dev';
    const name = gitUsername || 'Layrr';
    incusExec(containerName, `cd ${workDir} && git config user.email '${email}' && git config user.name '${name}'`);

    // Detect framework
    try {
      const pkgJson = incusExec(containerName, `cat ${workDir}/package.json`);
      const pkg = JSON.parse(pkgJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) project.framework = 'nextjs';
      else if (deps['astro']) project.framework = 'astro';
      else if (deps['nuxt']) project.framework = 'nuxt';
      else if (deps['vite']) project.framework = 'vite';
      else if (deps['@sveltejs/kit']) project.framework = 'sveltekit';
      else if (deps['vue']) project.framework = 'vue';
      else if (deps['react']) project.framework = 'react';
      else project.framework = 'unknown';
    } catch {
      project.framework = 'unknown';
    }

    // Detect package manager
    let pm = 'npm';
    try {
      incusExec(containerName, `test -f ${workDir}/pnpm-lock.yaml`);
      pm = 'pnpm';
    } catch {
      try { incusExec(containerName, `test -f ${workDir}/yarn.lock`); pm = 'yarn'; } catch {}
    }

    addLog(project, `Framework: ${project.framework}, PM: ${pm}`);

    // Install dependencies
    addLog(project, 'Installing dependencies...');
    incusExec(containerName, `cd ${workDir} && CI=true ${pm} install`, 300000);
    addLog(project, 'Dependencies installed');

    // Start dev server in background
    const devCmd = getDevCommandStr(project.framework || 'unknown', internalDevPort);
    addLog(project, `Starting dev server: ${devCmd}`);
    incusExec(containerName, `cd ${workDir} && nohup sh -c '${devCmd}' > /tmp/dev-${id}.log 2>&1 & echo $! > ${workDir}/.layrr-dev.pid`);

    // Wait for dev server
    addLog(project, `Waiting for dev server on internal port ${internalDevPort}...`);
    for (let i = 0; i < 120; i++) {
      try {
        incusExec(containerName, `curl -sf http://localhost:${internalDevPort} > /dev/null`, 5000);
        break;
      } catch {
        if (i === 119) throw new Error('Dev server timed out');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    addLog(project, 'Dev server ready');

    // Start layrr proxy in background
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnvVars = `LAYRR_ACCESS_TOKEN=${accessToken}${sharePassword ? ` LAYRR_SHARE_PASSWORD=${sharePassword}` : ''}${process.env.OPENROUTER_API_KEY ? ` OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY}` : ''}`;
    addLog(project, `Starting proxy on internal port ${internalProxyPort}...`);
    incusExec(containerName, `cd ${workDir} && nohup sh -c '${proxyEnvVars} node /opt/layrr/dist/cli.js --port ${internalDevPort} --proxy-port ${internalProxyPort} --no-open --agent ${agent}' > /tmp/proxy-${id}.log 2>&1 & echo $! > ${workDir}/.layrr-proxy.pid`);

    // Add port forward first, then poll from host
    const deviceName = `proj-${id.slice(0, 8)}`;
    try { execSync(`incus config device remove ${containerName} ${deviceName}`, { stdio: 'pipe' }); } catch {}
    execSync(`incus config device add ${containerName} ${deviceName} proxy listen=tcp:0.0.0.0:${hostPort} connect=tcp:127.0.0.1:${internalProxyPort}`, { stdio: 'pipe' });

    // Wait for proxy via host port
    addLog(project, `Waiting for proxy on host port ${hostPort}...`);
    await waitForPort(hostPort, 60000);

    project.status = 'running';
    addLog(project, `Ready! Host port: ${hostPort}, Internal proxy: ${internalProxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    // Cleanup
    try {
      const deviceName = `proj-${id.slice(0, 8)}`;
      execSync(`incus config device remove ${containerName} ${deviceName}`, { stdio: 'pipe' });
    } catch {}
    releasePort(hostPort, usedProxyPorts);
    releaseInternalPort(containerName, internalProxyPort);
    throw err;
  }
}

async function startProjectLocal(id: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
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

    addLog(project, 'Installing dependencies...');
    execSync(`${pm} install`, { cwd: workDir, stdio: 'pipe', timeout: 120000 });
    addLog(project, 'Dependencies installed');

    const devCmd = getDevCommand(project.framework, pm, devPort);
    addLog(project, `Starting dev server: ${devCmd.cmd} ${devCmd.args.join(' ')}`);
    project.devProcess = spawn(devCmd.cmd, devCmd.args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(devPort), HOST: '0.0.0.0' },
      detached: true,
    });
    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', (code) => {
      if (project.status === 'running') { project.status = 'error'; releasePort(devPort, usedDevPorts); }
    });

    addLog(project, `Waiting for dev server on port ${devPort}...`);
    await waitForPort(devPort, 120000);
    addLog(project, 'Dev server ready');

    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnv: Record<string, string> = { ...process.env as Record<string, string>, LAYRR_ACCESS_TOKEN: accessToken };
    if (sharePassword) proxyEnv.LAYRR_SHARE_PASSWORD = sharePassword;

    project.proxyProcess = spawn('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', agent], {
      cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'], env: proxyEnv, detached: true,
    });
    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', (code) => {
      if (project.status === 'running') { project.status = 'error'; releasePort(proxyPort, usedProxyPorts); }
    });

    await waitForPort(proxyPort, 30000);
    project.status = 'running';
    addLog(project, `Ready! Dev: ${devPort}, Proxy: ${proxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
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

export async function createFromTemplate(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string, userId?: string): Promise<ProjectProcess> {
  const existing = projects.get(id);
  if (existing && existing.status === 'running') return existing;
  if (existing) {
    if (existing.proxyPort) releasePort(existing.proxyPort, usedProxyPorts);
    if (existing.devPort) releasePort(existing.devPort, usedDevPorts);
  }

  if (INCUS_MODE && userId) {
    return createFromTemplateIncus(id, name, prompt, gitUsername, gitEmail, sharePassword, slug, userId);
  }
  return createFromTemplateLocal(id, name, prompt, gitUsername, gitEmail, sharePassword, slug);
}

async function createFromTemplateIncus(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string, userId?: string): Promise<ProjectProcess> {
  const hostPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const accessToken = randomUUID();
  const containerName = ensureUserContainer(userId!);
  const internalProxyPort = allocateInternalPort(containerName);
  const internalDevPort = internalProxyPort + 1000;
  const workDir = `/workspace/${id}`;
  const templateDir = join(process.cwd(), 'templates', 'nextjs-shadcn');

  const project: ProjectProcess = {
    id, githubRepo: '', branch: 'main',
    framework: 'nextjs',
    devProcess: null, proxyProcess: null,
    devPort: 0, proxyPort: hostPort,
    status: 'starting',
    logs: [],
    workDir,
    accessToken,
    slug,
    userId,
    internalDevPort,
    internalProxyPort,
  };
  projects.set(id, project);

  try {
    // Copy template into container
    addLog(project, `Creating ${name} from template...`);
    incusExec(containerName, `mkdir -p ${workDir}`);
    // Push template contents (not the directory itself) into workspace
    execSync(`cd "${templateDir}" && tar cf - . | incus exec ${containerName} -n -- tar xf - -C ${workDir}`, { stdio: 'pipe' });

    // Init git
    const email = gitEmail || 'layrr@layrr.dev';
    const uname = gitUsername || 'Layrr';
    incusExec(containerName, `cd ${workDir} && git init && git config user.email '${email}' && git config user.name '${uname}' && git add -A && git commit -m 'initial template'`);

    // Install deps
    addLog(project, 'Installing dependencies...');
    incusExec(containerName, `cd ${workDir} && CI=true pnpm install`, 300000);
    addLog(project, 'Dependencies installed');

    // Start dev server
    const devCmd = getDevCommandStr('nextjs', internalDevPort);
    addLog(project, `Starting dev server: ${devCmd}`);
    incusExec(containerName, `cd ${workDir} && nohup sh -c '${devCmd}' > /tmp/dev-${id}.log 2>&1 & echo $! > ${workDir}/.layrr-dev.pid`);

    addLog(project, 'Waiting for dev server...');
    for (let i = 0; i < 120; i++) {
      try {
        incusExec(containerName, `curl -sf http://localhost:${internalDevPort} > /dev/null`, 5000);
        break;
      } catch {
        if (i === 119) throw new Error('Dev server timed out');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    addLog(project, 'Dev server ready');

    // Start proxy
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnvVars = `LAYRR_ACCESS_TOKEN=${accessToken}${sharePassword ? ` LAYRR_SHARE_PASSWORD=${sharePassword}` : ''}${process.env.OPENROUTER_API_KEY ? ` OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY}` : ''}`;
    incusExec(containerName, `cd ${workDir} && nohup sh -c '${proxyEnvVars} node /opt/layrr/dist/cli.js --port ${internalDevPort} --proxy-port ${internalProxyPort} --no-open --agent ${agent}' > /tmp/proxy-${id}.log 2>&1 & echo $! > ${workDir}/.layrr-proxy.pid`);

    // Add port forward first, then poll from host
    const deviceName = `proj-${id.slice(0, 8)}`;
    try { execSync(`incus config device remove ${containerName} ${deviceName}`, { stdio: 'pipe' }); } catch {}
    execSync(`incus config device add ${containerName} ${deviceName} proxy listen=tcp:0.0.0.0:${hostPort} connect=tcp:127.0.0.1:${internalProxyPort}`, { stdio: 'pipe' });

    addLog(project, `Waiting for proxy on host port ${hostPort}...`);
    await waitForPort(hostPort, 60000);

    // Run initial prompt
    if (prompt) {
      addLog(project, 'Generating initial version...');
      try {
        await sendEditViaProxy(hostPort, prompt);
        addLog(project, 'Initial version generated');
      } catch (err: any) {
        addLog(project, `Generation warning: ${err.message}`);
      }
    }

    project.status = 'running';
    addLog(project, `Ready! Host port: ${hostPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
    try {
      const deviceName = `proj-${id.slice(0, 8)}`;
      execSync(`incus config device remove ${containerName} ${deviceName}`, { stdio: 'pipe' });
    } catch {}
    releasePort(hostPort, usedProxyPorts);
    releaseInternalPort(containerName, internalProxyPort);
    throw err;
  }
}

async function createFromTemplateLocal(id: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string, sharePassword?: string, slug?: string): Promise<ProjectProcess> {
  const devPort = await allocatePort(DEV_PORT_START, DEV_PORT_END, usedDevPorts);
  const proxyPort = await allocatePort(PROXY_PORT_START, PROXY_PORT_END, usedProxyPorts);
  const workDir = join(WORKSPACE_DIR, id);
  const templateDir = join(process.cwd(), 'templates', 'nextjs-shadcn');

  const accessToken = randomUUID();
  const project: ProjectProcess = {
    id, githubRepo: '', branch: 'main', framework: 'nextjs',
    devProcess: null, proxyProcess: null, devPort, proxyPort,
    status: 'starting', logs: [], workDir, accessToken, slug,
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

    addLog(project, 'Installing dependencies...');
    execSync('pnpm install', { cwd: workDir, stdio: 'pipe', timeout: 120000 });

    const devCmd = getDevCommand('nextjs', 'pnpm', devPort);
    project.devProcess = spawn(devCmd.cmd, devCmd.args, {
      cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(devPort), HOST: '0.0.0.0' }, detached: true,
    });
    project.devProcess.stdout?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.stderr?.on('data', (d: Buffer) => addLog(project, d.toString().trim()));
    project.devProcess.on('exit', () => { if (project.status === 'running') { project.status = 'error'; releasePort(devPort, usedDevPorts); } });

    await waitForPort(devPort, 120000);

    const layrCli = join(process.cwd(), '..', 'cli', 'dist', 'cli.js');
    const agent = process.env.LAYRR_AGENT || 'pi-mono';
    const proxyEnv: Record<string, string> = { ...process.env as Record<string, string>, LAYRR_ACCESS_TOKEN: accessToken };
    if (sharePassword) proxyEnv.LAYRR_SHARE_PASSWORD = sharePassword;

    project.proxyProcess = spawn('node', [layrCli, '--port', String(devPort), '--proxy-port', String(proxyPort), '--no-open', '--agent', agent], {
      cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'], env: proxyEnv, detached: true,
    });
    project.proxyProcess.stdout?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.stderr?.on('data', (d: Buffer) => addLog(project, `[proxy] ${d.toString().trim()}`));
    project.proxyProcess.on('exit', () => { if (project.status === 'running') { project.status = 'error'; releasePort(proxyPort, usedProxyPorts); } });

    await waitForPort(proxyPort, 30000);

    if (prompt) {
      addLog(project, 'Generating initial version...');
      try { await sendEditViaProxy(proxyPort, prompt); addLog(project, 'Initial version generated'); }
      catch (err: any) { addLog(project, `Generation warning: ${err.message}`); }
    }

    project.status = 'running';
    addLog(project, `Ready! Dev: ${devPort}, Proxy: ${proxyPort}`);
    return project;
  } catch (err: any) {
    addLog(project, `Error: ${err.message}`);
    project.status = 'error';
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

  if (INCUS_MODE && project.userId) {
    const containerName = incusContainerName(project.userId);
    const workDir = `/workspace/${id}`;
    try {
      // Kill processes by PID
      try { incusExec(containerName, `kill $(cat ${workDir}/.layrr-proxy.pid) 2>/dev/null`); } catch {}
      try { incusExec(containerName, `kill $(cat ${workDir}/.layrr-dev.pid) 2>/dev/null`); } catch {}
      // Remove port forward
      const deviceName = `proj-${id.slice(0, 8)}`;
      try { execSync(`incus config device remove ${containerName} ${deviceName}`, { stdio: 'pipe' }); } catch {}
    } catch {}
    if (project.internalProxyPort) releaseInternalPort(containerName, project.internalProxyPort);
    releasePort(project.proxyPort, usedProxyPorts);
    project.status = 'stopped';
    addLog(project, 'Stopped');
    return true;
  }

  // Local mode
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

  if (INCUS_MODE && project?.userId) {
    const containerName = incusContainerName(project.userId);
    try {
      incusExec(containerName, `rm -rf /workspace/${id}`);
      addLog(project, 'Workspace deleted');
      return true;
    } catch { return false; }
  }

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

  if (INCUS_MODE && project?.userId) {
    const containerName = incusContainerName(project.userId);
    const workDir = `/workspace/${id}`;
    try {
      const remoteUrl = `https://x-access-token:${githubToken}@github.com/${githubRepo}.git`;
      incusExec(containerName, `cd ${workDir} && (git remote add origin '${remoteUrl}' 2>/dev/null || git remote set-url origin '${remoteUrl}')`);
      incusExec(containerName, `cd ${workDir} && git push -u origin HEAD:main`);
      incusExec(containerName, `cd ${workDir} && git fetch origin`);
      if (project) { project.githubRepo = githubRepo; project.branch = 'main'; }
      return { success: true, message: `Pushed to ${githubRepo}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to push' };
    }
  }

  // Local mode
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

  if (INCUS_MODE && project?.userId) {
    const containerName = incusContainerName(project.userId);
    const workDir = `/workspace/${id}`;
    const repo = githubRepo || project.githubRepo;
    if (!repo) return { success: false, message: 'No GitHub repo linked' };
    try {
      const remoteUrl = `https://x-access-token:${githubToken}@github.com/${repo}.git`;
      incusExec(containerName, `cd ${workDir} && (git remote set-url origin '${remoteUrl}' 2>/dev/null || git remote add origin '${remoteUrl}')`);
      const log = incusExec(containerName, `cd ${workDir} && git log --oneline --grep='\\[layrr\\]' origin/${targetBranch}..HEAD 2>/dev/null || echo ""`);
      if (!log) return { success: false, message: 'No layrr edits to push' };
      const commitCount = log.split('\n').filter(Boolean).length;
      incusExec(containerName, `cd ${workDir} && git push origin HEAD:${targetBranch}`);
      return { success: true, message: `Pushed ${commitCount} edit(s) to ${targetBranch}` };
    } catch (err: any) { return { success: false, message: err.message || 'Push failed' }; }
  }

  // Local mode
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
  const project = projects.get(id);

  if (INCUS_MODE && project?.userId) {
    try {
      const containerName = incusContainerName(project.userId);
      const log = incusExec(containerName, `cd /workspace/${id} && git log --oneline --grep='\\[layrr\\]' 2>/dev/null || echo ""`);
      return log ? log.split('\n').filter(Boolean).length : 0;
    } catch { return 0; }
  }

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
  const project = projects.get(id);

  if (INCUS_MODE && project?.userId) {
    try {
      const containerName = incusContainerName(project.userId);
      const log = incusExec(containerName, `cd /workspace/${id} && git log --grep='\\[layrr\\]' --format='%H|%s|%ar' -20 2>/dev/null || echo ""`);
      if (!log) return [];
      return log.split('\n').filter(Boolean).map(line => {
        const [hash, ...rest] = line.split('|');
        const timeAgo = rest.pop()!;
        const message = rest.join('|').replace('[layrr] ', '');
        return { hash, message, timeAgo };
      });
    } catch { return []; }
  }

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
  if (INCUS_MODE) {
    console.log('[layrr-server] Incus mode — containers persist, no cleanup needed');
    return;
  }

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

async function sendEditViaProxy(proxyPort: number, prompt: string): Promise<void> {
  const WebSocket = (await import('ws')).default;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${proxyPort}/__layrr__/ws`);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Edit timed out')); }, 180000);
    ws.on('open', () => {
      const enhancedPrompt = `You are building a Next.js web application with Tailwind CSS and shadcn/ui components.\n\nThe user wants: ${prompt}\n\nEdit the files in this project to build what the user described. Focus on src/app/page.tsx as the main page. Use shadcn components where appropriate. Use lucide-react for icons and framer-motion for animations (both already installed). Make it look professional and modern.`;
      ws.send(JSON.stringify({ type: 'edit-request', selector: 'body', tagName: 'body', className: '', textContent: '', instruction: enhancedPrompt, sourceInfo: { file: 'src/app/page.tsx', line: 1 } }));
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
