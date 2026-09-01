"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Drift-corrected countdown. `msRemaining` comes from the server on every
 * state refetch; between refetches we tick down locally against a
 * wall-clock anchor so a slow poll doesn't freeze the clock or let it
 * run past zero.
 */
export function CountdownTimer({
  msRemaining,
  className,
  onExpire,
}: {
  msRemaining: number | null;
  className?: string;
  onExpire?: () => void;
}) {
  const anchorRef = useRef<{ at: number; ms: number } | null>(null);
  const firedRef = useRef(false);
  const [display, setDisplay] = useState(msRemaining ?? 0);

  useEffect(() => {
    if (msRemaining == null) {
      anchorRef.current = null;
      return;
    }
    anchorRef.current = { at: Date.now(), ms: msRemaining };
    firedRef.current = false;
  }, [msRemaining]);

  useEffect(() => {
    if (msRemaining == null) return;
    let raf = 0;
    const tick = () => {
      const a = anchorRef.current;
      if (a) {
        const left = Math.max(0, a.ms - (Date.now() - a.at));
        setDisplay(left);
        if (left <= 0 && !firedRef.current) {
          firedRef.current = true;
          onExpire?.();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [msRemaining, onExpire]);

  if (msRemaining == null) {
    return <span className={cn("font-display tabular-nums", className)}>--:--</span>;
  }

  const total = Math.ceil(display / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const low = display <= 30_000;

  return (
    <span
      className={cn(
        "font-display font-bold tabular-nums",
        low ? "text-red" : "text-fg",
        low && "animate-pulse",
        className,
      )}
    >
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}
