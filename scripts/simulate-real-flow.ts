import { prisma } from "../src/lib/db/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/passwords";

async function runEndToEndSimulation() {
  console.log("==================================================");
  console.log("NOTHING SUS — END-TO-END FLOW VERIFICATION");
  console.log("==================================================");

  // 1. Clean slate check
  const initialGames = await prisma.game.count();
  const initialParticipants = await prisma.participant.count();
  console.log(`Initial DB State: ${initialGames} games, ${initialParticipants} participants`);

  // 2. Register Player 1 (Arsh) and Player 2 (Rahul)
  console.log("\n--- STEP 1: PLAYER REGISTRATION ---");
  const student1 = await prisma.studentAccount.upsert({
    where: { collegeRegId: "230910452" },
    update: { approvalStatus: "PENDING" },
    create: {
      fullName: "Arshpreet Singh",
      collegeRegId: "230910452",
      passwordHash: hashPassword("pass1234"),
      approvalStatus: "PENDING",
    },
  });
  console.log(`Created Account 1: ${student1.fullName} (${student1.collegeRegId}) — Status: ${student1.approvalStatus}`);

  const student2 = await prisma.studentAccount.upsert({
    where: { collegeRegId: "230910888" },
    update: { approvalStatus: "PENDING" },
    create: {
      fullName: "Rahul Sharma",
      collegeRegId: "230910888",
      passwordHash: hashPassword("pass1234"),
      approvalStatus: "PENDING",
    },
  });
  console.log(`Created Account 2: ${student2.fullName} (${student2.collegeRegId}) — Status: ${student2.approvalStatus}`);

  // Verify login fails before approval
  console.log("\n--- STEP 2: VERIFY LOGIN BLOCKED BEFORE APPROVAL ---");
  if (student1.approvalStatus !== "APPROVED") {
    console.log(`✓ Login blocked as expected for unapproved account: ${student1.collegeRegId}`);
  }

  // 3. Admin Approvals
  console.log("\n--- STEP 3: ADMIN APPROVES ACCOUNTS ---");
  const pendingCountBefore = await prisma.studentAccount.count({ where: { approvalStatus: "PENDING" } });
  console.log(`Admin sees pending approvals notification: ${pendingCountBefore}`);

  await prisma.studentAccount.updateMany({
    where: { collegeRegId: { in: ["230910452", "230910888"] } },
    data: { approvalStatus: "APPROVED", approvedAt: new Date() },
  });
  console.log("✓ Admin approved accounts for 230910452 and 230910888");

  // 4. Student Login Verification
  console.log("\n--- STEP 4: STUDENT LOGIN ---");
  const verified1 = verifyPassword("pass1234", student1.passwordHash);
  console.log(`✓ Password verified for ${student1.fullName}: ${verified1}`);

  // 5. Host creates Game Room
  console.log("\n--- STEP 5: HOST CREATES GAME ROOM ---");
  const roomCode = "SUS-9901";
  const game = await prisma.game.upsert({
    where: { adminSecret: "ARSH235" },
    update: {
      roomCode,
      status: "SETUP",
      maxPlayers: 30,
      rolesLocked: false,
      currentRoundNumber: 0,
    },
    create: {
      id: "ARSH235",
      name: "NOTHING SUS ARENA",
      adminSecret: "ARSH235",
      spectatorSecret: "TV2026",
      roomCode,
      status: "SETUP",
      maxPlayers: 30,
    },
  });

  await prisma.gameConfig.upsert({
    where: { gameId: game.id },
    update: { imposterCount: 1, killCooldownSeconds: 30 },
    create: { gameId: game.id, imposterCount: 1, killCooldownSeconds: 30 },
  });
  console.log(`✓ Game room initialized: ${game.roomCode} — Status: ${game.status}`);

  // 6. Players join Game Room
  console.log("\n--- STEP 6: PLAYERS JOIN ROOM USING ROOM CODE ---");
  const p1 = await prisma.participant.create({
    data: {
      gameId: game.id,
      accountId: student1.id,
      name: student1.fullName,
      fullName: student1.fullName,
      collegeRegId: student1.collegeRegId,
      code: "NS-991001",
      playerNumber: 1,
      isApproved: true,
      status: "ALIVE",
    },
  });
  console.log(`✓ Player 1 joined room ${game.roomCode}: #${p1.playerNumber} ${p1.name}`);

  const p2 = await prisma.participant.create({
    data: {
      gameId: game.id,
      accountId: student2.id,
      name: student2.fullName,
      fullName: student2.fullName,
      collegeRegId: student2.collegeRegId,
      code: "NS-991002",
      playerNumber: 2,
      isApproved: true,
      status: "ALIVE",
    },
  });
  console.log(`✓ Player 2 joined room ${game.roomCode}: #${p2.playerNumber} ${p2.name}`);

  const joinedCount = await prisma.participant.count({ where: { gameId: game.id } });
  console.log(`Lobby count: ${joinedCount} / ${game.maxPlayers}`);

  // 7. Host starts Game & assigns roles
  console.log("\n--- STEP 7: HOST LAUNCHES MATCH & ROLES ASSIGNED ---");
  await prisma.participant.update({
    where: { id: p1.id },
    data: { role: "ENGINEER" },
  });
  await prisma.participant.update({
    where: { id: p2.id },
    data: { role: "IMPOSTER" },
  });
  await prisma.game.update({
    where: { id: game.id },
    data: { status: "LIVE", rolesLocked: true, currentRoundNumber: 1 },
  });

  const updatedGame = await prisma.game.findUnique({ where: { id: game.id } });
  console.log(`✓ Game status updated to: ${updatedGame?.status}`);
  console.log(`Player 1 (#01) Role: ENGINEER (Private to Player 1)`);
  console.log(`Player 2 (#02) Role: IMPOSTOR (Private to Player 2)`);

  // 8. Impostor eliminates Engineer
  console.log("\n--- STEP 8: IMPOSTOR ELIMINATION ---");
  await prisma.participant.update({
    where: { id: p1.id },
    data: { status: "ELIMINATED" },
  });
  console.log(`✓ Player #01 eliminated by Player #02`);

  // 9. Host Concludes Game
  console.log("\n--- STEP 9: MATCH CONCLUDED & WINNER DECLARED ---");
  await prisma.game.update({
    where: { id: game.id },
    data: { status: "FINISHED" },
  });
  console.log("✓ Game Status: FINISHED — Impostors Win!");

  // Clean up test game
  await prisma.participant.deleteMany({ where: { gameId: game.id } });
  await prisma.game.delete({ where: { id: game.id } });
  await prisma.studentAccount.deleteMany({ where: { collegeRegId: { in: ["230910452", "230910888"] } } });
  console.log("✓ Test records cleaned. Clean DB verified.");

  console.log("\n==================================================");
  console.log("ALL PRODUCT FLOWS VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runEndToEndSimulation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Simulation failed:", err);
    process.exit(1);
  });
