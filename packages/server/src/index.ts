import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(process.cwd(), '..', '..', '.env') });
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { startProject, stopProject, getProject, getProjectLogs, freshClone, pushChanges, getEditHistory, getEditCount, createFromTemplate } from './projects.js';

const app = new Hono();
const PORT = Number(process.env.SERVER_PORT || 8787);

app.use('*', cors());

// Auth middleware
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
  const { githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword } = await c.req.json();

  try {
    const project = await startProject(id, githubRepo, branch || 'main', githubToken, gitUsername, gitEmail, sharePassword);
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
  });
});

// Create from template
app.post('/projects/:id/create-from-template', async (c) => {
  const { id } = c.req.param();
  const { name, prompt, gitUsername, gitEmail, sharePassword } = await c.req.json();
  try {
    const project = await createFromTemplate(id, name, prompt, gitUsername, gitEmail, sharePassword);
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

// Push changes to GitHub
app.post('/projects/:id/push', async (c) => {
  const { id } = c.req.param();
  const { targetBranch, githubToken } = await c.req.json();
  if (!targetBranch || !githubToken) {
    return c.json({ error: 'Missing targetBranch or githubToken' }, 400);
  }
  const result = pushChanges(id, targetBranch, githubToken);
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

// Kill orphan processes from previous runs before starting
cleanupOrphanProcesses().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[layrr-server] Running on http://localhost:${PORT}`);
  });
});
