"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PlayerState {
  identity: { id: string; displayName: string; playerCode: string };
  ownRole: string | null;
  ownStatus: string;
  game: { status: string; currentRoundNumber: number; currentPhase: string | null };
  round: { number: number; name: string; msRemaining: number | null } | null;
  meetingStatus: string | null;
  ownTasks: Array<{ taskId: string; name: string; difficulty: string; points: number; status: string }>;
  ownProgress: { completed: number; inPlay: number; percentage: number };
  ownLocation: { id: string; name: string } | null;
  notifications: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

/**
 * Deliberately plain — functional QA only, no visual design pass yet.
 * Every action here calls the real /api/game/* routes; nothing here
 * computes game state locally.
 */
export default function PlayerPage() {
  const [gameId, setGameId] = useState("");
  const [playerCode, setPlayerCode] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [state, setState] = useState<PlayerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState("");
  const sourceRef = useRef<EventSource | null>(null);
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
    sourceRef.current = source;
    source.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      cursorRef.current = data.sequenceNumber;
      void refresh();
    };
    return () => source.close();
  }, [loggedIn, refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/player-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, playerCode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? res.statusText);
      return;
    }
    setLoggedIn(true);
  }

  async function call(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? res.statusText);
    }
    await refresh();
  }

  if (!loggedIn) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 480 }}>
        <h1>Player Login</h1>
        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Game ID
            <input value={gameId} onChange={(e) => setGameId(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Player Code
            <input value={playerCode} onChange={(e) => setPlayerCode(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <button type="submit">Log in</button>
        </form>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 640 }}>
      <h1>Player: {state?.identity.displayName}</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {state && (
        <>
          <section>
            <h2>Status</h2>
            <ul>
              <li>Role: {state.ownRole ?? "(not assigned yet)"}</li>
              <li>Status: {state.ownStatus}</li>
              <li>Game status: {state.game.status}</li>
              <li>Round: {state.round ? `${state.round.number} — ${state.round.name}` : "none"}</li>
              <li>Round ms remaining: {state.round?.msRemaining ?? "n/a"}</li>
              <li>Meeting status: {state.meetingStatus ?? "none"}</li>
              <li>
                Progress: {state.ownProgress?.completed ?? "—"}/{state.ownProgress?.inPlay ?? "—"} (
                {state.ownProgress?.percentage ?? 0}%)
              </li>
            </ul>
          </section>

          <section>
            <h2>Tasks</h2>
            <ul>
              {state.ownTasks.map((t) => (
                <li key={t.taskId}>
                  {t.name} [{t.difficulty}, {t.points}pts] — {t.status}{" "}
                  {t.status !== "COMPLETED" && t.status !== "LOCKED" && (
                    <>
                      <button onClick={() => call("/api/game/tasks/start", { taskId: t.taskId })}>Start</button>{" "}
                      <button onClick={() => call("/api/game/tasks/complete", { taskId: t.taskId })}>Complete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Meeting / Voting</h2>
            <label>
              Meeting ID{" "}
              <input value={meetingId} onChange={(e) => setMeetingId(e.target.value)} />
            </label>
            <div>
              <button onClick={() => call("/api/game/meetings/call", { emergency: true, reason: "Emergency!" })}>
                Call emergency meeting
              </button>
            </div>
            <div>
              Vote target player id:{" "}
              <VoteForm onVote={(targetPlayerId) => call("/api/game/votes/cast", { meetingId, targetPlayerId })} />
            </div>
          </section>

          <section>
            <h2>Notifications</h2>
            <ul>
              {state.notifications.map((n) => (
                <li key={n.id}>
                  {n.type}: {JSON.stringify(n.payload)}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function VoteForm({ onVote }: { onVote: (targetPlayerId: string | null) => void }) {
  const [target, setTarget] = useState("");
  return (
    <>
      <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="playerId or blank to skip" />
      <button onClick={() => onVote(target || null)}>Cast vote</button>
    </>
  );
}
