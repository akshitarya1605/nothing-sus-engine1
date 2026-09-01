import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — there is no more
// implicit "read DATABASE_URL from schema.prisma" behavior. This is the
// one place in the app that reads the raw connection string.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot-reloads in dev so we don't exhaust
// Postgres connections; a fresh client per Vercel serverless invocation
// in production is expected and fine (each holds a small pg.Pool).
export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/**
 * The same singleton, re-exported under a name that says "this call
 * deliberately bypasses the RLS backstop." The Prisma connection role is a
 * superuser, so every query on `prisma` already ignores the row policies
 * added in Milestone 1 — `prismaInternal` is the marker for the call sites
 * where that is the *intent* (OTP verification against `Task.otpHash`, role
 * assignment across the whole roster, the realtime event publisher) rather
 * than an oversight. Audience-scoped reads must instead go through
 * `withAudienceContext` (src/lib/db/rlsContext.ts).
 *
 * When the first mutation path is moved under an audience-scoped
 * transaction (Milestone 2), the matching `withInternalAccess(fn)` helper
 * lands here alongside it; until then there is nothing for it to wrap.
 */
export const prismaInternal = prisma;
