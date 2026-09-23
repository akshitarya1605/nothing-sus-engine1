"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useGameRealtime, type GameRealtimeEvent } from "@/lib/realtime/useGameRealtime";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RolePill, StatusPill } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/Progress";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ConnectionChip } from "@/components/ui/ConnectionChip";
import { OtpInput } from "@/components/ui/OtpInput";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { ConfirmModal } from "@/components/ui/Modal";
import { RevealCard } from "@/components/game/RevealCard";
import { MeetingBanner } from "@/components/game/MeetingBanner";
import { TaskProgress } from "@/components/game/TaskProgress";
import { EventFeed, type FeedEvent } from "@/components/game/EventFeed";
import { IsaHeader } from "@/components/ui/IsaHeader";

interface ParticipantState {
  identity: { id: string; name: string; code: string; playerNumber?: number | null; batchNumber?: number };
  ownRole: "ENGINEER" | "IMPOSTER" | null;
  ownStatus: string;
  weaponUnlocked?: boolean;
  lastKillAt?: string | null;
  killCooldownSeconds?: number;
  weaponLocation?: string | null;
  weaponClue?: string | null;
  game: { status: string; currentRoundNumber: number; currentPhase: string | null };
  round: { number: number; name: string; msRemaining: number | null } | null;
  meetingStatus: string | null;
  ownTasks: Array<{ taskId: string; title: string; difficulty: string; points: number; status: string }>;
  ownProgress: { completed: number; inPlay: number; percentage: number };
  ownLocation: { id: string; name: string } | null;
  notifications: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  meetingRoster: Array<{ id: string; name: string; playerNumber?: number | null; status: string }> | null;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ParticipantConsole />
    </Suspense>
  );
}

function Splash() {
  return (
    <main className="ns-screen grid place-items-center bg-void">
      <p className="font-display text-2xl text-fg-faint">Nothing Sus…</p>
    </main>
  );
}

