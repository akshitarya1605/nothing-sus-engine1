"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/** Per-digit code entry — auto-advances, backspaces across boxes, accepts
 * a pasted code. Numeric keypad on mobile. */
export function OtpInput({
  length = 4,
  value,
  onChange,
  disabled,
  tone = "cyan",
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  tone?: "cyan" | "red" | "green";
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(length).slice(0, length).split("");
  const ring = { cyan: "focus:border-cyan", red: "focus:border-red", green: "focus:border-green" }[tone];

  const set = (i: number, c: string) => {
    const next = value.split("");
    next[i] = c;
    onChange(next.join("").slice(0, length).trimEnd());
  };

  return (
    <div className="flex gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={chars[i]?.trim() ?? ""}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, "").slice(-1);
            if (!digit) return set(i, " ");
            set(i, digit);
            if (i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !chars[i]?.trim() && i > 0) {
              refs.current[i - 1]?.focus();
              set(i - 1, " ");
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            onChange(digits);
            refs.current[Math.min(digits.length, length - 1)]?.focus();
          }}
          className={cn(
            "h-16 w-14 rounded-chunky border-[3px] border-ink bg-elevated text-center font-display text-3xl font-bold text-fg outline-none transition-colors",
            ring,
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
