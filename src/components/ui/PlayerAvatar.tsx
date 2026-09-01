import { cn } from "@/lib/cn";

/** Deterministic color per player id, from the crewmate palette. */
const PALETTE = [
  "#ff4d5e", "#3fe8e0", "#ffd93f", "#4be36b", "#b46bff",
  "#ff8f3f", "#4b7bff", "#ff6bd6", "#8fdd4b", "#e0e0e0",
];

export function playerColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Chunky crewmate silhouette in the player's color. */
export function PlayerAvatar({
  id,
  name,
  size = 44,
  dead,
  className,
}: {
  id: string;
  name?: string;
  size?: number;
  dead?: boolean;
  className?: string;
}) {
  const color = dead ? "#4b4f5c" : playerColor(id);
  return (
    <span
      className={cn("inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      title={name}
      aria-label={name}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <g stroke="#08080d" strokeWidth={4} strokeLinejoin="round">
          {/* body */}
          <path
            d="M22 14c0-5 4-8 10-8s10 3 10 8v4c5 1 8 5 8 11v20c0 3-2 5-5 5h-3v-9a3 3 0 0 0-6 0v9H27v-9a3 3 0 0 0-6 0v9h-3c-3 0-5-2-5-5V29c0-6 3-10 8-11z"
            fill={color}
          />
          {/* visor */}
          <path d="M26 20c-3 0-5 2-5 5v3c0 2 2 4 5 4h9c2 0 3-1 3-3v-6c0-2-1-3-3-3z" fill="#bfefff" />
        </g>
      </svg>
    </span>
  );
}
