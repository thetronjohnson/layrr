"use client";

import { Hand } from "lucide-react";
import { motion } from "framer-motion";

export function Welcome({ name }: { name: string }) {
  return (
    <h1 className="text-xl font-bold mb-2">
      Welcome, {name}{" "}
      <motion.span
        className="inline-block origin-[70%_80%]"
        animate={{ rotate: [0, 20, -10, 15, -5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
      >
        <Hand className="inline w-5 h-5" />
      </motion.span>
    </h1>
  );
}
