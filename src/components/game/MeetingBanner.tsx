"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/** Red-alert meeting header, shared by participant + projector. */
export function MeetingBanner({
  status,
  className,
  children,
}: {
  /** e.g. "ACTIVE" | "VOTING" | "REVEALED" */
  status: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const voting = status === "VOTING";
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "ns-panel border-red bg-red-deep/30 px-5 py-4 text-center",
        className,
      )}
    >
      <p className="font-display text-2xl font-bold uppercase tracking-wide text-red sm:text-3xl">
        🚨 {voting ? "Voting Open" : "Emergency Meeting"} 🚨
      </p>
      {children && <div className="mt-2 text-fg-dim">{children}</div>}
    </motion.div>
  );
}
