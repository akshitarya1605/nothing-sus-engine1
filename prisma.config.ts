import { defineConfig, env } from "prisma/config";

// Prisma 7's CLI runs this file as a plain module and does not load .env
// on its own, so we do it explicitly before reading DATABASE_URL below.
try {
  process.loadEnvFile();
} catch {
  // no .env file present (e.g. in CI where vars are injected directly)
}

// Used by the CLI (migrate, studio, db push, seed). The running app never
// reads this file — it builds its own driver adapter in lib/db/prisma.ts
// using the same DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx --env-file=.env prisma/seed.ts",
  },
});
