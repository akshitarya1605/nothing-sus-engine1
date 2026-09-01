-- Milestone 2, Phase 7: fixed-window rate limiting for unauthenticated
-- endpoints (participant login, secret-link exchange).
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

-- No RLS: only server-side unauthenticated code paths touch this table,
-- via the raw (superuser) client, and it holds no game data.
