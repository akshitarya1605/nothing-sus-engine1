import { cn } from "@/lib/cn";

type Tone = "neutral" | "cyan" | "red" | "green" | "yellow" | "purple";

const TONE: Record<Tone, string> = {
  neutral: "bg-panel-2 text-fg-dim border-line-strong",
  cyan: "bg-cyan/15 text-cyan border-cyan/50",
  red: "bg-red/15 text-red border-red/50",
  green: "bg-green/15 text-green border-green/50",
  yellow: "bg-yellow/15 text-yellow border-yellow/50",
  purple: "bg-purple/15 text-purple border-purple/50",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-wide",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Role-specific pill. Shows a neutral "?" until the role is known. */
export function RolePill({ role }: { role: "ENGINEER" | "IMPOSTER" | string | null | undefined }) {
  if (role === "ENGINEER") return <Badge tone="cyan">🛠 Engineer</Badge>;
  if (role === "IMPOSTER") return <Badge tone="red">🔪 Imposter</Badge>;
  return <Badge tone="neutral">Role pending</Badge>;
}

/** Alive / eliminated status pill. */
export function StatusPill({ status }: { status: string | null | undefined }) {
  if (status === "ELIMINATED") return <Badge tone="red">Eliminated</Badge>;
  if (status === "SPECTATOR") return <Badge tone="purple">Spectator</Badge>;
  return <Badge tone="green">Alive</Badge>;
}
