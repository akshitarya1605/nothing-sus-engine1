"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";

interface AdminState {
  game: {
    id: string;
    status: string;
    currentRoundNumber: number;
    currentPhase: string | null;
    rolesLocked: boolean;
    pausedFromStatus: string | null;
    pauseReason: string | null;
    adminSecret: string;
    spectatorSecret: string;
  };
  rounds: Array<{ id: string; number: number; name: string; status: string; startedAt: string | null }>;
  groups: Array<{ id: string; name: string; participantCount: number; taskProgress: { completed: number; inPlay: number; percentage: number } }>;
  participants: Array<{
    id: string;
    name: string;
    code: string;
    role: string | null;
    status: string;
    groupId: string | null;
    groupName: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    roundNumber: number;
    groupId: string | null;
    groupName: string | null;
    difficulty: string;
    points: number;
    status: string;
    completedCount: number;
    attemptCount: number;
  }>;
  taskProgress: { completed: number; inPlay: number; percentage: number };
  activeMeeting: { id: string; status: string; type: string; voteCount: number; aliveVoterCount: number } | null;
  recentAuditLog: Array<{ id: string; action: string; actorType: string; createdAt: string }>;
}

/**
 * No login form — access is exclusively via the secret /control/<token>
 * link (see src/app/control/[secret]/route.ts), which exchanges for a
 * session cookie before this page is ever reached. Dense, control-room
 * style per the brief's direction, without a full design pass.
 */
