import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { mintRealtimeToken, verifyRealtimeToken } from "@/lib/realtime/token";
import type { AnySession } from "@/lib/auth/session";

const secretKey = () => new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

const participant: AnySession = { kind: "PARTICIPANT", gameId: "game-1", participantId: "p-1" };
const admin: AnySession = { kind: "ADMIN", gameId: "game-1" };

describe("realtime token", () => {
  it("round-trips a participant session's claims", async () => {
    const { token, expiresIn } = await mintRealtimeToken(participant);
    expect(expiresIn).toBe(300);

    const claims = await verifyRealtimeToken(token);
    expect(claims).toMatchObject({
      role: "authenticated",
      session_kind: "PARTICIPANT",
      game_id: "game-1",
      participant_id: "p-1",
    });
  });

  it("omits participant_id for non-participant sessions", async () => {
    const { token } = await mintRealtimeToken(admin);
    const claims = await verifyRealtimeToken(token);
    expect(claims.session_kind).toBe("ADMIN");
    expect(claims.participant_id).toBeUndefined();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ role: "authenticated", session_kind: "ADMIN", game_id: "game-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("authenticated")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secretKey());

    await expect(verifyRealtimeToken(expired)).rejects.toThrow();
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = await new SignJWT({ role: "authenticated", session_kind: "ADMIN", game_id: "game-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("not-the-real-secret-not-the-real-secret"));

    await expect(verifyRealtimeToken(forged)).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const { token } = await mintRealtimeToken(admin);
    const [h, p, s] = token.split(".");
    // flip a character in the payload segment, keep the old signature
    const tamperedPayload = p.slice(0, -2) + (p.slice(-2) === "AA" ? "BB" : "AA");
    await expect(verifyRealtimeToken(`${h}.${tamperedPayload}.${s}`)).rejects.toThrow();
  });

  it("rejects a token whose payload is missing required claims", async () => {
    const thin = await new SignJWT({ role: "authenticated", session_kind: "PARTICIPANT" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secretKey());

    await expect(verifyRealtimeToken(thin)).rejects.toThrow(/shape validation|participant_id/);
  });
});
