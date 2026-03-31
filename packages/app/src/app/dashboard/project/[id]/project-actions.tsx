"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw, GitBranch, Loader2, AlertTriangle, Lock, Check, Link2, CircleCheck, CircleX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function ProjectActions({ projectId, branch, githubRepo, sharePassword: initialPassword, hasGithub = true }: { projectId: string; branch: string; githubRepo?: string | null; sharePassword?: string | null; hasGithub?: boolean }) {
  const hasRepo = !!githubRepo;

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</h2>
      </div>
      <div className="p-5 space-y-3">
        {hasGithub ? (
          hasRepo ? (
            <GitHubActions projectId={projectId} branch={branch} />
          ) : (
            <LinkGithubAction projectId={projectId} />
          )
        ) : (
          <ConnectGithubAction />
        )}
        <SharePasswordAction projectId={projectId} initialPassword={initialPassword} />
      </div>
    </div>
  );
}

function ConnectGithubAction() {
  return (
    <a
      href="/api/auth/github"
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
    >
      <GithubIcon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs font-medium">Connect GitHub</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Link your GitHub account to publish and import projects</p>
      </div>
    </a>
  );
}

function LinkGithubAction({ projectId }: { projectId: string }) {
  const [showLink, setShowLink] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const router = useRouter();

  useEffect(() => {
    const name = repoName.trim();
    if (!name || name.length < 2) {
      setAvailability("idle");
      return;
    }

    setAvailability("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/github/check-repo?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        setAvailability(data.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [repoName]);

  async function handleLink() {
    if (!repoName.trim()) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/link-github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: repoName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.refresh();
      } else {
        setError(data.error || "Failed to create repository");
      }
    } catch {
      setError("Something went wrong");
    }
    setLinking(false);
  }

  return (
    <div>
      <button
        onClick={() => { setShowLink(!showLink); setError(null); }}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
      >
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-xs font-medium">Save to GitHub</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Back up your website to GitHub</p>
        </div>
      </button>

      <AnimatePresence>
        {showLink && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-2 space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Repository name</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-secondary text-xs">
                    <input
                      value={repoName}
                      onChange={(e) => { setRepoName(e.target.value); setError(null); }}
                      className="flex-1 bg-transparent outline-none text-xs"
                      placeholder="my-website"
                      onKeyDown={(e) => e.key === "Enter" && availability === "available" && handleLink()}
                    />
                    {availability === "checking" && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin flex-shrink-0" />}
                    {availability === "available" && <CircleCheck className="h-3 w-3 text-success flex-shrink-0" />}
                    {availability === "taken" && <CircleX className="h-3 w-3 text-destructive flex-shrink-0" />}
                  </div>
                  <button
                    onClick={handleLink}
                    disabled={linking || availability !== "available"}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <GithubIcon className="h-3 w-3" />}
                    Create & Link
                  </button>
                </div>
              </div>
              {availability === "taken" && (
                <p className="text-[10px] text-destructive">This repository name is already taken</p>
              )}
              {availability === "available" && (
                <p className="text-[10px] text-success">Name is available</p>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] text-destructive"
                >
                  {error}
                </motion.p>
              )}
              <p className="text-[10px] text-muted-foreground">
                This saves your website code to your GitHub account so you can share it or host it anywhere.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GitHubActions({ projectId, branch }: { projectId: string; branch: string }) {
  const [showPush, setShowPush] = useState(false);
  const [showFreshClone, setShowFreshClone] = useState(false);
  const [pushBranch, setPushBranch] = useState(`layrr/${branch}`);
  const [pushing, setPushing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
    <>
      {/* Push to GitHub */}
      <div>
        <button
          onClick={() => { setShowPush(!showPush); setShowFreshClone(false); setResult(null); }}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
        >
          <GithubIcon className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs font-medium">Publish to GitHub</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Publish your changes to a branch</p>
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
                  <label className="text-[10px] text-muted-foreground mb-1 block">Publish to</label>
                  <div className="flex gap-1.5 mb-3">
                    <button
                      onClick={() => setPushBranch(branch)}
                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md border transition-colors ${pushBranch === branch ? 'border-foreground/20 bg-secondary text-foreground font-medium' : 'border-input text-muted-foreground hover:text-foreground'}`}
                    >
                      <GitBranch className="h-3 w-3" />
                      {branch}
                    </button>
                    <button
                      onClick={() => setPushBranch(`layrr/${branch}`)}
                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md border transition-colors ${pushBranch === `layrr/${branch}` ? 'border-foreground/20 bg-secondary text-foreground font-medium' : 'border-input text-muted-foreground hover:text-foreground'}`}
                    >
                      <GitBranch className="h-3 w-3" />
                      layrr/{branch}
                    </button>
                  </div>
                  <button
                    onClick={handlePush}
                    disabled={pushing || !pushBranch}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {pushing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Publish
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
            <p className="text-xs font-medium">Start over</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Reset to the original version from GitHub</p>
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
                    Start over from scratch. Any unpublished changes will be lost.
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
    </>
  );
}

function SharePasswordAction({ projectId, initialPassword }: { projectId: string; initialPassword?: string | null }) {
  const [showShare, setShowShare] = useState(false);
  const [sharePass, setSharePass] = useState(initialPassword || '');
  const [savingPass, setSavingPass] = useState(false);
  const [passSaved, setPassSaved] = useState(false);

  return (
    <div>
      <button
        onClick={() => { setShowShare(!showShare); setPassSaved(false); }}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
      >
        <Lock className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-xs font-medium">Share access</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {initialPassword ? "Password protected" : "Let others view and edit your website with a password"}
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
