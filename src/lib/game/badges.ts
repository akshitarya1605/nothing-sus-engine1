import { randomInt } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

// Excludes visually confusing characters: 0, O, 1, I, 5, S
export const BADGE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ2346789";
export const BADGE_LENGTH = 4;

export function generateRandomBadge(): string {
  let badge = "";
  for (let i = 0; i < BADGE_LENGTH; i++) {
    badge += BADGE_ALPHABET[randomInt(0, BADGE_ALPHABET.length)];
  }
  return badge;
}

type Queryable = PrismaClient | Prisma.TransactionClient;

/**
 * Generates a unique, non-sequential badge within the specified game.
 */
export async function generateUniqueGameBadge(tx: Queryable, gameId: string): Promise<string> {
  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateRandomBadge();
    const existing = await tx.participant.findFirst({
      where: {
        gameId,
        badge: candidate,
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  // Fallback with an extra character if density is high
  return `${generateRandomBadge()}${BADGE_ALPHABET[randomInt(0, BADGE_ALPHABET.length)]}`;
}
