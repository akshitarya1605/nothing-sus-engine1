import { defineConfig } from "vitest/config";
import path from "node:path";

// Loaded here (config evaluation happens before any test file is
// imported) so modules that eagerly construct the Prisma client at
// import time — e.g. lib/db/prisma.ts's default-export singleton —
// don't throw on missing DATABASE_URL just from being imported.
try {
  process.loadEnvFile(path.resolve(__dirname, ".env"));
} catch {
  // no .env file (e.g. CI injects DATABASE_URL directly)
}

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
