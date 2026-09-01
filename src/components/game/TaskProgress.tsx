import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/ui/Progress";

/** Global task-completion readout — the shared "are the engineers
 * winning" gauge. `size="hero"` is the projector treatment. */
export function TaskProgress({
  completed,
  inPlay,
  percentage,
  size = "normal",
  className,
}: {
  completed: number;
  inPlay: number;
  percentage: number;
  size?: "normal" | "hero";
  className?: string;
}) {
  if (size === "hero") {
    return (
      <div className={cn("w-full text-center", className)}>
        <p className="font-display text-xl uppercase tracking-[0.3em] text-fg-faint">Task Progress</p>
        <p className="my-2 font-display text-7xl font-bold text-cyan tabular-nums sm:text-8xl">
          {Math.round(percentage)}%
        </p>
        <ProgressBar value={percentage} className="mx-auto max-w-3xl [&>div]:h-6" />
        <p className="mt-2 text-fg-faint tabular-nums">
          {completed} / {inPlay} tasks
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-baseline justify-between font-display text-sm">
        <span className="uppercase tracking-wide text-fg-faint">Task progress</span>
        <span className="text-fg-dim tabular-nums">
          {completed}/{inPlay}
        </span>
      </div>
      <ProgressBar value={percentage} showLabel />
    </div>
  );
}
