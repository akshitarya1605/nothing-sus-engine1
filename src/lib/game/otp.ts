import { createHash } from "node:crypto";

/**
 * A 4-digit OTP has only 10,000 possibilities, so hashing it doesn't
 * add much on its own — the real defense against brute force is the
 * attempt rate limit in tasks.ts (GameConfig.otpRateLimitMax per
 * otpRateLimitWindowSeconds, backed by the TaskAttempt table, not a
 * client-side counter). We still never store or transmit the plaintext
 * value once generated, per the brief — this is that one function.
 */
export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}
