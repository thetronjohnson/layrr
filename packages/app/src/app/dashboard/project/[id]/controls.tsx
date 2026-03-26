"use client";

import { useState } from "react";

export function ContainerControls({
  projectId,
  status,
  framework,
  machineId,
}: {
  projectId: string;
  status: string;
  framework: string | null;
  machineId: string | null;
}) {
  const [containerStatus, setContainerStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [currentMachineId, setCurrentMachineId] = useState(machineId);

  const flyApp = process.env.NEXT_PUBLIC_FLY_APP_NAME || "layrr-containers";
  const editorUrl = currentMachineId
    ? `https://${flyApp}.fly.dev`
    : `https://${projectId}.layrr.dev`;
  const isRunning = containerStatus === "RUNNING";
  const isStarting = containerStatus === "STARTING" || containerStatus === "CREATING";

  async function startContainer() {
    setLoading(true);
    setContainerStatus("STARTING");
    try {
      const res = await fetch(`/api/containers/${projectId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start");
      // Poll for status
      pollStatus();
    } catch {
      setContainerStatus("ERROR");
      setLoading(false);
    }
  }

  async function stopContainer() {
    setLoading(true);
    setContainerStatus("STOPPING");
    try {
      await fetch(`/api/containers/${projectId}/stop`, { method: "POST" });
      setContainerStatus("STOPPED");
    } catch {
      setContainerStatus("ERROR");
    }
    setLoading(false);
  }

  async function pollStatus() {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/containers/${projectId}/status`);
        const data = await res.json();
        setContainerStatus(data.status);
        if (data.machineId) setCurrentMachineId(data.machineId);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <StatusDot status={containerStatus} />
        <span className="text-sm text-zinc-400">
          {containerStatus === "RUNNING" && "Container is running"}
          {containerStatus === "STOPPED" && "Container is stopped"}
          {containerStatus === "STARTING" && "Starting container..."}
          {containerStatus === "CREATING" && "Creating container..."}
          {containerStatus === "STOPPING" && "Stopping container..."}
          {containerStatus === "ERROR" && "Container error"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isRunning ? (
          <>
            <a
              href={editorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white"
            >
              Open Editor
            </a>
            <button
              onClick={stopContainer}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            onClick={startContainer}
            disabled={loading || isStarting}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Start Container"}
          </button>
        )}
      </div>

      {framework && (
        <p className="text-xs text-zinc-600">
          Detected: {framework}
        </p>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "RUNNING"
      ? "bg-emerald-400"
      : status === "ERROR"
        ? "bg-red-400"
        : status === "STARTING" || status === "CREATING"
          ? "bg-yellow-400 animate-pulse"
          : "bg-zinc-600";

  return <div className={`h-2 w-2 rounded-full ${color}`} />;
}
