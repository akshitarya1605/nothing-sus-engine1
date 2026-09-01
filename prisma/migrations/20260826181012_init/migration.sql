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
CREATE TYPE "ParticipantStatus" AS ENUM ('ALIVE', 'ELIMINATED', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('ENGINEER', 'IMPOSTER');

-- CreateEnum
CREATE TYPE "TaskDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ParticipantTaskStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');

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
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'ADMIN', 'PROJECTOR', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'SYSTEM', 'PARTICIPANT');

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
    "adminSecret" TEXT NOT NULL,
    "spectatorSecret" TEXT NOT NULL,
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
    "otpRateLimitMax" INTEGER NOT NULL DEFAULT 10,
    "otpRateLimitWindowSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "winner" "GameWinner" NOT NULL,
    "reason" TEXT NOT NULL,
    "topScorerParticipantId" TEXT,
    "runnerUpParticipantId" TEXT,
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
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
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
    "participantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "LocationEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "role" "ParticipantRole",
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ALIVE',
    "currentRoundNumber" INTEGER,
    "currentLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantSession" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "ParticipantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpectatorSession" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SpectatorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locationId" TEXT,
    "difficulty" "TaskDifficulty" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'LOCKED',
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "otpHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantTask" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "ParticipantTaskStatus" NOT NULL DEFAULT 'LOCKED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "verificationData" JSONB,

    CONSTRAINT "ParticipantTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttempt" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "wasCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttempt_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "targetParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Elimination" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "meetingId" TEXT,
    "participantId" TEXT NOT NULL,
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
    "participantId" TEXT NOT NULL,
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
    "targetParticipantId" TEXT,
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
CREATE UNIQUE INDEX "Game_adminSecret_key" ON "Game"("adminSecret");

-- CreateIndex
CREATE UNIQUE INDEX "Game_spectatorSecret_key" ON "Game"("spectatorSecret");

-- CreateIndex
CREATE UNIQUE INDEX "GameConfig_gameId_key" ON "GameConfig"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_gameId_key" ON "GameResult"("gameId");

-- CreateIndex
CREATE INDEX "Round_gameId_status_idx" ON "Round"("gameId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");

-- CreateIndex
CREATE INDEX "Group_gameId_idx" ON "Group"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_gameId_name_key" ON "Group"("gameId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_qrToken_key" ON "Location"("qrToken");

-- CreateIndex
CREATE INDEX "Location_gameId_idx" ON "Location"("gameId");

-- CreateIndex
CREATE INDEX "LocationEvent_gameId_createdAt_idx" ON "LocationEvent"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "LocationEvent_participantId_idx" ON "LocationEvent"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_code_key" ON "Participant"("code");

-- CreateIndex
CREATE INDEX "Participant_gameId_status_idx" ON "Participant"("gameId", "status");

-- CreateIndex
CREATE INDEX "Participant_gameId_role_idx" ON "Participant"("gameId", "role");

-- CreateIndex
CREATE INDEX "Participant_groupId_idx" ON "Participant"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantSession_sessionTokenHash_key" ON "ParticipantSession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "ParticipantSession_participantId_revokedAt_idx" ON "ParticipantSession"("participantId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_gameId_revokedAt_idx" ON "AdminSession"("gameId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpectatorSession_tokenHash_key" ON "SpectatorSession"("tokenHash");

-- CreateIndex
CREATE INDEX "SpectatorSession_gameId_revokedAt_idx" ON "SpectatorSession"("gameId", "revokedAt");

-- CreateIndex
CREATE INDEX "Task_gameId_roundId_status_idx" ON "Task"("gameId", "roundId", "status");

-- CreateIndex
CREATE INDEX "Task_groupId_idx" ON "Task"("groupId");

-- CreateIndex
CREATE INDEX "ParticipantTask_taskId_status_idx" ON "ParticipantTask"("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantTask_participantId_taskId_key" ON "ParticipantTask"("participantId", "taskId");

-- CreateIndex
CREATE INDEX "TaskAttempt_participantId_taskId_createdAt_idx" ON "TaskAttempt"("participantId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_gameId_roundId_idx" ON "Meeting"("gameId", "roundId");

-- CreateIndex
CREATE INDEX "Meeting_gameId_status_idx" ON "Meeting"("gameId", "status");

-- CreateIndex
CREATE INDEX "ChatMessage_meetingId_createdAt_idx" ON "ChatMessage"("meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "Vote_meetingId_idx" ON "Vote"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_meetingId_voterId_key" ON "Vote"("meetingId", "voterId");

-- CreateIndex
CREATE INDEX "Elimination_gameId_idx" ON "Elimination"("gameId");

-- CreateIndex
CREATE INDEX "Elimination_participantId_idx" ON "Elimination"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_gameId_key_key" ON "Ability"("gameId", "key");

-- CreateIndex
CREATE INDEX "AbilityUse_abilityId_participantId_idx" ON "AbilityUse"("abilityId", "participantId");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_sequenceNumber_idx" ON "GameEvent"("gameId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_visibility_createdAt_idx" ON "GameEvent"("gameId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_targetParticipantId_idx" ON "GameEvent"("gameId", "targetParticipantId");

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
ALTER TABLE "Group" ADD CONSTRAINT "Group_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationEvent" ADD CONSTRAINT "LocationEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantSession" ADD CONSTRAINT "ParticipantSession_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpectatorSession" ADD CONSTRAINT "SpectatorSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantTask" ADD CONSTRAINT "ParticipantTask_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantTask" ADD CONSTRAINT "ParticipantTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttempt" ADD CONSTRAINT "TaskAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttempt" ADD CONSTRAINT "TaskAttempt_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_targetParticipantId_fkey" FOREIGN KEY ("targetParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elimination" ADD CONSTRAINT "Elimination_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elimination" ADD CONSTRAINT "Elimination_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elimination" ADD CONSTRAINT "Elimination_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityUse" ADD CONSTRAINT "AbilityUse_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityUse" ADD CONSTRAINT "AbilityUse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
