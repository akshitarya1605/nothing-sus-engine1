-- Milestone 2: host controls for disqualification and declaring the winner.

ALTER TYPE "ParticipantStatus" ADD VALUE IF NOT EXISTS 'DISQUALIFIED';
ALTER TYPE "EliminationMethod" ADD VALUE IF NOT EXISTS 'DISQUALIFIED';

ALTER TABLE "GameResult" ADD COLUMN "declaredByHost" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GameResult" ADD COLUMN "championParticipantId" TEXT;