function ParticipantConsole() {
  const params = useSearchParams();
  const [code, setCode] = useState(() => params.get("code")?.toUpperCase() ?? "");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [state, setState] = useState<ParticipantState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);

  const meetingIdRef = useRef("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/game/state?as=PARTICIPANT", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) setLoggedIn(false);
      return;
    }
    setState(await res.json());
  }, []);

  const refreshChat = useCallback(async (mid: string) => {
    if (!mid) return;
    const res = await fetch(`/api/game/chat?meetingId=${encodeURIComponent(mid)}&as=PARTICIPANT`, { cache: "no-store" });
    if (res.ok) setChat(await res.json());
  }, []);

  const meetingId = useMemo(() => {
    const started = state?.notifications.find((n) => n.type === "MEETING_STARTED");
    return (started?.payload as { meetingId?: string } | undefined)?.meetingId ?? "";
  }, [state]);
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  useEffect(() => {
    if (loggedIn) void refresh();
  }, [loggedIn, refresh]);

  useEffect(() => {
    if (meetingId) void refreshChat(meetingId);
  }, [meetingId, refreshChat]);

  const onRealtimeEvent = useCallback(
    (evt: GameRealtimeEvent) => {
      void refresh();
      if (evt.type === "CHAT_MESSAGE_CREATED" && meetingIdRef.current) void refreshChat(meetingIdRef.current);
    },
    [refresh, refreshChat],
  );
  const { status: rt } = useGameRealtime({ enabled: loggedIn, as: "PARTICIPANT", onEvent: onRealtimeEvent });

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/participant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(
          res.status === 409
            ? "This code is already open on another device. Close it there first, or ask the host to reset your code."
            : "That code didn't work. Check it and try again.",
        );
        return;
      }
      void body;
      setLoggedIn(true);
    } finally {
      setLoginBusy(false);
    }
  }

  const call = useCallback(
    async (path: string, body?: unknown) => {
      setActionError(null);
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setActionError(b.message ?? "Something went wrong");
      await refresh();
      return { ok: res.ok, body: b };
    },
    [refresh],
  );

  if (!loggedIn) {
    return <LoginScreen code={code} setCode={setCode} onSubmit={login} error={loginError} busy={loginBusy} />;
  }

  return (
    <main className="ns-screen bg-void px-4 pb-16 pt-5">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl">{state?.identity.name ?? "…"}</h1>
              {state?.identity.playerNumber && (
                <span className="rounded-full border-2 border-yellow bg-yellow/15 px-2.5 py-0.5 font-display text-xs font-bold uppercase text-yellow">
                  #{String(state.identity.playerNumber).padStart(2, "0")}
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-fg-faint">PIN: {state?.identity.code}</p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionChip status={rt} />
            <button
              className="font-display text-xs uppercase text-fg-faint underline"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.reload();
              }}
            >
              Log out
            </button>
          </div>
        </header>

        {actionError && (
          <Panel tone="danger" className="py-3 text-sm text-red">
            {actionError}
          </Panel>
        )}

        {state && <ConsoleBody state={state} chat={chat} meetingId={meetingId} call={call} refreshChat={refreshChat} />}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function LoginScreen({
  code,
  setCode,
  onSubmit,
  error,
  busy,
}: {
  code: string;
  setCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"register" | "login">("register");
  const [fullName, setFullName] = useState("");
  const [collegeRegId, setCollegeRegId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [regMsg, setRegMsg] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !collegeRegId.trim()) return;
    setRegBusy(true);
    setRegMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, collegeRegId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRegMsg(data.message || "Registered! Ask ISA Host to approve your account.");
        setCode(data.participant?.code || collegeRegId);
        setTab("login");
      } else {
        setRegMsg(data.message || "Registration failed");
      }
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <main className="ns-screen flex flex-col justify-between bg-void">
      <IsaHeader />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-6">
        <h1 className="ns-outline mb-1 text-center font-display text-4xl font-black uppercase tracking-wider text-yellow sm:text-5xl">
          Nothing Sus
        </h1>
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest text-cyan">
          Official ISA MUJ Game Platform
        </p>

        {/* Tab switch */}
        <div className="mb-6 flex rounded-pill border-2 border-ink bg-panel p-1">
          <button
            type="button"
            onClick={() => setTab("register")}
            className={cn(
              "flex-1 rounded-pill py-2 font-display text-xs font-bold uppercase tracking-wider transition-all",
              tab === "register" ? "bg-yellow text-ink shadow" : "text-fg-dim",
            )}
          >
            1. Register Student
          </button>
          <button
            type="button"
            onClick={() => setTab("login")}
            className={cn(
              "flex-1 rounded-pill py-2 font-display text-xs font-bold uppercase tracking-wider transition-all",
              tab === "login" ? "bg-cyan text-ink shadow" : "text-fg-dim",
            )}
          >
            2. Enter Game Room
          </button>
        </div>

        {tab === "register" ? (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-fg-dim">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                className="w-full rounded-chunky border-[3px] border-ink bg-elevated px-4 py-3 font-display text-base text-fg outline-none focus:border-yellow"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-fg-dim">College Registration ID</label>
              <input
                value={collegeRegId}
                onChange={(e) => setCollegeRegId(e.target.value.toUpperCase())}
                placeholder="e.g. 239301094"
                required
                className="w-full rounded-chunky border-[3px] border-ink bg-elevated px-4 py-3 font-mono text-base uppercase text-fg outline-none focus:border-yellow"
              />
            </div>
            <Button type="submit" size="lg" block variant="cyan" disabled={regBusy || !fullName.trim() || !collegeRegId.trim()}>
              {regBusy ? "Registering…" : "Create Student Account"}
            </Button>
            {regMsg && <p className="text-center text-xs font-bold text-green mt-1">{regMsg}</p>}
          </form>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-fg-dim">PIN Code or Registration ID</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="NS-XXXXXX or Reg ID"
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-chunky border-[3px] border-ink bg-elevated px-4 py-3 text-center font-mono text-xl tracking-widest text-fg outline-none focus:border-cyan"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-fg-dim">Room Code (Optional)</label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="SUS-XXXX (from TV screen)"
                className="w-full rounded-chunky border-[3px] border-ink bg-elevated px-4 py-3 text-center font-mono text-lg uppercase tracking-widest text-fg outline-none focus:border-cyan"
              />
            </div>
            <Button type="submit" size="lg" block disabled={busy || !code.trim()}>
              {busy ? "Entering Room…" : "Join Game Lobby"}
            </Button>
          </form>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-center text-sm font-bold text-red"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

type CallFn = (path: string, body?: unknown) => Promise<{ ok: boolean; body: Record<string, unknown> }>;

function ConsoleBody({
  state,
  chat,
  meetingId,
  call,
  refreshChat,
}: {
  state: ParticipantState;
  chat: ChatMsg[];
  meetingId: string;
  call: CallFn;
  refreshChat: (mid: string) => void;
}) {
  const disqualified = state.ownStatus === "DISQUALIFIED";
  const eliminated = state.ownStatus === "ELIMINATED" || disqualified;
  const inMeeting = state.meetingStatus === "ACTIVE" || state.meetingStatus === "VOTING";
  const preGame = !state.round || state.game.status === "SETUP" || state.game.status === "READY";

  const roleSeenKey = `ns-role-seen-${state.identity.id}`;
  const [roleAck, setRoleAck] = useState(true);
  useEffect(() => {
    if (!state.ownRole) return;
    try {
      setRoleAck(sessionStorage.getItem(roleSeenKey) === state.ownRole);
    } catch {
      setRoleAck(false);
    }
  }, [state.ownRole, roleSeenKey]);

  if (state.ownRole && !roleAck && !eliminated) {
    return (
      <RoleRevealScreen
        role={state.ownRole}
        onDone={() => {
          try {
            sessionStorage.setItem(roleSeenKey, state.ownRole!);
          } catch {
            /* ignore */
          }
          setRoleAck(true);
        }}
      />
    );
  }

  if (eliminated) return <GhostView state={state} disqualified={disqualified} />;
  if (inMeeting) {
    return (
      <MeetingView state={state} chat={chat} meetingId={meetingId} call={call} refreshChat={refreshChat} />
    );
  }
  if (preGame) return <LobbyView state={state} />;
  return <RoundView state={state} call={call} />;
}

/* ------------------------------------------------------------------ */

function RoleRevealScreen({
  role,
  onDone,
}: {
  role: "ENGINEER" | "IMPOSTER";
  onDone: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [hold, setHold] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    timer.current = setInterval(() => {
      setHold((h) => {
        if (h >= 100) {
          clearInterval(timer.current!);
          setRevealed(true);
          return 100;
        }
        return h + 6;
      });
    }, 30);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    if (!revealed) setHold(0);
  };

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      {!revealed ? (
        <>
          <p className="max-w-xs font-display text-xl text-fg-dim">
            Your role is ready. Make sure nobody can see your screen.
          </p>
          <button
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={stop}
            className="relative grid h-44 w-44 select-none place-items-center overflow-hidden rounded-full border-[3px] border-ink bg-elevated font-display text-lg uppercase text-fg-dim"
          >
            <span
              className="absolute inset-0 bg-cyan/30"
              style={{ clipPath: `inset(${100 - hold}% 0 0 0)` }}
            />
            <span className="relative">Hold to reveal</span>
          </button>
        </>
      ) : (
        <>
          <RevealCard
            role={role}
            subtitle={
              role === "IMPOSTER"
                ? "Blend in. Sabotage. Don't get caught."
                : "Finish your tasks. Find the imposters."
            }
          />
          <Button size="lg" onClick={onDone}>
            Got it — hide my role
          </Button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LobbyView({ state }: { state: ParticipantState }) {
  const roomCode = (state.game as unknown as { roomCode?: string })?.roomCode;

  return (
    <Panel className="flex flex-col items-center gap-5 py-8 text-center border-2 border-cyan/40 bg-panel/90 backdrop-blur-md">
      <PlayerAvatar id={state.identity.id} size={80} />
      <div>
        <h2 className="text-2xl font-black uppercase text-yellow">
          {state.identity.name}
        </h2>
        {state.identity.playerNumber && (
          <span className="mt-1 inline-block rounded-full border-2 border-yellow bg-yellow/20 px-3 py-0.5 font-display text-xs font-bold uppercase text-yellow">
            Player #{String(state.identity.playerNumber).padStart(2, "0")}
          </span>
        )}
      </div>

      {roomCode && (
        <div className="w-full rounded-2xl border-2 border-cyan/30 bg-elevated p-3">
          <p className="text-[10px] uppercase tracking-widest text-fg-faint font-bold">LOBBY ROOM CODE</p>
          <p className="font-mono text-2xl font-black tracking-wider text-cyan">{roomCode}</p>
        </div>
      )}

      <div className="w-full rounded-full border border-yellow/40 bg-yellow/10 px-4 py-2 font-display text-xs font-bold uppercase text-yellow animate-pulse">
        ⏳ Waiting for ISA Host to start the round…
      </div>

      <p className="text-xs text-fg-dim">
        Keep this screen open on your phone. Your secret role (Engineer or Impostor) and tasks will appear automatically when the host launches the round!
      </p>

      <RolePill role={state.ownRole} />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function RoundView({ state, call }: { state: ParticipantState; call: CallFn }) {
  const [otp, setOtp] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, { kind: "ok" | "err"; msg: string }>>({});
  const [confirmMeeting, setConfirmMeeting] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const submitOtp = async (taskId: string) => {
    setSubmitting(taskId);
    try {
      const res = await fetch("/api/game/tasks/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, otp: otp[taskId] ?? "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.correct) {
        setFeedback((f) => ({ ...f, [taskId]: { kind: "ok", msg: "Task complete!" } }));
      } else if (res.ok) {
        setFeedback((f) => ({
          ...f,
          [taskId]: { kind: "err", msg: `Wrong code — ${body.attemptsRemaining} left` },
        }));
        setOtp((o) => ({ ...o, [taskId]: "" }));
      } else {
        setFeedback((f) => ({ ...f, [taskId]: { kind: "err", msg: body.message ?? "Error" } }));
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex items-center gap-4">
        <ProgressRing value={state.ownProgress.percentage} size={92} stroke={10}>
          <span className="font-display text-xl font-bold">
            {state.ownProgress.completed}
            <span className="text-fg-faint">/{state.ownProgress.inPlay}</span>
          </span>
        </ProgressRing>
        <div className="flex-1">
          <p className="font-display text-sm uppercase tracking-wide text-fg-faint">
            Round {state.round?.number} · {state.round?.name}
          </p>
          <p className="font-display text-4xl font-bold">
            <CountdownTimer msRemaining={state.round?.msRemaining ?? null} />
          </p>
          <div className="mt-1 flex gap-2">
            <RolePill role={state.ownRole} />
            <StatusPill status={state.ownStatus} />
          </div>
        </div>
      </Panel>

      {state.ownRole === "IMPOSTER" && state.ownStatus === "ALIVE" && (
        <ImpostorKillPanel state={state} call={call} />
      )}

      <h2 className="mt-2 font-display text-xl">Your tasks</h2>
      {state.ownTasks.length === 0 && (
        <Panel tone="flat" className="text-sm text-fg-dim">
          No tasks assigned yet.
        </Panel>
      )}
      {state.ownTasks.map((t) => {
        const done = t.status === "COMPLETED";
        const fb = feedback[t.taskId];
        return (
          <Panel key={t.taskId} tone={done ? "cyan" : "default"} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={cn("font-display text-lg", done && "text-cyan line-through")}>{t.title}</p>
                <p className="text-xs text-fg-faint">
                  {t.difficulty} · {t.points} pts
                </p>
              </div>
              {done && <span className="text-2xl">✓</span>}
            </div>
            {!done && state.ownStatus === "ALIVE" && (
              <>
                <OtpInput
                  value={otp[t.taskId] ?? ""}
                  onChange={(v) => setOtp((o) => ({ ...o, [t.taskId]: v }))}
                  tone={fb?.kind === "err" ? "red" : "cyan"}
                />
                <Button
                  size="sm"
                  variant="cyan"
                  disabled={(otp[t.taskId]?.length ?? 0) < 4 || submitting === t.taskId}
                  onClick={() => submitOtp(t.taskId)}
                >
                  {submitting === t.taskId ? "Checking…" : "Submit code"}
                </Button>
              </>
            )}
            {fb && (
              <p className={cn("text-sm", fb.kind === "ok" ? "text-green" : "text-red")}>{fb.msg}</p>
            )}
          </Panel>
        );
      })}

      {state.ownStatus === "ALIVE" && (
        <Button variant="danger" className="mt-2" onClick={() => setConfirmMeeting(true)}>
          🚨 Call emergency meeting
        </Button>
      )}
      <ConfirmModal
        open={confirmMeeting}
        onClose={() => setConfirmMeeting(false)}
        onConfirm={() => call("/api/game/meetings/call?as=PARTICIPANT", { emergency: true, reason: "Emergency meeting" })}
        title="Call an emergency meeting?"
        body="This stops the round for everyone and starts a discussion. Use it when you have something to say."
        confirmLabel="Call it"
        danger
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MeetingView({
  state,
  chat,
  meetingId,
  call,
  refreshChat,
}: {
  state: ParticipantState;
  chat: ChatMsg[];
  meetingId: string;
  call: CallFn;
  refreshChat: (mid: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [voted, setVoted] = useState(false);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const alive = state.ownStatus === "ALIVE";
  const voting = state.meetingStatus === "VOTING";
  const roster = (state.meetingRoster ?? []).filter((p) => p.id !== state.identity.id);

  const send = async () => {
    if (!draft.trim() || !meetingId) return;
    const res = await fetch("/api/game/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, message: draft.trim() }),
    });
    if (res.ok) setDraft("");
    refreshChat(meetingId);
  };

  const castVote = async () => {
    const r = await call("/api/game/votes/cast", {
      meetingId,
      targetParticipantId: pending ?? null,
    });
    if (r.ok) setVoted(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <MeetingBanner status={state.meetingStatus ?? "ACTIVE"} />

      {voting && alive && !voted && (
        <Panel className="flex flex-col gap-3">
          <h3 className="font-display text-lg">Who&apos;s sus?</h3>
          <div className="grid grid-cols-3 gap-2">
            {roster.map((p) => {
              const dead = p.status !== "ALIVE";
              const sel = pending === p.id;
              return (
                <button
                  key={p.id}
                  disabled={dead}
                  onClick={() => setPending(sel ? undefined : p.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-chunky border-[3px] p-2 transition-colors",
                    sel ? "border-red bg-red/15" : "border-line-strong bg-panel",
                    dead && "opacity-35",
                  )}
                >
                  <PlayerAvatar id={p.id} size={40} dead={dead} />
                  <span className="truncate text-xs font-bold">
                    {p.playerNumber ? `#${String(p.playerNumber).padStart(2, "0")} ` : ""}
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPending(pending === null ? undefined : null)}
            className={cn(
              "rounded-pill border-[3px] px-4 py-2 font-display text-sm uppercase",
              pending === null ? "border-yellow bg-yellow/15 text-yellow" : "border-line-strong",
            )}
          >
            Skip vote
          </button>
          <Button variant="danger" disabled={pending === undefined} onClick={castVote}>
            Lock in vote
          </Button>
        </Panel>
      )}
      {voting && voted && (
        <Panel tone="flat" className="text-center text-fg-dim">
          Your vote is locked in. Waiting for everyone else…
        </Panel>
      )}
      {voting && !alive && (
        <Panel tone="flat" className="text-center text-fg-faint">
          Ghosts don&apos;t vote. Watch it play out.
        </Panel>
      )}

      <Panel className="flex flex-col gap-2">
        <h3 className="font-display text-lg">Discussion</h3>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {chat.length === 0 && <p className="text-sm text-fg-faint">No messages yet.</p>}
          {chat.map((m) => (
            <p key={m.id} className="text-sm">
              <span
                className="font-display font-semibold"
                style={{ color: "var(--color-fg)" }}
              >
                {m.senderName}:
              </span>{" "}
              <span className="text-fg-dim">{m.message}</span>
            </p>
          ))}
        </div>
        {alive ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Say something…"
              maxLength={280}
              className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 text-sm outline-none focus:border-cyan"
            />
            <Button size="sm" type="submit" disabled={!draft.trim()}>
              Send
            </Button>
          </form>
        ) : (
          <p className="text-xs text-fg-faint">Read-only — you were eliminated.</p>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GhostView({ state, disqualified }: { state: ParticipantState; disqualified?: boolean }) {
  const feed: FeedEvent[] = state.notifications
    .filter((n) => n.type !== "YOUR_ROLE_ASSIGNED")
    .map((n) => ({ id: n.id, type: n.type, payload: n.payload, createdAt: n.createdAt }));

  return (
    <div className="flex flex-col gap-4">
      <Panel tone="danger" className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-5xl">{disqualified ? "🚫" : "👻"}</p>
        <h2 className="text-2xl text-red">
          {disqualified ? "You were removed from the game" : "You were eliminated"}
        </h2>
        <p className="text-fg-dim">
          {disqualified
            ? "The host took you out of this game. Talk to them if you think that's a mistake."
            : `You were ${state.ownRole === "IMPOSTER" ? "an Imposter" : "an Engineer"}. Keep watching — no talking to the living.`}
        </p>
      </Panel>
      <TaskProgress {...state.ownProgress} />
      <Panel tone="flat">
        <h3 className="mb-2 font-display text-lg">What&apos;s happening</h3>
        <EventFeed events={feed} limit={12} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ImpostorKillPanel({ state, call }: { state: ParticipantState; call: CallFn }) {
  const [weaponCode, setWeaponCode] = useState("");
  const [weaponBusy, setWeaponBusy] = useState(false);
  const [weaponMsg, setWeaponMsg] = useState<string | null>(null);

  const [targetNum, setTargetNum] = useState("");
  const [killBusy, setKillBusy] = useState(false);
  const [killMsg, setKillMsg] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const lastKillMs = state.lastKillAt ? new Date(state.lastKillAt).getTime() : 0;
  const cooldownMs = (state.killCooldownSeconds ?? 60) * 1000;
  const now = Date.now();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((cooldownMs - (now - lastKillMs)) / 1000)),
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const unlockWeapon = async () => {
    if (!weaponCode.trim()) return;
    setWeaponBusy(true);
    setWeaponMsg(null);
    try {
      const res = await call("/api/game/eliminations/unlock-weapon", { qrCode: weaponCode.trim() });
      if (!res.ok) setWeaponMsg(String(res.body.message ?? "Invalid weapon code"));
    } finally {
      setWeaponBusy(false);
    }
  };

  const executeKill = async () => {
    const num = parseInt(targetNum.trim(), 10);
    if (isNaN(num)) return;
    setKillBusy(true);
    setKillMsg(null);
    try {
      const res = await call("/api/game/eliminations/kill-number", { targetPlayerNumber: num });
      if (res.ok) {
        setKillMsg({ kind: "ok", msg: `Player #${num} eliminated!` });
        setTargetNum("");
        setSecondsLeft(state.killCooldownSeconds ?? 60);
      } else {
        setKillMsg({ kind: "err", msg: String(res.body.message ?? "Elimination failed") });
      }
    } finally {
      setKillBusy(false);
    }
  };

  if (!state.weaponUnlocked) {
    return (
      <Panel tone="danger" className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold text-red uppercase tracking-wider">🗡️ Find Your Murder Weapon</h3>
        <p className="text-xs text-fg-dim">
          You must find the physical murder weapon hidden in the venue before you can eliminate players.
        </p>
        {state.weaponClue && (
          <div className="rounded-chunky bg-void/60 p-3 text-xs border border-red/30">
            <span className="font-bold text-yellow uppercase">Weapon Clue:</span> {state.weaponClue}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={weaponCode}
            onChange={(e) => setWeaponCode(e.target.value.toUpperCase())}
            placeholder="Scan or enter weapon code"
            className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-3 py-2 text-sm font-mono uppercase text-fg outline-none focus:border-red"
          />
          <Button size="sm" variant="danger" disabled={weaponBusy || !weaponCode.trim()} onClick={unlockWeapon}>
            {weaponBusy ? "Checking…" : "Unlock"}
          </Button>
        </div>
        {weaponMsg && <p className="text-xs text-red">{weaponMsg}</p>}
      </Panel>
    );
  }

  return (
    <Panel tone="danger" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-red uppercase tracking-wider">🗡️ Impostor Kill Pad</h3>
        {secondsLeft > 0 ? (
          <span className="rounded-full bg-red/20 px-3 py-1 font-mono text-xs text-red font-bold animate-pulse">
            Cooldown: {secondsLeft}s
          </span>
        ) : (
          <span className="rounded-full bg-green/20 px-3 py-1 font-mono text-xs text-green font-bold">
            READY TO KILL
          </span>
        )}
      </div>

      <p className="text-xs text-fg-dim">
        Tag your target in real life, then enter their wearable <strong>Player Number</strong> (e.g. 14) below to trigger their elimination.
      </p>

      <div className="flex gap-2">
        <input
          type="number"
          value={targetNum}
          onChange={(e) => setTargetNum(e.target.value)}
          placeholder="Player #"
          disabled={secondsLeft > 0 || killBusy}
          className="w-28 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 text-center font-display text-xl text-fg outline-none focus:border-red disabled:opacity-40"
        />
        <Button
          size="lg"
          variant="danger"
          block
          disabled={secondsLeft > 0 || killBusy || !targetNum.trim()}
          onClick={executeKill}
        >
          {killBusy ? "Eliminating…" : secondsLeft > 0 ? `Wait ${secondsLeft}s` : "ELIMINATE PLAYER"}
        </Button>
      </div>

      {killMsg && (
        <p className={cn("text-xs font-bold", killMsg.kind === "ok" ? "text-green" : "text-red")}>
          {killMsg.msg}
        </p>
      )}
    </Panel>
  );
}

