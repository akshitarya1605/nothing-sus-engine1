"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ParticipantState {
  identity: { id: string; name: string; code: string };
  ownRole: string | null;
  ownStatus: string;
  game: { status: string; currentRoundNumber: number; currentPhase: string | null };
  round: { number: number; name: string; msRemaining: number | null } | null;
  meetingStatus: string | null;
  ownTasks: Array<{ taskId: string; title: string; difficulty: string; points: number; status: string }>;
  ownProgress: { completed: number; inPlay: number; percentage: number };
  ownLocation: { id: string; name: string } | null;
  notifications: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

/**
 * Deliberately plain (mobile-first layout, minimal chrome) — functional
 * QA, not a design pass. Every action here calls the real
 * /api/game/* routes; nothing here computes game state locally.
 */
export default function ParticipantPage() {
  const [code, setCode] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [state, setState] = useState<ParticipantState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpFeedback, setOtpFeedback] = useState<Record<string, string>>({});
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const cursorRef = useRef("0");
  const meetingIdRef = useRef("");

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

  const refreshChat = useCallback(async (mid: string) => {
    if (!mid) return;
    const res = await fetch(`/api/game/chat?meetingId=${encodeURIComponent(mid)}`);
    if (res.ok) setChat(await res.json());
  }, []);

  // derived, not stored: the active meeting id is always recomputed from
  // the latest state rather than synced into its own piece of state
  const meetingId = (() => {
    const started = state?.notifications.find((n) => n.type === "MEETING_STARTED");
    const payload = started?.payload as { meetingId?: string } | undefined;
    return payload?.meetingId ?? "";
  })();
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  useEffect(() => {
    if (!loggedIn) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; refresh()'s setState calls happen after an await, not synchronously
    void refresh();

    const source = new EventSource(`/api/realtime?since=${cursorRef.current}`);
    source.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      cursorRef.current = data.sequenceNumber;
      void refresh();
      if (data.type === "CHAT_MESSAGE_CREATED" && meetingIdRef.current) void refreshChat(meetingIdRef.current);
    };
    return () => source.close();
  }, [loggedIn, refresh, refreshChat]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; refreshChat()'s setState calls happen after an await, not synchronously
    if (meetingId) void refreshChat(meetingId);
  }, [meetingId, refreshChat]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/participant-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
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

  async function submitOtp(taskId: string) {
    const otp = otpInputs[taskId] ?? "";
    const res = await fetch("/api/game/tasks/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, otp }),
    });
    const body = await res.json();
    if (!res.ok) {
      setOtpFeedback((f) => ({ ...f, [taskId]: body.message ?? "Error" }));
    } else if (body.correct) {
      setOtpFeedback((f) => ({ ...f, [taskId]: "TASK COMPLETED" }));
    } else {
      setOtpFeedback((f) => ({ ...f, [taskId]: `INVALID OTP (${body.attemptsRemaining} attempts left)` }));
    }
    await refresh();
  }

  async function sendChat() {
    if (!chatDraft.trim() || !meetingId) return;
    const res = await fetch("/api/game/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, message: chatDraft }),
    });
    if (res.ok) setChatDraft("");
    await refreshChat(meetingId);
  }

  if (!loggedIn) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 400, margin: "0 auto" }}>
        <h1>Nothing Sus</h1>
        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Participant Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="NS-XXXXXX"
              style={{ display: "block", width: "100%", fontSize: 18, padding: 10 }}
              autoFocus
            />
          </label>
          <button type="submit" style={{ fontSize: 18, padding: 12 }}>
            Enter
          </button>
        </form>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>{state?.identity.name}</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {state && (
        <>
          {state.ownStatus === "ELIMINATED" && (
            <section style={{ background: "#300", color: "#fff", padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <strong>YOU HAVE BEEN ELIMINATED</strong>
              <p>Role: {state.ownRole}</p>
              <p>You are now a spectator.</p>
            </section>
          )}

          <section>
            <ul>
              <li>Role: {state.ownRole ?? "(not assigned yet)"}</li>
              <li>Status: {state.ownStatus}</li>
              <li>Game: {state.game.status} — Round {state.game.currentRoundNumber}</li>
              <li>Meeting: {state.meetingStatus ?? "none"}</li>
              <li>
                Progress: {state.ownProgress?.completed ?? "—"}/{state.ownProgress?.inPlay ?? "—"} (
                {state.ownProgress?.percentage ?? 0}%)
              </li>
            </ul>
          </section>

          {state.meetingStatus === "ACTIVE" || state.meetingStatus === "VOTING" ? (
            <section style={{ background: "#400", padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <h2>🚨 MEETING CALLED 🚨</h2>
              {state.meetingStatus === "VOTING" && state.ownStatus === "ALIVE" && (
                <VoteForm onVote={(t) => call("/api/game/votes/cast", { meetingId, targetParticipantId: t })} />
              )}
              <h3>Chat</h3>
              <div style={{ maxHeight: 160, overflowY: "auto", background: "#111", padding: 8, marginBottom: 8 }}>
                {chat.map((m) => (
                  <div key={m.id}>
                    <strong>{m.senderName}:</strong> {m.message}
                  </div>
                ))}
              </div>
              {state.ownStatus === "ALIVE" ? (
                <div>
                  <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} style={{ width: "70%" }} />
                  <button onClick={sendChat}>Send</button>
                </div>
              ) : (
                <p>(read-only — you were eliminated)</p>
              )}
            </section>
          ) : (
            <section>
              <h2>Tasks</h2>
              {state.ownStatus === "ALIVE" && (
                <button onClick={() => call("/api/game/meetings/call", { emergency: true, reason: "Emergency!" })}>
                  Call emergency meeting
                </button>
              )}
              <ul>
                {state.ownTasks.map((t) => (
                  <li key={t.taskId} style={{ marginBottom: 12 }}>
                    {t.title} [{t.difficulty}, {t.points}pts] — {t.status}
                    {t.status !== "COMPLETED" && state.ownStatus === "ALIVE" && (
                      <div>
                        <input
                          maxLength={4}
                          value={otpInputs[t.taskId] ?? ""}
                          onChange={(e) => setOtpInputs((s) => ({ ...s, [t.taskId]: e.target.value }))}
                          placeholder="4-digit OTP"
                        />
                        <button onClick={() => submitOtp(t.taskId)}>Submit OTP</button>
                        {otpFeedback[t.taskId] && <span> {otpFeedback[t.taskId]}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function VoteForm({ onVote }: { onVote: (targetParticipantId: string | null) => void }) {
  const [target, setTarget] = useState("");
  return (
    <div>
      <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="participantId or blank to skip" />
      <button onClick={() => onVote(target || null)}>Confirm Vote</button>
    </div>
  );
}