export default function ControlPage() {
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imposterCount, setImposterCount] = useState(3);

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

  async function call(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(b.message ?? res.statusText);
    } else {
      setError(null);
    }
    await refresh();
    return b;
  }

  if (error && !state) {
    return (
      <main style={{ padding: 32, fontFamily: "monospace", color: "#0f0", background: "#000", minHeight: "100vh" }}>
        <p>Access via your admin link (/control/&lt;secret&gt;).</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui, sans-serif", maxWidth: 1000, background: "#111", color: "#eee", minHeight: "100vh" }}>
      <h1>NOTHING SUS — CONTROL CENTER</h1>
      {error && <p style={{ color: "salmon" }}>{error}</p>}
      {notice && <p style={{ color: "lightgreen" }}>{notice}</p>}
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
              <li>Admin link: /control/{state.game.adminSecret}</li>
              <li>Spectator link: /spectator/{state.game.spectatorSecret}</li>
            </ul>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => call("/api/game/roles/assign", { imposterCount })}>Assign roles</button>
              <input type="number" value={imposterCount} onChange={(e) => setImposterCount(Number(e.target.value))} style={{ width: 60 }} />
              <button onClick={() => call("/api/game/roles/lock")}>Lock roles</button>
              <button onClick={() => call("/api/game/rounds/ready")}>Mark ready</button>
              <button
                onClick={() =>
                  call("/api/game/rounds/start", {
                    roundNumber: state.game.currentRoundNumber === 0 ? 1 : state.game.currentRoundNumber + 1,
                  })
                }
              >
                Start next round
              </button>
              <button onClick={() => call("/api/game/rounds/complete")}>End round</button>
              <button onClick={() => call("/api/game/rounds/finish")}>Finish game</button>
              <button onClick={() => call("/api/game/pause", { reason: "manual pause" })}>Pause game</button>
              <button onClick={() => call("/api/game/resume")}>Resume game</button>
            </div>
          </section>

          <section>
            <h2>Meeting / Voting</h2>
            {state.activeMeeting ? (
              <>
                <p>
                  {state.activeMeeting.id} — {state.activeMeeting.status} ({state.activeMeeting.type}) — votes:{" "}
                  {state.activeMeeting.voteCount}/{state.activeMeeting.aliveVoterCount}
                </p>
                <button onClick={() => call("/api/game/meetings/start-voting", { meetingId: state.activeMeeting!.id })}>Open voting</button>{" "}
                <button onClick={() => call("/api/game/meetings/close-voting", { meetingId: state.activeMeeting!.id })}>Close voting</button>{" "}
                <button
                  onClick={async () => {
                    const r = await call("/api/game/meetings/reveal-result", { meetingId: state.activeMeeting!.id });
                    if (r.outcome) setNotice(`Result: ${r.outcome}${r.eliminatedPlayerId ? ` (${r.eliminatedPlayerId})` : ""}`);
                  }}
                >
                  Confirm elimination
                </button>
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
            <h2>Groups</h2>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th align="left">Group</th>
                  <th align="left">Participants</th>
                  <th align="left">Progress</th>
                </tr>
              </thead>
              <tbody>
                {(state.groups ?? []).map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g.participantCount}</td>
                    <td>{g.taskProgress.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AddGroupForm onAdd={(name) => call("/api/game/groups", { name })} />
          </section>

          <section>
            <h2>Participants ({(state.participants ?? []).length})</h2>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th align="left">Name</th>
                  <th align="left">Code</th>
                  <th align="left">Group</th>
                  <th align="left">Role</th>
                  <th align="left">Status</th>
                  <th align="left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(state.participants ?? []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.code}</td>
                    <td>{p.groupName ?? "—"}</td>
                    <td>{p.role ?? "—"}</td>
                    <td>{p.status}</td>
                    <td>
                      {p.status === "ALIVE" ? (
                        <button onClick={() => call("/api/game/eliminations/eliminate", { participantId: p.id })}>Eliminate</button>
                      ) : (
                        <button onClick={() => call("/api/game/participants/restore", { participantId: p.id })}>Restore</button>
                      )}{" "}
                      <button onClick={() => call("/api/game/participants/force-logout", { participantId: p.id })}>Force logout</button>{" "}
                      <button
                        onClick={async () => {
                          const r = await call("/api/game/participants/reset-code", { participantId: p.id });
                          if (r.code) setNotice(`New code for ${p.name}: ${r.code}`);
                        }}
                      >
                        Reset code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Add / import participants</h2>
            <AddParticipantForm onAdd={(name) => call("/api/game/participants", { name })} />
            <BulkImportForm
              onImport={async (names) => {
                const created = await call("/api/game/participants/bulk-import", { names });
                if (Array.isArray(created)) {
                  setNotice(`Imported ${created.length} participants`);
                }
              }}
            />
          </section>

          <section>
            <h2>Tasks ({(state.tasks ?? []).length})</h2>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th align="left">Title</th>
                  <th align="left">Round</th>
                  <th align="left">Group</th>
                  <th align="left">Status</th>
                  <th align="left">Completed</th>
                  <th align="left">Attempts</th>
                  <th align="left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(state.tasks ?? []).map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{t.roundNumber}</td>
                    <td>{t.groupName ?? "any"}</td>
                    <td>{t.status}</td>
                    <td>{t.completedCount}</td>
                    <td>{t.attemptCount}</td>
                    <td>
                      <button
                        onClick={async () => {
                          const r = await call("/api/game/tasks/regenerate-otp", { taskId: t.id });
                          if (r.otp) setNotice(`New OTP for ${t.title}: ${r.otp}`);
                        }}
                      >
                        Regenerate OTP
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <CreateTaskForm
              rounds={state.rounds}
              onCreate={async (input) => {
                const r = await call("/api/game/tasks/create", input);
                if (r.otp) setNotice(`Created "${input.title}" — OTP: ${r.otp}`);
              }}
            />
          </section>

          <section>
            <h2>Recent audit log</h2>
            <ul style={{ fontSize: 12 }}>
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
      <input value={eliminationId} onChange={(e) => setEliminationId(e.target.value)} placeholder="eliminationId" style={{ width: 260 }} />
      <button onClick={() => eliminationId && onReveal(eliminationId)}>Reveal role</button>
    </div>
  );
}

function AddGroupForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
      <button
        onClick={() => {
          if (name.trim()) onAdd(name.trim());
          setName("");
        }}
      >
        Add group
      </button>
    </div>
  );
}

function AddParticipantForm({ onAdd }: { onAdd: (name: string) => void }) {
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

function BulkImportForm({ onImport }: { onImport: (names: string[]) => void }) {
  const [text, setText] = useState("");
  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="One name per line"
        rows={4}
        style={{ width: 300, display: "block" }}
      />
      <button
        onClick={() => {
          const names = text.split("\n").map((n) => n.trim()).filter(Boolean);
          if (names.length) onImport(names);
          setText("");
        }}
      >
        Bulk import
      </button>
    </div>
  );
}

function CreateTaskForm({
  rounds,
  onCreate,
}: {
  rounds: Array<{ id: string; number: number }>;
  onCreate: (input: {
    roundId: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
    estimatedMinutes: number;
    points: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={roundId} onChange={(e) => setRoundId(e.target.value)}>
        {rounds.map((r) => (
          <option key={r.id} value={r.id}>
            Round {r.number}
          </option>
        ))}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
      <button
        onClick={() => {
          if (!title.trim() || !roundId) return;
          onCreate({
            roundId,
            title: title.trim(),
            description: title.trim(),
            difficulty: "EASY",
            estimatedMinutes: 5,
            points: 10,
          });
          setTitle("");
        }}
      >
        Create task
      </button>
    </div>
  );
}
