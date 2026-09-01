import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — there is no more
// implicit "read DATABASE_URL from schema.prisma" behavior. This is the
// one place in the app that reads the raw connection string.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  // The Vercel Supabase integration provides POSTGRES_PRISMA_URL (pooled);
  // local dev sets DATABASE_URL.
  const raw =
    process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!raw) {
    throw new Error("No database connection string (DATABASE_URL / POSTGRES_PRISMA_URL)");
  }
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(raw);
  // Supabase's pooler presents a cert chain Node won't verify by default.
  // Still TLS-encrypted; `no-verify` skips only chain validation.
  const connectionString = isLocal ? raw : raw.replace(/sslmode=(require|verify-full|verify-ca)/, "sslmode=no-verify");
  const adapter = new PrismaPg({
    connectionString,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  return new PrismaClient({
    adapter,
    // interactive transactions fan out several queries; the 5s default is
    // tight over a cross-region link (seeding, an admin far from the DB).
    transactionOptions: { timeout: 30_000, maxWait: 10_000 },
  });
}

/**
 * Lazily constructed on first property access — so importing this module
 * during `next build` (or in a route that never actually runs a query)
 * doesn't require DATABASE_URL. Reuses one client across dev hot-reloads.
 */
function getClient(): PrismaClient {
  if (globalThis.__prisma) return globalThis.__prisma;
  const client = createClient();
  if (process.env.NODE_ENV !== "production") globalThis.__prisma = client;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * The same client, re-exported under a name that says "this call
 * deliberately bypasses the RLS backstop." The Prisma connection role is a
 * superuser, so every query on `prisma` already ignores the row policies
 * added in Milestone 1 — `prismaInternal` is the marker for the call sites
 * where that is the *intent* (OTP verification against `Task.otpHash`, role
 * assignment across the whole roster, the realtime event publisher) rather
 * than an oversight. Audience-scoped reads must instead go through
 * `withAudienceContext` (src/lib/db/rlsContext.ts).
 */
export const prismaInternal = prisma;
