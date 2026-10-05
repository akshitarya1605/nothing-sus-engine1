import { TaskDifficulty } from "@prisma/client";

export type Profession = "ENGINEER" | "SCIENTIST" | "ELECTRICIAN" | "PLUMBER";

export const PROFESSIONS: Profession[] = ["ENGINEER", "SCIENTIST", "ELECTRICIAN", "PLUMBER"];

export interface TaskDefinition {
  title: string;
  description: string;
  difficulty: TaskDifficulty;
  points: number;
  otp: string;
  profession?: Profession; // undefined means common
}

// 3 COMMON TASKS (Shared by everyone)
export const COMMON_TASKS: TaskDefinition[] = [
  {
    title: "SYSTEM OVERRIDE",
    description: "Solve terminal cryptographic sequence override.",
    difficulty: TaskDifficulty.EASY,
    points: 10,
    otp: "32",
  },
  {
    title: "SHIELDS DEFLECTOR",
    description: "Prime deflector shield emitters to restore hull integrity.",
    difficulty: TaskDifficulty.EASY,
    points: 15,
    otp: "3367",
  },
  {
    title: "WIRE ROUTING",
    description: "Connect matching electrical conduits across primary distribution nodes.",
    difficulty: TaskDifficulty.EASY,
    points: 15,
    otp: "4820",
  },
];

// 3 UNIQUE TASKS PER PROFESSION (12 unique tasks)
export const PROFESSION_TASKS: Record<Profession, TaskDefinition[]> = {
  ENGINEER: [
    {
      title: "REACTOR CIRCUIT ROUTER",
      description: "Align power conduits to route plasma safely to the main core.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "7492",
      profession: "ENGINEER",
    },
    {
      title: "CALIBRATE ENGINES",
      description: "Align fluctuating hydraulic flywheels into target resonance zones.",
      difficulty: TaskDifficulty.MEDIUM,
      points: 20,
      otp: "6148",
      profession: "ENGINEER",
    },
    {
      title: "STEERING THRUSTER MATRIX",
      description: "Compensate gyroscopic drift and stabilize propulsion vectors.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "8204",
      profession: "ENGINEER",
    },
  ],
  SCIENTIST: [
    {
      title: "DNA SEQUENCE RECOMBINATOR",
      description: "Match codon nucleotide pairs (A-T, C-G) to repair viral samples.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "9415",
      profession: "SCIENTIST",
    },
    {
      title: "SPECTRAL CHEMICAL CENTRIFUGE",
      description: "Balance compound density by regulating centrifuge temperature and RPM.",
      difficulty: TaskDifficulty.MEDIUM,
      points: 20,
      otp: "3891",
      profession: "SCIENTIST",
    },
    {
      title: "TELESCOPE DEEP SPACE LOCK",
      description: "Track and calibrate deep space pulsar frequencies on the astronomical reticle.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "7132",
      profession: "SCIENTIST",
    },
  ],
  ELECTRICIAN: [
    {
      title: "COMMS SPECTRAL LOCK",
      description: "Match frequency, phase, and harmonics to calibrate sub-space communications.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "8921",
      profession: "ELECTRICIAN",
    },
    {
      title: "BREAKER GRID SEQUENCER",
      description: "Memorize and restore auxiliary power breaker relay pulses in sequence.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "4376",
      profession: "ELECTRICIAN",
    },
    {
      title: "VOLTAGE REGULATOR NODE",
      description: "Equalize capacitor charges across primary power bus bars before overload.",
      difficulty: TaskDifficulty.MEDIUM,
      points: 20,
      otp: "5629",
      profession: "ELECTRICIAN",
    },
  ],
  PLUMBER: [
    {
      title: "O2 PRESSURE MATRIX",
      description: "Equalize chamber psi valves and execute membrane purge sequence.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "5183",
      profession: "PLUMBER",
    },
    {
      title: "HYDRO PIPE JUNCTION",
      description: "Route high-pressure coolant conduits and isolate ruptured pipe valves.",
      difficulty: TaskDifficulty.HARD,
      points: 25,
      otp: "2784",
      profession: "PLUMBER",
    },
    {
      title: "FILTER DECONTAMINATION PURGE",
      description: "Neutralize toxic contaminants in the primary vortex filter before clog.",
      difficulty: TaskDifficulty.MEDIUM,
      points: 20,
      otp: "6931",
      profession: "PLUMBER",
    },
  ],
};

// All 15 tasks combined
export const ALL_TASKS: TaskDefinition[] = [
  ...COMMON_TASKS,
  ...PROFESSION_TASKS.ENGINEER,
  ...PROFESSION_TASKS.SCIENTIST,
  ...PROFESSION_TASKS.ELECTRICIAN,
  ...PROFESSION_TASKS.PLUMBER,
];

/**
 * Assigns a deterministic profession to a participant based on their playerNumber or id hash.
 */
export function getParticipantProfession(playerNumber: number | null | undefined, participantId: string): Profession {
  if (playerNumber && playerNumber > 0) {
    return PROFESSIONS[(playerNumber - 1) % PROFESSIONS.length];
  }
  // Fallback hash from ID
  let sum = 0;
  for (let i = 0; i < participantId.length; i++) {
    sum += participantId.charCodeAt(i);
  }
  return PROFESSIONS[sum % PROFESSIONS.length];
}

/**
 * Returns the exact 6 tasks for a given profession (3 common + 3 unique).
 */
export function getTasksForProfession(profession: Profession): TaskDefinition[] {
  return [...COMMON_TASKS, ...PROFESSION_TASKS[profession]];
}
