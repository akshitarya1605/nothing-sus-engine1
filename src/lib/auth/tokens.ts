import { randomBytes, createHash } from "node:crypto";

/** Every session in this app (participant, admin, spectator) works the
 * same way: generate a high-entropy raw token, put ONLY the raw token
 * in an httpOnly cookie, and store only its sha256 hash server-side.
 * The raw token never touches the database, so a DB read (or leak)
 * never hands over a usable credential — see docs/SECURITY.md. */

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
