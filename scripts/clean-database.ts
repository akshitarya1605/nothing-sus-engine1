import { prisma } from "../src/lib/db/prisma";

async function cleanDatabase() {
  console.log("Starting clean database reset...");

  // Delete all game-related rows cleanly
  await prisma.vote.deleteMany({});
  await prisma.elimination.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.taskAttempt.deleteMany({});
  await prisma.participantTask.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.locationEvent.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.abilityUse.deleteMany({});
  await prisma.gameEvent.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.participantSession.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.round.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.adminSession.deleteMany({});
  await prisma.spectatorSession.deleteMany({});
  await prisma.gameConfig.deleteMany({});
  await prisma.gameResult.deleteMany({});
  await prisma.game.deleteMany({});

  console.log("Database reset complete: 0 games, 0 participants, 0 fake records.");
}

cleanDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error resetting database:", err);
    process.exit(1);
  });
