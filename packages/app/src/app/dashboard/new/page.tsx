"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function NewWebsitePage() {
  const searchParams = useSearchParams();
  const [name, setName] = useState(searchParams.get("name") || "");
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), prompt: prompt.trim() }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      router.push(`/dashboard/project/${id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-3 w-3" />
        Projects
      </Link>

      <h1 className="text-xl font-bold mb-2">New Website</h1>
      <p className="text-sm text-muted-foreground mb-8">
        We'll set up everything for you. Just describe what you want.
      </p>

      <div className="space-y-5 max-w-md">
        <div>
          <label className="text-xs font-medium mb-2 block">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, "-"))}
            placeholder="my-website"
            autoFocus
            className="w-full h-10 px-3 rounded-lg border border-input bg-secondary text-sm placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-medium mb-2 block">What do you want to build?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A landing page for a SaaS product with hero section, features grid, pricing, and a waitlist form..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-secondary text-sm placeholder:text-muted-foreground outline-none focus:border-ring transition-colors resize-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Describe what you want and AI will generate a first version. You can edit it visually after.
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {creating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Create Website
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
