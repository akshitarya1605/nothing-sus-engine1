-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SETUP', 'READY', 'LIVE', 'MEETING', 'VOTING', 'REVEAL', 'PAUSED', 'ROUND_COMPLETE', 'FINISHED');

-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('ROUND', 'MEETING', 'VOTING', 'REVEAL');

-- CreateEnum
CREATE TYPE "GameWinner" AS ENUM ('ENGINEERS', 'IMPOSTERS', 'NONE');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'MEETING', 'VOTING', 'REVEAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "LocationEventType" AS ENUM ('ENTERED', 'EXITED');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ALIVE', 'ELIMINATED', 'SPECTATOR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('ENGINEER', 'IMPOSTER');

-- CreateEnum
CREATE TYPE "TaskDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CompletionType" AS ENUM ('MANUAL_CONFIRMATION', 'QUIZ', 'CODE', 'SEQUENCE', 'UPLOAD', 'ADMIN_VERIFICATION');

-- CreateEnum
CREATE TYPE "PlayerTaskStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'VOTING', 'CLOSED', 'REVEALED');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('SCHEDULED', 'AUTOMATIC', 'ADMIN_CALLED', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "EliminationMethod" AS ENUM ('VOTE', 'ADMIN', 'ABILITY');

-- CreateEnum
CREATE TYPE "RoleRevealStatus" AS ENUM ('PENDING', 'REVEALED');

-- CreateEnum
CREATE TYPE "AbilityKey" AS ENUM ('SABOTAGE', 'ROOM_LOCK', 'TASK_DISRUPTION', 'ELIMINATION');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'ADMIN', 'PROJECTOR', 'PLAYER');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'SYSTEM', 'PLAYER');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SETUP',
    "currentRoundNumber" INTEGER NOT NULL DEFAULT 0,
    "currentPhase" "RoundPhase",
    "pausedFromStatus" "GameStatus",
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "rolesLocked" BOOLEAN NOT NULL DEFAULT false,
    "rolesLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "totalRounds" INTEGER NOT NULL DEFAULT 4,
    "meetingAfterMinutes" INTEGER NOT NULL DEFAULT 20,
    "imposterCount" INTEGER NOT NULL DEFAULT 0,
    "allowEmergencyMeeting" BOOLEAN NOT NULL DEFAULT true,
    "revealRoleAfterVote" BOOLEAN NOT NULL DEFAULT true,
    "allowImposterElimination" BOOLEAN NOT NULL DEFAULT true,
    "engineerWinCondition" TEXT NOT NULL DEFAULT 'ENGINEERS_COMPLETE_TASKS',
    "imposterWinCondition" TEXT NOT NULL DEFAULT 'IMPOSTERS_REMAIN',
    "voteTiePolicy" TEXT NOT NULL DEFAULT 'NO_ELIMINATION',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "winner" "GameWinner" NOT NULL,
    "reason" TEXT NOT NULL,
    "topScorerPlayerId" TEXT,
    "runnerUpPlayerId" TEXT,
    "stats" JSONB NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "meetingAfterMinutes" INTEGER,
    "status" "RoundStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "building" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "LocationEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "team" TEXT,
    "role" "PlayerRole",
    "status" "PlayerStatus" NOT NULL DEFAULT 'ALIVE',
    "currentRoundNumber" INTEGER,
    "currentLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locationId" TEXT,
    "difficulty" "TaskDifficulty" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'LOCKED',
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "completionType" "CompletionType" NOT NULL DEFAULT 'MANUAL_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTask" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "PlayerTaskStatus" NOT NULL DEFAULT 'LOCKED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verificationData" JSONB,

    CONSTRAINT "PlayerTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "type" "MeetingType" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "votingStartedAt" TIMESTAMP(3),
    "votingEndedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "calledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "targetPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Elimination" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "meetingId" TEXT,
    "playerId" TEXT NOT NULL,
    "method" "EliminationMethod" NOT NULL,
    "roleRevealStatus" "RoleRevealStatus" NOT NULL DEFAULT 'PENDING',
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Elimination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "key" "AbilityKey" NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "availableRound" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbilityUse" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbilityUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "sequenceNumber" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "visibility" "EventVisibility" NOT NULL,
    "targetPlayerId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameConfig_gameId_key" ON "GameConfig"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_gameId_key" ON "GameResult"("gameId");

-- CreateIndex
CREATE INDEX "Round_gameId_status_idx" ON "Round"("gameId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Location_qrToken_key" ON "Location"("qrToken");

-- CreateIndex
CREATE INDEX "Location_gameId_idx" ON "Location"("gameId");

-- CreateIndex
CREATE INDEX "LocationEvent_gameId_createdAt_idx" ON "LocationEvent"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "LocationEvent_playerId_idx" ON "LocationEvent"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");

-- CreateIndex
CREATE INDEX "Player_gameId_status_idx" ON "Player"("gameId", "status");

-- CreateIndex
CREATE INDEX "Player_gameId_role_idx" ON "Player"("gameId", "role");

-- CreateIndex
CREATE INDEX "Task_gameId_roundId_status_idx" ON "Task"("gameId", "roundId", "status");

-- CreateIndex
CREATE INDEX "PlayerTask_taskId_status_idx" ON "PlayerTask"("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTask_playerId_taskId_key" ON "PlayerTask"("playerId", "taskId");

-- CreateIndex
CREATE INDEX "Meeting_gameId_roundId_idx" ON "Meeting"("gameId", "roundId");

-- CreateIndex
CREATE INDEX "Meeting_gameId_status_idx" ON "Meeting"("gameId", "status");

-- CreateIndex
CREATE INDEX "Vote_meetingId_idx" ON "Vote"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_meetingId_voterId_key" ON "Vote"("meetingId", "voterId");

-- CreateIndex
CREATE INDEX "Elimination_gameId_idx" ON "Elimination"("gameId");

-- CreateIndex
CREATE INDEX "Elimination_playerId_idx" ON "Elimination"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_gameId_key_key" ON "Ability"("gameId", "key");

-- CreateIndex
CREATE INDEX "AbilityUse_abilityId_playerId_idx" ON "AbilityUse"("abilityId", "playerId");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_sequenceNumber_idx" ON "GameEvent"("gameId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_visibility_createdAt_idx" ON "GameEvent"("gameId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_targetPlayerId_idx" ON "GameEvent"("gameId", "targetPlayerId");

-- CreateIndex
CREATE INDEX "AuditLog_gameId_createdAt_idx" ON "AuditLog"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_gameId_action_idx" ON "AuditLog"("gameId", "action");

-- AddForeignKey
ALTER TABLE "GameConfig" ADD CONSTRAINT "GameConfig_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTask" ADD CONSTRAINT "PlayerTask_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTask" ADD CONSTRAINT "PlayerTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elimination" ADD CONSTRAINT "Elimination_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elimination" ADD CONSTRAINT "Elimination_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elimination" ADD CONSTRAINT "Elimination_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityUse" ADD CONSTRAINT "AbilityUse_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityUse" ADD CONSTRAINT "AbilityUse_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
