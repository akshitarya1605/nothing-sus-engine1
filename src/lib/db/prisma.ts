import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

let clientInstance: PrismaClient | undefined;

function createClient(): PrismaClient {
  const raw =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!raw) {
    throw new Error("No database connection string found in environment");
  }

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(raw);

  let connectionString = raw;
  if (!isLocal) {
    connectionString = connectionString
      .replace(/sslmode=(require|verify-full|verify-ca)/, "sslmode=no-verify")
      .replace(/[&?]pgbouncer=true/gi, "")
      .replace(/[&?]supa=[^&]*/gi, "");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 8_000,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  return new PrismaClient({
    adapter,
    transactionOptions: { timeout: 30_000, maxWait: 15_000 },
  });
}

function getClient(): PrismaClient {
  // Always reuse the client instance within the process (both dev and production)
  if (globalThis.__prisma) return globalThis.__prisma;
  if (clientInstance) return clientInstance;

  clientInstance = createClient();
  globalThis.__prisma = clientInstance;
  return clientInstance;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const prismaWrite = prisma;
export const prismaInternal = prisma;
