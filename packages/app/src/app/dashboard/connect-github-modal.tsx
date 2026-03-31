"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function ConnectGithubModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const opened = useRef(false);

  // Open popup immediately on mount
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    const w = 500;
    const h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      "/api/auth/github?mode=popup",
      "github-connect",
      `width=${w},height=${h},left=${left},top=${top}`
    );

    const check = setInterval(() => {
      if (popup?.closed) {
        clearInterval(check);
        onClose();
      }
    }, 500);

    return () => clearInterval(check);
  }, [onClose]);

  // Listen for success message from popup
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === "github-connected") {
        router.refresh();
        onClose();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        className="relative w-full max-w-xs mx-4 rounded-xl bg-popover ring-1 ring-foreground/10 shadow-2xl overflow-hidden"
      >
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <GithubIcon className="h-8 w-8" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Connecting to GitHub...
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Complete authorization in the popup window.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
