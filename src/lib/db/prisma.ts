import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — there is no more
// implicit "read DATABASE_URL from schema.prisma" behavior. This is the
// one place in the app that reads the raw connection string.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
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
