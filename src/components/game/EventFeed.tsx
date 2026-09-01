"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { eventText } from "./eventText";

export interface FeedEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

/** Shared announcement ticker. `variant="ticker"` is the sparse
 * projector treatment; `"list"` is the denser console one. */
export function EventFeed({
  events,
  variant = "list",
  limit = 8,
  className,
}: {
  events: FeedEvent[];
  variant?: "list" | "ticker";
  limit?: number;
  className?: string;
}) {
  const shown = [...events].slice(-limit).reverse();

  if (variant === "ticker") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <AnimatePresence initial={false}>
          {shown.slice(0, 4).map((e, i) => (
            <motion.p
              key={e.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: i === 0 ? 1 : 0.45, x: 0 }}
              exit={{ opacity: 0 }}
              className="font-display text-2xl"
            >
              {eventText(e.type, e.payload)}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      <AnimatePresence initial={false}>
        {shown.map((e) => (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-baseline gap-2 text-sm"
          >
            <span className="text-fg-faint tabular-nums">
              {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-fg-dim">{eventText(e.type, e.payload)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
