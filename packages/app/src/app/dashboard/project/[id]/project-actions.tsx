"use client";

import { useState } from "react";
import { RotateCcw, GitBranch, Loader2, AlertTriangle, Lock, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function ProjectActions({ projectId, branch, sharePassword: initialPassword }: { projectId: string; branch: string; sharePassword?: string | null }) {
  const [showPush, setShowPush] = useState(false);
  const [showFreshClone, setShowFreshClone] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [pushBranch, setPushBranch] = useState(`layrr/${branch}`);
  const [pushing, setPushing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sharePass, setSharePass] = useState(initialPassword || '');
  const [savingPass, setSavingPass] = useState(false);
  const [passSaved, setPassSaved] = useState(false);

  async function handlePush() {
    setPushing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/containers/${projectId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetBranch: pushBranch }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) setTimeout(() => { setShowPush(false); setResult(null); }, 2000);
    } catch {
      setResult({ success: false, message: "Push failed" });
    }
    setPushing(false);
  }

  async function handleFreshClone() {
    setCloning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/containers/${projectId}/fresh-clone`, { method: "POST" });
      const data = await res.json();
      setResult({ success: data.success, message: data.success ? "Workspace cleared. Start the editor to re-clone." : "Failed to clear workspace" });
      if (data.success) setTimeout(() => { setShowFreshClone(false); setResult(null); }, 2000);
    } catch {
      setResult({ success: false, message: "Failed" });
    }
    setCloning(false);
  }

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</h2>
      </div>
      <div className="p-5 space-y-3">
        {/* Push to GitHub */}
        <div>
          <button
            onClick={() => { setShowPush(!showPush); setShowFreshClone(false); setResult(null); }}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
          >
            <GithubIcon className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs font-medium">Push to GitHub</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Push your edits to a branch</p>
            </div>
          </button>

          <AnimatePresence>
            {showPush && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-2 space-y-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Target branch</label>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-secondary text-xs">
                        <GitBranch className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <input
                          value={pushBranch}
                          onChange={(e) => setPushBranch(e.target.value)}
                          className="flex-1 bg-transparent outline-none text-xs"
                          placeholder="branch-name"
                        />
                      </div>
                      <button
                        onClick={handlePush}
                        disabled={pushing || !pushBranch}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {pushing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Push
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPushBranch(branch)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded bg-secondary"
                    >
                      {branch}
                    </button>
                    <button
                      onClick={() => setPushBranch(`layrr/${branch}`)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded bg-secondary"
                    >
                      layrr/{branch}
                    </button>
                  </div>
                  <ResultMessage result={result} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fresh clone */}
        <div>
          <button
            onClick={() => { setShowFreshClone(!showFreshClone); setShowPush(false); setResult(null); }}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs font-medium">Fresh clone</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Delete workspace and re-clone from GitHub</p>
            </div>
          </button>

          <AnimatePresence>
            {showFreshClone && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-2 space-y-3">
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/10 px-3 py-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      This will delete all local changes. Make sure you've pushed any edits you want to keep.
                    </p>
                  </div>
                  <button
                    onClick={handleFreshClone}
                    disabled={cloning}
                    className="flex items-center gap-1.5 bg-destructive/10 text-destructive px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    {cloning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Delete & Re-clone
                  </button>
                  <ResultMessage result={result} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Share password */}
        <div>
          <button
            onClick={() => { setShowShare(!showShare); setShowPush(false); setShowFreshClone(false); setResult(null); setPassSaved(false); }}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
          >
            <Lock className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs font-medium">Share password</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {initialPassword ? "Password protected" : "Set a password to allow others to access the editor"}
              </p>
            </div>
          </button>

          <AnimatePresence>
            {showShare && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-2 space-y-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Password</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sharePass}
                        onChange={(e) => { setSharePass(e.target.value); setPassSaved(false); }}
                        className="flex-1 h-8 px-3 rounded-md border border-input bg-secondary text-xs outline-none focus:border-foreground/20 transition-colors"
                        placeholder="Leave empty to disable sharing"
                      />
                      <button
                        onClick={async () => {
                          setSavingPass(true);
                          setPassSaved(false);
                          try {
                            await fetch(`/api/projects/${projectId}/share`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password: sharePass }),
                            });
                            setPassSaved(true);
                          } catch {}
                          setSavingPass(false);
                        }}
                        disabled={savingPass}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {savingPass ? <Loader2 className="h-3 w-3 animate-spin" /> : passSaved ? <Check className="h-3 w-3" /> : null}
                        {passSaved ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {sharePass ? "Anyone with this password can access the editor. Restart the editor to apply changes." : "No password set — only you can access the editor."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ResultMessage({ result }: { result: { success: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-[10px] ${result.success ? "text-success" : "text-destructive"}`}
    >
      {result.message}
    </motion.p>
  );
}
