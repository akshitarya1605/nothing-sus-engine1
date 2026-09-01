"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * The dramatic role card — used for a participant's own role reveal and
 * for the projector's post-elimination reveal.
 */
export function RevealCard({
  role,
  name,
  subtitle,
  className,
}: {
  role: "ENGINEER" | "IMPOSTER" | string;
  name?: string;
  subtitle?: string;
  className?: string;
}) {
  const imposter = role === "IMPOSTER";
  return (
    <motion.div
      initial={{ scale: 0.7, rotate: -4, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={cn(
        "ns-panel grid place-items-center gap-3 px-8 py-10 text-center",
        imposter ? "bg-red-deep/30 border-red" : "bg-cyan-deep/20 border-cyan",
        className,
      )}
    >
      {name && <p className="font-display text-lg text-fg-dim">{name}</p>}
      <p className="text-6xl">{imposter ? "🔪" : "🛠"}</p>
      <h2
        className={cn(
          "ns-outline font-display text-5xl font-bold uppercase tracking-wide sm:text-6xl",
          imposter ? "text-red" : "text-cyan",
        )}
      >
        {imposter ? "Imposter" : "Engineer"}
      </h2>
      {subtitle && <p className="max-w-xs text-fg-dim">{subtitle}</p>}
    </motion.div>
  );
}
