import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(process.cwd(), '..', '..', '.env') });
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createServer, request as httpRequest, type IncomingMessage } from 'http';
import { startProject, stopProject, getProject, getProjectBySlug, getProjectLogs, freshClone, pushChanges, getEditHistory, getEditCount, createFromTemplate, linkGithubRepo } from './projects.js';

const app = new Hono();
const PORT = Number(process.env.SERVER_PORT || 8787);

app.use('*', cors());

// ── Preview proxy (no auth required) ──
// Handles subdomain-based routing: {slug}.preview.layrr.dev → container
// Also handles path-based routing: /preview/{slug}/* (for local dev)
const PREVIEW_DOMAIN = process.env.LAYRR_PROXY_DOMAIN || ''; // e.g. "preview.layrr.dev"

app.use('*', async (c, next) => {
  const host = c.req.header('host') || '';

  // Subdomain routing: {slug}.preview.layrr.dev
  if (PREVIEW_DOMAIN && host.endsWith(`.${PREVIEW_DOMAIN}`)) {
    const slug = host.replace(`.${PREVIEW_DOMAIN}`, '').split(':')[0];
    const project = getProjectBySlug(slug);
    if (!project) return c.text('Project not found', 404);

    const url = new URL(c.req.url);
    const targetUrl = `http://localhost:${project.proxyPort}${url.pathname}${url.search}`;

    try {
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((value, key) => {
        if (key !== 'host') headers[key] = value;
      });

      const body = c.req.method !== 'GET' && c.req.method !== 'HEAD'
        ? await c.req.raw.text()
        : undefined;

      const resp = await fetch(targetUrl, {
        method: c.req.method,
        headers,
        body,
      });

      const respHeaders = new Headers();
      resp.headers.forEach((value, key) => {
        if (key !== 'content-encoding' && key !== 'content-length') {
          respHeaders.append(key, value);
        }
      });

      return new Response(resp.body, {
        status: resp.status,
        headers: respHeaders,
      });
    } catch (err: any) {
      return c.text(`Proxy error: ${err.message}`, 502);
    }
  }

  return next();
});

// ── Auth middleware (for API routes only) ──
app.use('*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const expected = process.env.SERVER_SECRET || 'dev-secret';
  if (token !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// Start a project
app.post('/projects/:id/start', async (c) => {
  const { id } = c.req.param();
  const { githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword, slug, userId } = await c.req.json();

  try {
    const project = await startProject(id, githubRepo, branch || 'main', githubToken, gitUsername, gitEmail, sharePassword, slug, userId);
    return c.json({
      status: project.status,
      proxyPort: project.proxyPort,
      devPort: project.devPort,
      framework: project.framework,
      accessToken: project.accessToken,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Stop a project
app.post('/projects/:id/stop', (c) => {
  const { id } = c.req.param();
  const stopped = stopProject(id);
  return c.json({ status: stopped ? 'stopped' : 'not_found' });
});

// Get project status
app.get('/projects/:id/status', (c) => {
  const { id } = c.req.param();
  const project = getProject(id);
  if (!project) {
    return c.json({ status: 'stopped', editCount: getEditCount(id) });
  }
  return c.json({
    status: project.status,
    proxyPort: project.proxyPort,
    devPort: project.devPort,
    framework: project.framework,
    editCount: (project as any).editCount || 0,
    accessToken: project.accessToken,
    slug: project.slug,
  });
});

// Create from template
app.post('/projects/:id/create-from-template', async (c) => {
  const { id } = c.req.param();
  const { name, prompt, gitUsername, gitEmail, sharePassword, slug, userId } = await c.req.json();
  try {
    const project = await createFromTemplate(id, name, prompt, gitUsername, gitEmail, sharePassword, slug, userId);
    return c.json({
      status: project.status,
      proxyPort: project.proxyPort,
      devPort: project.devPort,
      framework: project.framework,
      accessToken: project.accessToken,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Fresh clone — delete workspace
app.post('/projects/:id/fresh-clone', (c) => {
  const { id } = c.req.param();
  const done = freshClone(id);
  return c.json({ success: done });
});

// Link workspace to a GitHub repo (initial push)
app.post('/projects/:id/link-github', async (c) => {
  const { id } = c.req.param();
  const { githubRepo, githubToken } = await c.req.json();
  if (!githubRepo || !githubToken) {
    return c.json({ error: 'Missing githubRepo or githubToken' }, 400);
  }
  const result = linkGithubRepo(id, githubRepo, githubToken);
  return c.json(result);
});

// Push changes to GitHub
app.post('/projects/:id/push', async (c) => {
  const { id } = c.req.param();
  const { targetBranch, githubToken, githubRepo } = await c.req.json();
  if (!targetBranch || !githubToken) {
    return c.json({ error: 'Missing targetBranch or githubToken' }, 400);
  }
  const result = pushChanges(id, targetBranch, githubToken, githubRepo);
  return c.json(result);
});

// Get edit history from git
app.get('/projects/:id/edits', (c) => {
  const { id } = c.req.param();
  const edits = getEditHistory(id);
  return c.json({ edits });
});

// Get project logs
app.get('/projects/:id/logs', (c) => {
  const { id } = c.req.param();
  const logs = getProjectLogs(id);
  return c.json({ logs });
});

import { cleanupOrphanProcesses } from './projects.js';

// Helper: resolve preview proxy from upgrade request (subdomain or path)
function resolvePreviewUpgrade(req: IncomingMessage): { port: number; targetPath: string } | null {
  const host = req.headers.host || '';

  // Subdomain: {slug}.preview.layrr.dev
  if (PREVIEW_DOMAIN && host.includes(`.${PREVIEW_DOMAIN}`)) {
    const slug = host.replace(`.${PREVIEW_DOMAIN}`, '').split(':')[0];
    const project = getProjectBySlug(slug);
    if (!project) return null;
    return { port: project.proxyPort, targetPath: req.url || '/' };
  }

  // Path: /preview/{slug}/*
  const match = (req.url || '').match(/^\/preview\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const project = getProjectBySlug(match[1]);
  if (!project) return null;
  return { port: project.proxyPort, targetPath: match[2] || '/' };
}

// Kill orphan processes from previous runs before starting
cleanupOrphanProcesses().then(() => {
  const server = serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[layrr-server] Running on http://localhost:${PORT}`);
  });

  // Handle WebSocket upgrades for preview proxy (subdomain or path)
  (server as any).on('upgrade', (req: IncomingMessage, socket: any, head: Buffer) => {
    const resolved = resolvePreviewUpgrade(req);
    if (!resolved) {
      socket.destroy();
      return;
    }

    const proxyReq = httpRequest({
      hostname: 'localhost',
      port: resolved.port,
      path: resolved.targetPath || '/',
      method: 'GET',
      headers: { ...req.headers, host: `localhost:${resolved.port}` },
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      socket.write(
        `HTTP/1.1 ${proxyRes.statusCode || 101} ${proxyRes.statusMessage || 'Switching Protocols'}\r\n` +
        Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
        '\r\n\r\n'
      );
      if (proxyHead.length) socket.write(proxyHead);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxyReq.on('error', () => socket.destroy());
    socket.on('error', () => proxyReq.destroy());

    proxyReq.end();
  });
});
