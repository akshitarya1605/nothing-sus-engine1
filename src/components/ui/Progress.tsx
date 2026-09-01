import { cn } from "@/lib/cn";

/** Linear task-progress bar with the chunky ink border. */
export function ProgressBar({
  value,
  tone = "cyan",
  className,
  showLabel,
}: {
  /** 0–100 */
  value: number;
  tone?: "cyan" | "green" | "yellow" | "red";
  className?: string;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = { cyan: "bg-cyan", green: "bg-green", yellow: "bg-yellow", red: "bg-red" }[tone];
  return (
    <div className={cn("w-full", className)}>
      <div className="h-4 w-full overflow-hidden rounded-pill border-[3px] border-ink bg-elevated">
        <div
          className={cn("h-full rounded-pill transition-[width] duration-500 ease-out", fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right font-display text-sm font-semibold text-fg-dim">
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}

/** Circular progress ring (SVG). */
export function ProgressRing({
  value,
  size = 120,
  stroke = 12,
  tone = "cyan",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "cyan" | "green" | "yellow" | "red";
  children?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { cyan: "var(--color-cyan)", green: "var(--color-green)", yellow: "var(--color-yellow)", red: "var(--color-red)" }[tone];
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-elevated)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 500ms var(--ease-out)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
