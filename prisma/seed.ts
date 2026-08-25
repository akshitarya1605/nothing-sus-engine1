/**
 * Seeds a realistic demo game by driving the actual game engine actions
 * (not hand-crafted rows) — every player, role, task completion, and
 * the pending meeting are produced by the same code paths the real
 * Player/Admin apps will call. If this script succeeds, the engine's
 * core flow (create players -> assign/lock roles -> ready -> start
 * round -> complete tasks -> call meeting) is proven to work end to end.
 */
import { prisma } from "../src/lib/db/prisma";
import { DEFAULT_ROUND_SCHEDULE } from "../src/lib/game/constants";
import * as PlayersEngine from "../src/lib/game/actions/players";
import * as RoundsEngine from "../src/lib/game/actions/rounds";
import * as TasksEngine from "../src/lib/game/actions/tasks";
import * as MeetingsEngine from "../src/lib/game/actions/meetings";
import { MeetingType, TaskDifficulty, CompletionType } from "@prisma/client";

const PLAYER_NAMES = [
  "Ava Chen", "Ben Osei", "Carla Rossi", "Devraj Singh", "Ella Nguyen",
  "Farid Khan", "Grace Kim", "Hiro Tanaka", "Ines Alvarez", "Jamal Brooks",
  "Kira Petrova", "Liam O'Connor",
];

const LOCATIONS = [
  { name: "LHC 202", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 205", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 209", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 210", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 211", floor: "2", building: "Learning Hub Center" },
];

async function main() {
  console.log("Seeding demo game...");

  const game = await prisma.game.create({
    data: {
      name: "Nothing Sus — Demo Event",
      config: {
        create: {
          totalRounds: DEFAULT_ROUND_SCHEDULE.length,
          meetingAfterMinutes: 20,
          allowEmergencyMeeting: true,
          revealRoleAfterVote: true,
          allowImposterElimination: true,
        },
      },
    },
  });
  console.log("Game:", game.id);

  const locations = await Promise.all(
    LOCATIONS.map((loc) => prisma.location.create({ data: { gameId: game.id, ...loc } })),
  );

  const today = new Date();
  const rounds = await Promise.all(
    DEFAULT_ROUND_SCHEDULE.map((r) => {
      const scheduledStartAt = new Date(today);
      scheduledStartAt.setHours(r.hour, r.minute, 0, 0);
      return prisma.round.create({
        data: {
          gameId: game.id,
          number: r.number,
          name: r.name,
          scheduledStartAt,
          durationMinutes: r.durationMinutes,
        },
      });
    }),
  );

  const taskDefs = [
    { name: "Recalibrate the router", difficulty: TaskDifficulty.EASY, points: 10, minutes: 5 },
    { name: "Decode the whiteboard cipher", difficulty: TaskDifficulty.MEDIUM, points: 20, minutes: 10 },
    { name: "Restore the backup server", difficulty: TaskDifficulty.HARD, points: 35, minutes: 15 },
    { name: "Patch the security log", difficulty: TaskDifficulty.MEDIUM, points: 20, minutes: 10 },
    { name: "Align the projector array", difficulty: TaskDifficulty.EASY, points: 10, minutes: 5 },
  ];

  const round1Tasks = await Promise.all(
    taskDefs.map((t, i) =>
      prisma.task.create({
        data: {
          gameId: game.id,
          roundId: rounds[0].id,
          name: t.name,
          description: `Round 1 task: ${t.name}.`,
          locationId: locations[i % locations.length].id,
          difficulty: t.difficulty,
          estimatedMinutes: t.minutes,
          points: t.points,
          status: "AVAILABLE",
          completionType: CompletionType.MANUAL_CONFIRMATION,
        },
      }),
    ),
  );

  // remaining rounds get a lighter task set so the demo isn't enormous
  for (const round of rounds.slice(1)) {
    await Promise.all(
      taskDefs.slice(0, 3).map((t, i) =>
        prisma.task.create({
          data: {
            gameId: game.id,
            roundId: round.id,
            name: t.name,
            description: `${round.name} task: ${t.name}.`,
            locationId: locations[i % locations.length].id,
            difficulty: t.difficulty,
            estimatedMinutes: t.minutes,
            points: t.points,
            status: "AVAILABLE",
            completionType: CompletionType.MANUAL_CONFIRMATION,
          },
        }),
      ),
    );
  }

  const players = [];
  for (const name of PLAYER_NAMES) {
    const player = await PlayersEngine.createPlayer(game.id, { displayName: name }, prisma);
    players.push(player);
  }
  console.log(`Created ${players.length} players`);

  await PlayersEngine.assignRoles(game.id, 3, prisma);
  await PlayersEngine.lockRoles(game.id, prisma);
  console.log("Roles assigned and locked");

  await RoundsEngine.markGameReady(game.id, prisma);
  await RoundsEngine.startRound(game.id, 1, prisma);
  console.log("Round 1 started");

  // a handful of players make progress on round 1 tasks
  const active = await prisma.player.findMany({ where: { gameId: game.id }, orderBy: { displayName: "asc" } });
  await prisma.player.updateMany({ where: { gameId: game.id }, data: { currentRoundNumber: 1 } });

  for (const player of active.slice(0, 5)) {
    const task = round1Tasks[active.indexOf(player) % round1Tasks.length];
    await TasksEngine.startTask(player.id, task.id, prisma);
    if (active.indexOf(player) % 2 === 0) {
      await TasksEngine.completeTask(player.id, task.id, { confirmedBy: "seed-script" }, prisma);
    }
  }
  console.log("Seeded task progress");

  await MeetingsEngine.callMeeting(
    game.id,
    { type: MeetingType.ADMIN_CALLED, reason: "Suspicious activity reported near LHC 210" },
    prisma,
  );
  console.log("Pending meeting created (not yet in voting)");

  console.log("\nDone.\n");
  console.log(`Game ID: ${game.id}`);
  console.log(`Admin login: POST /api/auth/admin-login { gameId: "${game.id}", role: "ADMIN", passphrase: <ADMIN_PASSPHRASE> }`);
  console.log(`Sample player codes:`);
  for (const p of players.slice(0, 3)) {
    console.log(`  ${p.displayName}: ${p.playerCode}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
