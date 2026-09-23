import { defineConfig } from "prisma/config";

// Prisma 7's CLI runs this file as a plain module and does not load .env
// on its own, so we do it explicitly before reading DATABASE_URL below.
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file present (e.g. in CI / Vercel where vars are injected directly)
  }
}

// Used by the CLI (migrate, studio, db push, seed). The running app never
// reads this file — it builds its own driver adapter in lib/db/prisma.ts
// using the same DATABASE_URL.
// Migrations and `prisma studio` need a NON-pooled connection. On a hosted
// Supabase project DATABASE_URL points at the transaction pooler (pgbouncer),
// which can't run DDL — so prefer DIRECT_URL for the CLI when it's set.
// Locally only DATABASE_URL exists and this is a no-op.
// `prisma generate` (which runs in the Vercel build before any env vars are
// set) loads this file — so fall back to a placeholder rather than throwing.
// Migrations/studio need a real, NON-pooled connection: on hosted Supabase
// DATABASE_URL is the pgbouncer pooler (no DDL), so prefer DIRECT_URL.
const cliUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: cliUrl },
  migrations: {
    seed: "tsx --env-file=.env prisma/seed.ts",
  },
});
