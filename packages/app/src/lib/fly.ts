const FLY_API_URL = "https://api.machines.dev/v1";
const FLY_APP_NAME = process.env.FLY_APP_NAME || "layrr-containers";
const FLY_API_TOKEN = process.env.FLY_API_TOKEN!;

interface MachineConfig {
  image: string;
  env: Record<string, string>;
  guest: { cpu_kind: string; cpus: number; memory_mb: number };
  services: Array<{
    ports: Array<{ port: number; handlers: string[] }>;
    internal_port: number;
    protocol: string;
  }>;
  auto_destroy: boolean;
  restart: { policy: string };
}

interface Machine {
  id: string;
  name: string;
  state: string;
  instance_id: string;
  private_ip: string;
}

function headers() {
  return {
    Authorization: `Bearer ${FLY_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function createMachine(opts: {
  name: string;
  githubRepo: string;
  githubToken: string;
  branch: string;
  region?: string;
}): Promise<Machine> {
  const config: MachineConfig = {
    image: `registry.fly.io/${FLY_APP_NAME}:latest`,
    env: {
      GITHUB_REPO: opts.githubRepo,
      GITHUB_TOKEN: opts.githubToken,
      GITHUB_BRANCH: opts.branch,
      LAYRR_PROXY_PORT: "4567",
    },
    guest: {
      cpu_kind: "shared",
      cpus: 1,
      memory_mb: 512,
    },
    services: [
      {
        ports: [
          { port: 443, handlers: ["tls", "http"] },
          { port: 80, handlers: ["http"] },
        ],
        internal_port: 4567,
        protocol: "tcp",
      },
    ],
    auto_destroy: false,
    restart: { policy: "on-failure" },
  };

  const res = await fetch(`${FLY_API_URL}/apps/${FLY_APP_NAME}/machines`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: `layrr-${opts.name}`,
      region: opts.region || "sin",
      config,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fly create machine failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function startMachine(machineId: string): Promise<void> {
  const res = await fetch(
    `${FLY_API_URL}/apps/${FLY_APP_NAME}/machines/${machineId}/start`,
    { method: "POST", headers: headers() }
  );
  if (!res.ok) throw new Error(`Fly start failed: ${res.status}`);
}

export async function stopMachine(machineId: string): Promise<void> {
  const res = await fetch(
    `${FLY_API_URL}/apps/${FLY_APP_NAME}/machines/${machineId}/stop`,
    { method: "POST", headers: headers() }
  );
  if (!res.ok) throw new Error(`Fly stop failed: ${res.status}`);
}

export async function destroyMachine(machineId: string): Promise<void> {
  const res = await fetch(
    `${FLY_API_URL}/apps/${FLY_APP_NAME}/machines/${machineId}?force=true`,
    { method: "DELETE", headers: headers() }
  );
  if (!res.ok) throw new Error(`Fly destroy failed: ${res.status}`);
}

export async function getMachineStatus(machineId: string): Promise<string> {
  const res = await fetch(
    `${FLY_API_URL}/apps/${FLY_APP_NAME}/machines/${machineId}`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Fly status failed: ${res.status}`);
  const machine: Machine = await res.json();
  return machine.state;
}

export async function waitForMachine(
  machineId: string,
  targetState: string = "started",
  timeoutMs: number = 120000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await getMachineStatus(machineId);
    if (state === targetState) return true;
    if (state === "failed" || state === "destroyed") return false;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// Map Fly machine states to our container status
export function flyStateToStatus(flyState: string): string {
  switch (flyState) {
    case "created":
    case "preparing":
      return "CREATING";
    case "starting":
      return "STARTING";
    case "started":
      return "RUNNING";
    case "stopping":
      return "STOPPING";
    case "stopped":
    case "destroyed":
      return "STOPPED";
    case "failed":
      return "ERROR";
    default:
      return "STOPPED";
  }
}
