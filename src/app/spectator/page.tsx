"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";

interface ProjectorState {
  round: { number: number; name: string; msRemaining: number | null } | null;
  phase: string | null;
  globalProgress: { completed: number; inPlay: number; percentage: number };
  aliveCount: number;
  eliminatedCount: number;
  meetingState: { status: string; type: string } | null;
  votingState: { isOpen: boolean } | null;
  recentPublicEvents: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  finalResult: { winner: string; reason: string; stats: unknown } | null;
}

/**
 * No login form — access is exclusively via the secret /spectator/<token>
 * link, which exchanges for a session cookie (see
 * src/app/spectator/[secret]/route.ts) before ever reaching this page.
 * Cinematic-leaning layout (large type, centered, 16:9-friendly) per the
 * brief's direction, without a full design pass — that comes later.
 */
export default function SpectatorPage() {
  const [state, setState] = useState<ProjectorState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/game/state");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? res.statusText);
      return;
    }
    setState(await res.json());
    setError(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; refresh()'s setState calls happen after an await, not synchronously
    void refresh();
  }, [refresh]);

  const onRealtimeEvent = useCallback(() => void refresh(), [refresh]);
  useGameRealtime({ enabled: true, onEvent: onRealtimeEvent });

  if (error && !state) {
    return (
      <main
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#888",
        }}
      >
        <p>Access via your spectator link (/spectator/&lt;secret&gt;).</p>
      </main>
    );
  }

  const percentage = state?.globalProgress?.percentage ?? 0;
  const filled = Math.round(percentage / 5);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 40,
      }}
    >
      <h1 style={{ fontSize: 24, letterSpacing: 4, opacity: 0.7, margin: 0 }}>NOTHING SUS</h1>
      {state && (
        <>
          <h2 style={{ fontSize: 48, margin: "16px 0" }}>
            {state.round ? `ROUND ${state.round.number}` : "—"}
          </h2>
          <p style={{ fontSize: 20, opacity: 0.7 }}>{state.phase ?? ""}</p>

          {state.meetingState && (
            <p style={{ fontSize: 28, color: "#e33", margin: "16px 0" }}>
              🚨 MEETING — {state.meetingState.status} {state.votingState?.isOpen ? "(VOTING OPEN)" : ""}
            </p>
          )}

          {state.finalResult ? (
            <h2 style={{ fontSize: 56, margin: "24px 0" }}>
              {state.finalResult.winner} WIN — {state.finalResult.reason}
            </h2>
          ) : (
            <>
              <p style={{ fontSize: 22, marginTop: 40, marginBottom: 8, letterSpacing: 2 }}>GLOBAL TASK PROGRESS</p>
              <pre style={{ fontSize: 32, margin: 0 }}>
                {"█".repeat(filled)}
                {"░".repeat(20 - filled)}
              </pre>
              <p style={{ fontSize: 40, margin: "8px 0 40px" }}>{percentage}%</p>

              <div style={{ display: "flex", gap: 64 }}>
                <div>
                  <div style={{ fontSize: 48 }}>{state.aliveCount}</div>
                  <div style={{ fontSize: 16, opacity: 0.6, letterSpacing: 2 }}>ALIVE</div>
                </div>
                <div>
                  <div style={{ fontSize: 48 }}>{state.eliminatedCount}</div>
                  <div style={{ fontSize: 16, opacity: 0.6, letterSpacing: 2 }}>ELIMINATED</div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
