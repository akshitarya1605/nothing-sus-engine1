/** Human-readable one-liners for the public event feed. Unknown types
 * fall back to a title-cased version of the type string. */
export function eventText(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case "GAME_STARTED":
      return "The game has begun.";
    case "ROUND_STARTED":
      return `Round ${p.roundNumber ?? ""} — ${p.roundName ?? "started"}`;
    case "ROUND_ENDING":
      return `Round ${p.roundNumber ?? ""} ending soon`;
    case "ROUND_ENDED":
      return `Round ${p.roundNumber ?? ""} ended`;
    case "ROUND_COMPLETE":
      return `Round ${p.roundNumber ?? ""} complete`;
    case "TASK_COMPLETED":
      return `A task was completed — ${p.globalProgressPercentage ?? 0}% done`;
    case "PLAYER_ELIMINATED":
      return `${p.name ?? "A player"} was eliminated`;
    case "PLAYER_RESTORED":
      return `${p.name ?? "A player"} was brought back`;
    case "PLAYER_DISQUALIFIED":
      return `${p.name ?? "A player"} was disqualified${p.reason ? ` — ${p.reason}` : ""}`;
    case "MEETING_STARTED":
      return "🚨 Emergency meeting called";
    case "VOTING_STARTED":
      return "Voting is open";
    case "VOTING_CLOSED":
      return "Voting closed";
    case "ROLE_REVEALED":
      return `${p.role === "IMPOSTER" ? "🔪" : "🛠"} They were ${(p.role as string)?.toLowerCase?.() ?? "revealed"}`;
    case "GAME_PAUSED":
      return `Game paused${p.reason ? ` — ${p.reason}` : ""}`;
    case "GAME_RESUMED":
      return "Game resumed";
    case "GAME_FINISHED":
      return `${p.winner ?? "Someone"} win — ${p.reason ?? ""}`;
    case "ANNOUNCEMENT_CREATED":
      return String(p.message ?? "Announcement");
    default:
      return type
        .toLowerCase()
        .split("_")
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" ");
  }
}
