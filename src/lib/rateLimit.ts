import { prismaInternal } from "./db/prisma";

/**
 * Fixed-window rate limiter backed by Postgres — works across serverless
 * instances (an in-memory counter would not). Sized for a ~30-player event,
 * not a public API: cheap, coarse, good enough to blunt code-guessing and
 * secret-link scraping.
 */
export interface RateLimitResult {
  ok: boolean;
  /** seconds until the window frees up, when !ok */
  retryAfter: number;
}

export async function rateLimit(
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - opts.windowSec * 1000);

  // prune this key's stale rows opportunistically (keeps the table small
  // without a cron)
  await prismaInternal.rateLimitHit.deleteMany({
    where: { key, createdAt: { lt: since } },
  });

  const hits = await prismaInternal.rateLimitHit.count({
    where: { key, createdAt: { gte: since } },
  });

  if (hits >= opts.limit) {
    const oldest = await prismaInternal.rateLimitHit.findFirst({
      where: { key, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const freesAt = (oldest?.createdAt.getTime() ?? Date.now()) + opts.windowSec * 1000;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((freesAt - Date.now()) / 1000)) };
  }

  await prismaInternal.rateLimitHit.create({ data: { key } });
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from the standard proxy headers (Vercel sets
 * `x-forwarded-for`). Falls back to a constant so the limiter still
 * applies globally if the header is missing. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
