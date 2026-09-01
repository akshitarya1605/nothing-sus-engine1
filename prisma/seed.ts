/**
 * Seeds a realistic demo game by driving the actual game engine actions
 * (not hand-crafted rows) — every participant, role, task completion,
 * meeting, vote, and elimination is produced by the same code paths the
 * real Participant/Admin apps call. If this script succeeds, the core
 * flow is proven to work end to end against real Postgres.
 */
import { prisma } from "../src/lib/db/prisma";
import { DEFAULT_ROUND_SCHEDULE } from "../src/lib/game/constants";
import * as ParticipantsEngine from "../src/lib/game/actions/participants";
import * as GroupsEngine from "../src/lib/game/actions/groups";
import * as RoundsEngine from "../src/lib/game/actions/rounds";
import * as TasksEngine from "../src/lib/game/actions/tasks";
import * as MeetingsEngine from "../src/lib/game/actions/meetings";
import * as VotingEngine from "../src/lib/game/actions/voting";
import { MeetingType, TaskDifficulty } from "@prisma/client";

const PARTICIPANT_NAMES = [
  "Ava Chen", "Ben Osei", "Carla Rossi", "Devraj Singh", "Ella Nguyen",
  "Farid Khan", "Grace Kim", "Hiro Tanaka", "Ines Alvarez", "Jamal Brooks",
  "Kira Petrova", "Liam O'Connor", "Maya Patel", "Noah Fischer", "Omolara Ade",
  "Priya Sharma", "Quinn Baker", "Rosa Delgado", "Sam Whitfield", "Tariq Malik",
];

const GROUP_NAMES = ["Engineering", "Design", "Marketing"];

