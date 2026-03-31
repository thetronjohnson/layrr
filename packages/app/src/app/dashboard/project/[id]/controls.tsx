"use client";

import { useState, useEffect } from "react";
import { Play, Square, ExternalLink, Loader2, Check } from "lucide-react";

type Stage = 'setup' | 'installing' | 'dev-server' | 'generating' | 'fixing' | 'ready' | null;

const STAGES: { key: Stage; label: string }[] = [
  { key: 'setup', label: 'Setting up project' },
  { key: 'installing', label: 'Installing dependencies' },
  { key: 'dev-server', label: 'Starting dev server' },
  { key: 'generating', label: 'AI is building your website' },
  { key: 'fixing', label: 'Checking for errors' },
  { key: 'ready', label: 'Ready' },
];

function StageProgress({ currentStage }: { currentStage: Stage }) {
  const currentIndex = STAGES.findIndex(s => s.key === currentStage);

  // For non-template projects (import), skip generating/fixing stages
  const visibleStages = currentIndex <= 2 && currentStage !== 'generating' && currentStage !== 'fixing'
    ? STAGES.filter(s => s.key !== 'generating' && s.key !== 'fixing')
    : STAGES;

  const visibleIndex = visibleStages.findIndex(s => s.key === currentStage);

  return (
    <div className="space-y-2.5">
      {visibleStages.map((stage, i) => {
        const isDone = i < visibleIndex;
        const isCurrent = i === visibleIndex;
        const isPending = i > visibleIndex;

        return (
          <div key={stage.key} className="flex items-center gap-3">
            <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
              {isDone ? (
                <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-success" />
                </div>
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-muted-foreground/20 ml-1.5" />
              )}
            </div>
            <span className={`text-xs ${isDone ? 'text-muted-foreground' : isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground/40'}`}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ContainerControls({
  projectId,
  status,
  framework,
  slug,
  initialEditCount = 0,
}: {
  projectId: string;
  status: string;
  framework: string | null;
  slug?: string | null;
  initialEditCount?: number;
}) {
  const [containerStatus, setContainerStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [proxyPort, setProxyPort] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [editCount, setEditCount] = useState(initialEditCount);
  const [stage, setStage] = useState<Stage>(null);

  const isProduction = typeof window !== 'undefined' && location.hostname !== 'localhost';
  const editorUrl = proxyPort
    ? isProduction && slug
      ? `https://${slug}.preview.layrr.dev?token=${accessToken || ''}`
      : `http://localhost:${proxyPort}?token=${accessToken || ''}`
    : null;
  const isRunning = containerStatus === "RUNNING";
  const isStarting = containerStatus === "STARTING" || containerStatus === "CREATING";

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    async function check() {
      try {
        const res = await fetch(`/api/containers/${projectId}/status`);
        const data = await res.json();
        if (!active) return;
        setContainerStatus(data.status);
        if (data.proxyPort) setProxyPort(data.proxyPort);
        if (data.accessToken) setAccessToken(data.accessToken);
        if (data.editCount !== undefined) setEditCount(data.editCount);
        if (data.stage !== undefined) setStage(data.stage);
      } catch {}
    }
    check();
    const interval = setInterval(check, isStarting ? 2000 : 5000);
    return () => { active = false; clearInterval(interval); };
  }, [projectId, mounted, isStarting]);

  async function startContainer() {
    setLoading(true);
    setContainerStatus("STARTING");
    setStage('setup');
    try {
      const res = await fetch(`/api/containers/${projectId}/start`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.proxyPort) setProxyPort(data.proxyPort);
        if (data.status === "RUNNING") {
          setContainerStatus("RUNNING");
          setStage('ready');
          setLoading(false);
        } else {
          pollStatus();
        }
      } else {
        setContainerStatus("ERROR");
        setStage(null);
        setLoading(false);
      }
    } catch {
      setContainerStatus("ERROR");
      setStage(null);
      setLoading(false);
    }
  }

  async function stopContainer() {
    setLoading(true);
    setContainerStatus("STOPPING");
    setStage(null);
    try {
      await fetch(`/api/containers/${projectId}/stop`, { method: "POST" });
      setContainerStatus("STOPPED");
      setProxyPort(null);
    } catch {
      setContainerStatus("ERROR");
    }
    setLoading(false);
  }

  async function pollStatus() {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/containers/${projectId}/status`);
        const data = await res.json();
        setContainerStatus(data.status);
        if (data.proxyPort) setProxyPort(data.proxyPort);
        if (data.accessToken) setAccessToken(data.accessToken);
        if (data.stage !== undefined) setStage(data.stage);
        if (data.status === "RUNNING" || data.status === "ERROR") {
          setLoading(false);
          return;
        }
      } catch {
        break;
      }
    }
    setLoading(false);
  }

  function StatusRow() {
    if (isRunning && editorUrl) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-success" />
            </div>
            <div>
              <p className="text-xs font-medium">Editor is running</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={editorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3 w-3" />
              Open Editor
            </a>
            <button
              onClick={stopContainer}
              disabled={loading}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          </div>
        </div>
      );
    }

    if (isStarting) {
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-yellow-400 animate-spin" />
            </div>
            <p className="text-xs font-medium">Setting up your website...</p>
          </div>
          {stage && <StageProgress currentStage={stage} />}
        </div>
      );
    }

    if (containerStatus === "ERROR") {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-destructive" />
            </div>
            <div>
              <p className="text-xs font-medium">Something went wrong</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Try starting the editor again</p>
            </div>
          </div>
          <button
            onClick={startContainer}
            disabled={loading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          </div>
          <div>
            <p className="text-xs font-medium">Editor is stopped</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Start the editor to begin making changes</p>
          </div>
        </div>
        <button
          onClick={startContainer}
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          Start Editor
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatusRow />
      {editCount > 0 && !isStarting && (
        <div className="pt-4 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-bold text-foreground text-xs">{editCount}</span>
          edit{editCount !== 1 ? 's' : ''} made
        </div>
      )}
    </div>
  );
}
