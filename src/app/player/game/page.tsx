"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";
import { IsaHeader } from "@/components/ui/IsaHeader";

interface ParticipantState {
  identity: {
    id: string;
    name: string;
    code: string;
    playerNumber?: number | null;
  };
  ownRole: "ENGINEER" | "IMPOSTER" | null;
  ownStatus: string;
  game: {
    status: string;
    roomCode?: string | null;
    currentRoundNumber: number;
    currentPhase: string | null;
  };
  ownTasks: Array<{
    taskId: string;
    title: string;
    difficulty: string;
    points: number;
    status: string;
  }>;
  ownProgress: {
    completed: number;
    inPlay: number;
    percentage: number;
  };
  weaponLocation?: string | null;
  weaponClue?: string | null;
  lastKillAt?: string | null;
  killCooldownSeconds?: number;
  meetingStatus: string | null;
  meetingRoster: Array<{
    id: string;
    name: string;
    playerNumber?: number | null;
    status: string;
  }> | null;
}

export default function PlayerGameConsolePage() {
  const router = useRouter();
  const [state, setState] = useState<ParticipantState | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpTaskId, setOtpTaskId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedVictimId, setSelectedVictimId] = useState<string>("");
  const [votedParticipantId, setVotedParticipantId] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/game/state?as=PARTICIPANT", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/player");
        }
        return;
      }
      const data = await res.json();
      setState(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const onEvent = useCallback(() => void refresh(), [refresh]);
  useGameRealtime({ enabled: true, as: "PARTICIPANT", onEvent });

  // Kill cooldown tick down for impostor
  useEffect(() => {
    if (!state || state.ownRole !== "IMPOSTER") return;
    const cooldownTotal = state.killCooldownSeconds || 60;
    const lastKill = state.lastKillAt ? new Date(state.lastKillAt).getTime() : 0;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - lastKill) / 1000);
      const rem = Math.max(0, cooldownTotal - elapsed);
      setCooldownRemaining(rem);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state?.lastKillAt, state?.killCooldownSeconds, state?.ownRole]);

  const notify = (text: string, kind: "ok" | "err" = "ok") => {
    setActionMsg({ kind, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleCompleteTaskOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpTaskId || !otpValue.trim()) return;

    setActionBusy(true);
    try {
      const res = await fetch("/api/game/tasks/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: otpTaskId, otp: otpValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP code.");
      notify("Task verified and completed!");
      setOtpTaskId(null);
      setOtpValue("");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to verify task", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleEliminate = async () => {
    if (!selectedVictimId) {
      notify("Select a victim player number", "err");
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/eliminations/eliminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetParticipantId: selectedVictimId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Elimination failed.");
      notify("Elimination confirmed!");
      setSelectedVictimId("");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Elimination failed", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCallMeeting = async () => {
    if (!confirm("Are you sure you want to call an Emergency Meeting?")) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/meetings/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMERGENCY" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to call meeting.");
      notify("Emergency meeting triggered!");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCastVote = async (targetId: string | null) => {
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/votes/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetParticipantId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cast vote.");
      setVotedParticipantId(targetId || "SKIP");
      notify("Vote recorded!");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to vote", "err");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <p className="text-zinc-500 animate-pulse text-sm">Connecting to Game Stream...</p>
      </div>
    );
  }

  const isLobby = state?.game.status === "SETUP" || state?.game.status === "READY";
  const isMeeting = state?.game.status === "MEETING";
  const isVoting = state?.game.status === "VOTING";
  const isFinished = state?.game.status === "FINISHED";
  const isEliminated = state?.ownStatus === "ELIMINATED";

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Header HUD */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl sm:text-2xl font-black text-yellow-400 bg-yellow-950/60 border border-yellow-500/40 px-2.5 py-0.5 rounded-lg">
              #{state?.identity.playerNumber ? String(state.identity.playerNumber).padStart(2, "0") : "--"}
            </span>
            <div>
              <div className="font-bold text-white text-base leading-tight truncate max-w-[150px]">
                {state?.identity.name}
              </div>
              <div className="text-[10px] font-mono text-zinc-400">
                ROOM: <span className="text-red-400 font-bold">{state?.game.roomCode || "ARENA"}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border block ${
                isEliminated
                  ? "bg-zinc-900 text-zinc-500 border-zinc-800 line-through"
                  : state?.ownRole === "IMPOSTER"
                  ? "bg-red-950 text-red-400 border-red-500/40"
                  : state?.ownRole === "ENGINEER"
                  ? "bg-cyan-950 text-cyan-400 border-cyan-500/40"
                  : "bg-zinc-900 text-zinc-400 border-zinc-700"
              }`}
            >
              {isEliminated ? "ELIMINATED" : state?.ownRole || "LOBBY"}
            </span>
            <span className="text-[9px] font-mono text-zinc-500 mt-1 block">
              STATUS: {state?.game.status}
            </span>
          </div>
        </div>

        {actionMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono ${
              actionMsg.kind === "ok"
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/80 border-red-500/40 text-red-200"
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 1: WAITING LOBBY                                        */}
        {/* ------------------------------------------------------------- */}
        {isLobby && (
          <div className="rounded-2xl border border-red-500/30 bg-zinc-950 p-6 sm:p-8 space-y-6 text-center shadow-2xl">
            <span className="text-[10px] font-mono tracking-widest uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-3 py-1 rounded inline-block">
              WAITING LOBBY
            </span>

            <div>
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                ROOM CODE
              </div>
              <div className="font-mono text-5xl font-black text-red-500 tracking-widest mt-1">
                {state?.game.roomCode || "ACTIVE"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                YOU ARE CONNECTED
              </div>
              <div className="text-zinc-400">
                Assigned Badge: <span className="text-white font-bold">#{String(state?.identity.playerNumber).padStart(2, "0")}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm text-zinc-300 font-medium">Waiting for Host</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                The ISA game host will launch the round once all players are assembled. Your secret role will be transmitted immediately.
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-800/80">
              <Link
                href="/player"
                className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← Return to Player Home
              </Link>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 2: ROLE REVEAL & LIVE GAME                              */}
        {/* ------------------------------------------------------------- */}
        {!isLobby && !isMeeting && !isVoting && !isFinished && (
          <div className="space-y-5">
            {/* Secret Role Card */}
            <div
              className={`rounded-2xl border p-5 sm:p-6 space-y-3 shadow-xl ${
                state?.ownRole === "IMPOSTER"
                  ? "border-red-500/40 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950/40"
                  : "border-cyan-500/40 bg-gradient-to-br from-zinc-950 via-zinc-950 to-cyan-950/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-400">
                  CLASSIFIED ASSIGNMENT
                </span>
                <span
                  className={`text-xs font-black font-mono tracking-widest uppercase px-2 py-0.5 rounded border ${
                    state?.ownRole === "IMPOSTER"
                      ? "bg-red-950 text-red-400 border-red-500/40"
                      : "bg-cyan-950 text-cyan-400 border-cyan-500/40"
                  }`}
                >
                  {state?.ownRole}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                  {state?.ownRole === "IMPOSTER" ? "Deceive & Eliminate" : "Complete Physical Tasks"}
                </h2>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  {state?.ownRole === "IMPOSTER"
                    ? "Eliminate engineers covertly. Avoid suspicion. Fake assigned tasks."
                    : "Visit campus stations and enter the OTP codes provided by station staff."}
                </p>
              </div>

              {state?.ownRole === "IMPOSTER" && state.weaponLocation && (
                <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-mono text-red-200 space-y-1">
                  <div className="font-bold text-red-300 uppercase text-[10px]">
                    THEATRICAL PROP WEAPON LOCATION:
                  </div>
                  <div>{state.weaponLocation}</div>
                  {state.weaponClue && (
                    <div className="text-[10px] text-red-300/80 italic">Clue: {state.weaponClue}</div>
                  )}
                </div>
              )}
            </div>

            {/* IMPOSTOR CONTROLS */}
            {state?.ownRole === "IMPOSTER" && !isEliminated && (
              <div className="rounded-2xl border border-red-500/30 bg-zinc-950 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase font-mono text-red-400">
                    Elimination Control
                  </h3>
                  <span className="text-xs font-mono font-bold text-zinc-300">
                    Cooldown: {cooldownRemaining > 0 ? `${cooldownRemaining}s` : "READY"}
                  </span>
                </div>

                <div className="space-y-3">
                  <select
                    value={selectedVictimId}
                    onChange={(e) => setSelectedVictimId(e.target.value)}
                    disabled={cooldownRemaining > 0}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-mono focus:outline-none focus:border-red-500"
                  >
                    <option value="">-- Select Victim Badge # --</option>
                    {state.meetingRoster
                      ?.filter((p) => p.status === "ALIVE" && p.id !== state.identity.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--"} {p.name}
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={handleEliminate}
                    disabled={cooldownRemaining > 0 || !selectedVictimId || actionBusy}
                    className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/60"
                  >
                    {cooldownRemaining > 0 ? `Recharging (${cooldownRemaining}s)` : "Confirm Elimination"}
                  </button>
                </div>
              </div>
            )}

            {/* ENGINEER TASK LIST */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase font-mono text-white">
                    Assigned Tasks ({state?.ownProgress.completed} / {state?.ownTasks.length})
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Staff at each station will provide the verification OTP.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {state?.ownProgress.percentage}% Done
                </span>
              </div>

              <div className="space-y-2.5">
                {state?.ownTasks.map((t) => {
                  const isCompleted = t.status === "COMPLETED";
                  return (
                    <div
                      key={t.taskId}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        isCompleted
                          ? "bg-zinc-900/40 border-zinc-850 opacity-60"
                          : "bg-zinc-900 border-zinc-800"
                      }`}
                    >
                      <div className="pr-2">
                        <div className={`font-semibold ${isCompleted ? "line-through text-zinc-400" : "text-white"}`}>
                          {t.title}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          {t.points} Points • {t.difficulty}
                        </div>
                      </div>

                      {isCompleted ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                          COMPLETED
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setOtpTaskId(t.taskId);
                            setOtpValue("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[11px] font-bold uppercase transition-colors shrink-0"
                        >
                          Enter OTP
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Emergency Meeting Trigger */}
            {!isEliminated && (
              <button
                onClick={handleCallMeeting}
                disabled={actionBusy}
                className="w-full py-3.5 px-4 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/40"
              >
                Call Emergency Meeting
              </button>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 3: EMERGENCY MEETING & VOTING                           */}
        {/* ------------------------------------------------------------- */}
        {(isMeeting || isVoting) && (
          <div className="rounded-2xl border border-red-500/50 bg-zinc-950 p-6 space-y-6 shadow-2xl text-center">
            <div className="inline-block p-3 rounded-full bg-red-950 border border-red-500 animate-pulse">
              <span className="font-mono text-xs font-black uppercase text-red-400">
                🚨 EMERGENCY ALARM
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                {isVoting ? "Voting Floor Open" : "Emergency Discussion"}
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                {isVoting
                  ? "Select an agent to eject from campus or choose to skip."
                  : "Discuss who is acting suspicious. Accuse and defend."}
              </p>
            </div>

            {isVoting && !isEliminated && (
              <div className="space-y-3 pt-2 text-left">
                <span className="text-[10px] font-mono uppercase text-zinc-400 block text-center">
                  CONFIDENTIAL VOTE
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {state?.meetingRoster
                    ?.filter((p) => p.status === "ALIVE")
                    .map((p) => {
                      const isMe = p.id === state.identity.id;
                      const hasVotedThis = votedParticipantId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleCastVote(p.id)}
                          disabled={actionBusy || Boolean(votedParticipantId)}
                          className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                            hasVotedThis
                              ? "bg-red-950/80 border-red-500 text-white font-bold"
                              : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-red-500/50"
                          }`}
                        >
                          <span>#{p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--"} {p.name}</span>
                          {isMe && <span className="text-[9px] text-zinc-500">(You)</span>}
                        </button>
                      );
                    })}
                </div>

                <button
                  onClick={() => handleCastVote(null)}
                  disabled={actionBusy || Boolean(votedParticipantId)}
                  className={`w-full py-2.5 rounded-xl border font-mono text-xs uppercase tracking-wider transition-colors ${
                    votedParticipantId === "SKIP"
                      ? "bg-zinc-800 border-zinc-500 text-white font-bold"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {votedParticipantId === "SKIP" ? "Vote Cast: Skipped" : "Skip Vote"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 4: GAME OVER                                            */}
        {/* ------------------------------------------------------------- */}
        {isFinished && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-6 text-center shadow-2xl">
            <span className="text-[10px] font-mono tracking-widest uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-3 py-1 rounded inline-block">
              MATCH CONCLUDED
            </span>

            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              Game Over
            </h2>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              The round has ended. Review final statistics on the arena screen and return to your player home to enter the next match.
            </p>

            <Link
              href="/player"
              className="block w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 text-center"
            >
              Return to Player Home
            </Link>
          </div>
        )}

        {/* Modal: Task OTP Input */}
        {otpTaskId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white uppercase font-mono">
                Verify Task Completion
              </h3>
              <p className="text-xs text-zinc-400">
                Ask the ISA station supervisor for the 4-digit verification code.
              </p>

              <form onSubmit={handleCompleteTaskOtp} className="space-y-4">
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.trim())}
                  placeholder="Enter OTP"
                  className="w-full px-3 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 font-mono text-center text-xl font-bold tracking-widest focus:outline-none focus:border-cyan-500"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpTaskId(null);
                      setOtpValue("");
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-950/50"
                  >
                    {actionBusy ? "Verifying..." : "Verify Task"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
