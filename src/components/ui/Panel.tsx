import { cn } from "@/lib/cn";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article";
  tone?: "default" | "danger" | "cyan" | "flat";
}

const TONE: Record<NonNullable<PanelProps["tone"]>, string> = {
  default: "bg-panel border-ink shadow-pop",
  danger: "bg-red-deep/25 border-red shadow-[6px_6px_0_var(--color-red-deep)]",
  cyan: "bg-cyan-deep/15 border-cyan shadow-[6px_6px_0_var(--color-cyan-deep)]",
  flat: "bg-panel border-line-strong shadow-none",
};

/** Shared surface — chunky ink border + flat poster shadow. */
export function Panel({ as: Tag = "div", tone = "default", className, ...props }: PanelProps) {
  return (
    <Tag
      className={cn("rounded-chunky border-[3px] p-4 sm:p-5", TONE[tone], className)}
      {...props}
    />
  );
}
