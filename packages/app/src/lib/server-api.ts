const SERVER_URL = process.env.LAYRR_SERVER_URL || 'http://localhost:8787';
const SERVER_SECRET = process.env.LAYRR_SERVER_SECRET || 'dev-secret';

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVER_SECRET}`,
      ...opts.headers,
    },
  });
  return res.json();
}

export async function startContainer(projectId: string, githubRepo: string, branch: string, githubToken: string, gitUsername?: string, gitEmail?: string, sharePassword?: string) {
  return api(`/projects/${projectId}/start`, {
    method: 'POST',
    body: JSON.stringify({ githubRepo, branch, githubToken, gitUsername, gitEmail, sharePassword }),
  });
}

export async function stopContainer(projectId: string) {
  return api(`/projects/${projectId}/stop`, { method: 'POST' });
}

export async function getContainerStatus(projectId: string) {
  return api(`/projects/${projectId}/status`);
}

export async function getContainerLogs(projectId: string) {
  return api(`/projects/${projectId}/logs`);
}

export async function getEditHistory(projectId: string) {
  return api(`/projects/${projectId}/edits`);
}

export async function freshCloneProject(projectId: string) {
  return api(`/projects/${projectId}/fresh-clone`, { method: 'POST' });
}

export async function createFromTemplate(projectId: string, name: string, prompt: string, gitUsername?: string, gitEmail?: string) {
  return api(`/projects/${projectId}/create-from-template`, {
    method: 'POST',
    body: JSON.stringify({ name, prompt, gitUsername, gitEmail }),
  });
}

export async function pushProject(projectId: string, targetBranch: string, githubToken: string) {
  return api(`/projects/${projectId}/push`, {
    method: 'POST',
    body: JSON.stringify({ targetBranch, githubToken }),
  });
}
