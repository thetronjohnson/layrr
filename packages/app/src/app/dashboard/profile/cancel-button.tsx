"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CancelButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        Cancel subscription
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 pt-2 border-t border-border">
      <p className="text-xs text-muted-foreground flex-1">Are you sure? You'll lose access at the end of the billing period.</p>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Keep
      </button>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-destructive hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        Confirm
      </button>
    </div>
  );
}
