"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export default function ProjectorPage() {
  const [gameId, setGameId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [state, setState] = useState<ProjectorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef("0");

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
    if (!loggedIn) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; refresh()'s setState calls happen after an await, not synchronously
    void refresh();
    const source = new EventSource(`/api/realtime?since=${cursorRef.current}`);
    source.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      cursorRef.current = data.sequenceNumber;
      void refresh();
    };
    return () => source.close();
  }, [loggedIn, refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, passphrase, role: "PROJECTOR" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? res.statusText);
      return;
    }
    setLoggedIn(true);
  }

  if (!loggedIn) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 480 }}>
        <h1>Projector Login</h1>
        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Game ID
            <input value={gameId} onChange={(e) => setGameId(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Passphrase
            <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <button type="submit">Log in</button>
        </form>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 780 }}>
      <h1>Projector</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {state && (
        <>
          <section>
            <h2>{state.round ? `Round ${state.round.number} — ${state.round.name}` : "No active round"}</h2>
            <p>Phase: {state.phase ?? "—"}</p>
            <p>Time remaining: {state.round?.msRemaining ?? "n/a"} ms</p>
            <p>
              Global task progress: {state.globalProgress?.completed ?? "—"}/{state.globalProgress?.inPlay ?? "—"} (
              {state.globalProgress?.percentage ?? 0}%)
            </p>
            <p>Alive: {state.aliveCount} — Eliminated: {state.eliminatedCount}</p>
            {state.meetingState && (
              <p>
                Meeting: {state.meetingState.status} ({state.meetingState.type}) — Voting open:{" "}
                {String(state.votingState?.isOpen)}
              </p>
            )}
            {state.finalResult && (
              <p>
                <strong>
                  Winner: {state.finalResult.winner} — {state.finalResult.reason}
                </strong>
              </p>
            )}
          </section>

          <section>
            <h2>Public activity</h2>
            <ul>
              {state.recentPublicEvents.map((e) => (
                <li key={e.id}>
                  {e.type}: {JSON.stringify(e.payload)}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
