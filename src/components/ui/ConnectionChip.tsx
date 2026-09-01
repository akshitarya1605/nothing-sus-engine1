import { cn } from "@/lib/cn";
import type { RealtimeStatus } from "@/lib/realtime/useGameRealtime";

const MAP: Record<RealtimeStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting", dot: "bg-yellow", text: "text-fg-faint" },
  live: { label: "Live", dot: "bg-green", text: "text-green" },
  reconnecting: { label: "Reconnecting", dot: "bg-yellow animate-pulse", text: "text-yellow" },
  offline: { label: "Offline", dot: "bg-red", text: "text-red" },
};

export function ConnectionChip({ status, className }: { status: RealtimeStatus; className?: string }) {
  const s = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide", s.text, className)}>
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
