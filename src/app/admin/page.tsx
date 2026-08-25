"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AdminState {
  game: {
    id: string;
    status: string;
    currentRoundNumber: number;
    currentPhase: string | null;
    rolesLocked: boolean;
    pausedFromStatus: string | null;
    pauseReason: string | null;
  };
  rounds: Array<{ number: number; name: string; status: string; startedAt: string | null }>;
  players: Array<{ id: string; displayName: string; playerCode: string; role: string | null; status: string }>;
  taskProgress: { completed: number; inPlay: number; percentage: number };
  activeMeeting: { id: string; status: string; type: string; voteCount: number; aliveVoterCount: number } | null;
  recentAuditLog: Array<{ id: string; action: string; actorType: string; createdAt: string }>;
}

export default function AdminPage() {
  const [gameId, setGameId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imposterCount, setImposterCount] = useState(3);
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
      body: JSON.stringify({ gameId, passphrase, role: "ADMIN" }),
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
        <h1>Admin Login</h1>
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
      <h1>Admin Console</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {state && (
        <>
          <section>
            <h2>Game</h2>
            <ul>
              <li>Status: {state.game.status}</li>
              <li>Round: {state.game.currentRoundNumber} / Phase: {state.game.currentPhase ?? "—"}</li>
              <li>Roles locked: {String(state.game.rolesLocked)}</li>
              <li>
                Task progress: {state.taskProgress?.completed ?? "—"}/{state.taskProgress?.inPlay ?? "—"} (
                {state.taskProgress?.percentage ?? 0}%)
              </li>
            </ul>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => call("/api/game/roles/assign", { imposterCount })}>Assign roles</button>
              <input type="number" value={imposterCount} onChange={(e) => setImposterCount(Number(e.target.value))} style={{ width: 60 }} />
              <button onClick={() => call("/api/game/roles/lock")}>Lock roles</button>
              <button onClick={() => call("/api/game/rounds/ready")}>Mark ready</button>
              <button onClick={() => call("/api/game/rounds/start", { roundNumber: state.game.currentRoundNumber === 0 ? 1 : state.game.currentRoundNumber + 1 })}>
                Start next round
              </button>
              <button onClick={() => call("/api/game/rounds/complete")}>Complete round</button>
              <button onClick={() => call("/api/game/rounds/finish")}>Finish game</button>
              <button onClick={() => call("/api/game/pause", { reason: "manual pause" })}>Pause</button>
              <button onClick={() => call("/api/game/resume")}>Resume</button>
            </div>
          </section>

          <section>
            <h2>Meeting</h2>
            {state.activeMeeting ? (
              <>
                <p>
                  {state.activeMeeting.id} — {state.activeMeeting.status} ({state.activeMeeting.type}) — votes:{" "}
                  {state.activeMeeting.voteCount}/{state.activeMeeting.aliveVoterCount}
                </p>
                <button onClick={() => call("/api/game/meetings/start-voting", { meetingId: state.activeMeeting!.id })}>Start voting</button>{" "}
                <button onClick={() => call("/api/game/meetings/close-voting", { meetingId: state.activeMeeting!.id })}>Close voting</button>{" "}
                <button onClick={() => call("/api/game/meetings/reveal-result", { meetingId: state.activeMeeting!.id })}>Reveal result</button>
              </>
            ) : (
              <>
                <p>No active meeting.</p>
                <button onClick={() => call("/api/game/meetings/call", { reason: "Admin called meeting" })}>Call meeting</button>
              </>
            )}
          </section>

          <section>
            <h2>Role reveal</h2>
            <RevealRoleForm onReveal={(eliminationId) => call("/api/game/eliminations/reveal-role", { eliminationId })} />
          </section>

          <section>
            <h2>Players ({state.players.length})</h2>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th align="left">Name</th>
                  <th align="left">Code</th>
                  <th align="left">Role</th>
                  <th align="left">Status</th>
                  <th align="left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.displayName}</td>
                    <td>{p.playerCode}</td>
                    <td>{p.role ?? "—"}</td>
                    <td>{p.status}</td>
                    <td>
                      {p.status === "ALIVE" ? (
                        <button onClick={() => call("/api/game/eliminations/eliminate", { playerId: p.id })}>Eliminate</button>
                      ) : (
                        <button onClick={() => call("/api/game/players/restore", { playerId: p.id })}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Add player</h2>
            <AddPlayerForm onAdd={(displayName) => call("/api/game/players", { displayName })} />
          </section>

          <section>
            <h2>Recent audit log</h2>
            <ul>
              {state.recentAuditLog.map((a) => (
                <li key={a.id}>
                  {a.createdAt} — {a.actorType} — {a.action}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function RevealRoleForm({ onReveal }: { onReveal: (eliminationId: string) => void }) {
  const [eliminationId, setEliminationId] = useState("");
  return (
    <div>
      <input
        value={eliminationId}
        onChange={(e) => setEliminationId(e.target.value)}
        placeholder="eliminationId"
        style={{ width: 260 }}
      />
      <button onClick={() => eliminationId && onReveal(eliminationId)}>Reveal role</button>
    </div>
  );
}

function AddPlayerForm({ onAdd }: { onAdd: (displayName: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />
      <button
        onClick={() => {
          if (name.trim()) onAdd(name.trim());
          setName("");
        }}
      >
        Add
      </button>
    </div>
  );
}