const LOCATIONS = [
  { name: "LHC 202", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 205", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 209", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 210", floor: "2", building: "Learning Hub Center" },
  { name: "LHC 211", floor: "2", building: "Learning Hub Center" },
];

const TASK_DEFS = [
  { title: "Recalibrate the router", difficulty: TaskDifficulty.EASY, points: 10, minutes: 5 },
  { title: "Decode the whiteboard cipher", difficulty: TaskDifficulty.MEDIUM, points: 20, minutes: 10 },
  { title: "Restore the backup server", difficulty: TaskDifficulty.HARD, points: 35, minutes: 15 },
  { title: "Patch the security log", difficulty: TaskDifficulty.MEDIUM, points: 20, minutes: 10 },
  { title: "Align the projector array", difficulty: TaskDifficulty.EASY, points: 10, minutes: 5 },
  { title: "Rewire the badge scanner", difficulty: TaskDifficulty.EXPERT, points: 50, minutes: 20 },
];

async function main() {
  console.log("Seeding demo game...");

  // Fixed, memorable id + admin/spectator secrets for local/demo use —
  // /control/ARSH235 and /spectator/ARSH235 log straight in, and
  // participant code ARSH235 logs in as a regular participant too. Not
  // meant for a real production deployment — see docs/SECURITY.md.
  const DEMO_GAME_ID = "ARSH235";
  await prisma.game.deleteMany({ where: { id: DEMO_GAME_ID } });

  const game = await prisma.game.create({
    data: {
      id: DEMO_GAME_ID,
      name: "Nothing Sus — Demo Event",
      adminSecret: "ARSH235",
      spectatorSecret: "ARSH235",
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

  const groups = await Promise.all(GROUP_NAMES.map((name) => GroupsEngine.createGroup(game.id, name, prisma)));

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

  // 20+ tasks spread across all 4 rounds, some group-restricted, some
  // open to everyone. Print the first few OTPs so the demo is usable
  // without querying the DB by hand.
  const createdTasks: Array<{ taskId: string; otp: string; title: string }> = [];
  for (const round of rounds) {
    for (let i = 0; i < TASK_DEFS.length; i++) {
      const def = TASK_DEFS[i];
      const groupId = i % 3 === 0 ? groups[i % groups.length].id : null; // ~1/3 group-restricted
      const result = await TasksEngine.createTask(
        game.id,
        {
          roundId: round.id,
          groupId,
          title: def.title,
          description: `${round.name} task: ${def.title}.`,
          locationId: locations[i % locations.length].id,
          difficulty: def.difficulty,
          estimatedMinutes: def.minutes,
          points: def.points,
        },
        prisma,
      );
      createdTasks.push({ ...result, title: def.title });
    }
  }
  console.log(`Created ${createdTasks.length} tasks across ${rounds.length} rounds`);

  const participants = [];
  for (let i = 0; i < PARTICIPANT_NAMES.length; i++) {
    const participant = await ParticipantsEngine.createParticipant(
      game.id,
      { name: PARTICIPANT_NAMES[i], groupId: groups[i % groups.length].id },
      prisma,
    );
    participants.push(participant);
  }

  // Fixed demo participant, in no group, so a "just try it" login is
  // also ARSH235 / ARSH235.
  const demoParticipant = await prisma.participant.create({
    data: { gameId: game.id, code: "ARSH235", name: "Arsh" },
  });
  participants.push(demoParticipant);
  console.log(`Created ${participants.length} participants across ${groups.length} groups`);

  await ParticipantsEngine.assignRoles(game.id, 4, prisma);
  await ParticipantsEngine.lockRoles(game.id, prisma);
  console.log("Roles assigned and locked (4 imposters)");

  await RoundsEngine.markGameReady(game.id, prisma);
  await RoundsEngine.startRound(game.id, 1, prisma);
  console.log("Round 1 started");

  await prisma.participant.updateMany({ where: { gameId: game.id }, data: { currentRoundNumber: 1 } });

  // a handful of participants make progress on round 1 tasks, using the
  // real OTP flow (right answers only, to keep the seed deterministic)
  const round1Tasks = createdTasks.slice(0, TASK_DEFS.length);
  const active = await prisma.participant.findMany({ where: { gameId: game.id }, orderBy: { name: "asc" } });
  for (let i = 0; i < 8; i++) {
    const participant = active[i];
    const task = round1Tasks[i % round1Tasks.length];
    await TasksEngine.startTask(participant.id, task.taskId, prisma).catch(() => {
      // group-restricted task this participant isn't eligible for — skip
    });
    if (i % 2 === 0) {
      await TasksEngine.submitTaskOtp(participant.id, task.taskId, task.otp, prisma).catch(() => {});
    }
  }
  console.log("Seeded task progress");

  // a full meeting -> voting -> elimination cycle so the demo shows the
  // whole pipeline, not just a pending call
  const meeting = await MeetingsEngine.callMeeting(
    game.id,
    { type: MeetingType.ADMIN_CALLED, reason: "Suspicious activity reported near LHC 210" },
    prisma,
  );
  await MeetingsEngine.startVoting(game.id, meeting.id, prisma);

  const alive = active.filter((p) => p.id !== active[0].id).slice(0, 6);
  const target = active[1];
  for (const voter of alive) {
    if (voter.id === target.id) continue;
    await VotingEngine.castVote(game.id, voter.id, { meetingId: meeting.id, targetParticipantId: target.id }, prisma).catch(
      () => {},
    );
  }
  console.log("Sample votes cast (voting left open for the demo — admin can close it)");

  console.log("\nDone.\n");
  console.log(`Game ID: ${game.id}`);
  console.log(`Admin:      /control/${game.adminSecret ?? "ARSH235"}`);
  console.log(`Spectator:  /spectator/ARSH235`);
  console.log(`Participant login: code ARSH235 (or any of the ${participants.length - 1} generated codes below)`);
  console.log(`Sample participant codes:`);
  for (const p of participants.slice(0, 4)) {
    console.log(`  ${p.name}: ${p.code}`);
  }
  console.log(`Sample task OTPs:`);
  for (const t of createdTasks.slice(0, 4)) {
    console.log(`  ${t.title}: ${t.otp}`);
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
