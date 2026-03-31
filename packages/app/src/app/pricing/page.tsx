"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

const features = [
  "AI-powered website builder",
  "Visual editor",
  "Custom domains (coming soon)",
  "GitHub import & push",
  "Unlimited projects",
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-2">layrr</h1>
          <p className="text-sm text-muted-foreground">Start building with a 3-day free trial.</p>
        </div>

        <div className="rounded-xl ring-1 ring-foreground/10 p-6">
          <div className="mb-6">
            <span className="text-3xl font-bold">$29</span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>

          <ul className="space-y-3 mb-6">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm">
                <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Start free trial"
            )}
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-3">
            3-day free trial, then $29/month. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
