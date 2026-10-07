"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";
import { IsaHeader } from "@/components/ui/IsaHeader";
import { MeetingChat } from "@/components/game/MeetingChat";
import { ReactorCircuitTask } from "@/components/game/tasks/ReactorCircuitTask";
import { O2PressureTask } from "@/components/game/tasks/O2PressureTask";
import { CommsSpectralTask } from "@/components/game/tasks/CommsSpectralTask";
import { ShieldsTask } from "@/components/game/tasks/ShieldsTask";
import { WiresTask } from "@/components/game/tasks/WiresTask";
import { EngineCalibrationTask } from "@/components/game/tasks/EngineCalibrationTask";
import { ThrusterMatrixTask } from "@/components/game/tasks/ThrusterMatrixTask";
import { DnaSequenceTask } from "@/components/game/tasks/DnaSequenceTask";
import { ChemicalCentrifugeTask } from "@/components/game/tasks/ChemicalCentrifugeTask";
import { TelescopeLockTask } from "@/components/game/tasks/TelescopeLockTask";
import { BreakerGridTask } from "@/components/game/tasks/BreakerGridTask";
import { VoltageRegulatorTask } from "@/components/game/tasks/VoltageRegulatorTask";
import { HydroPipeTask } from "@/components/game/tasks/HydroPipeTask";
import { FilterDecontamTask } from "@/components/game/tasks/FilterDecontamTask";

interface ParticipantState {
  identity: {
    id: string;
    name: string;
    code: string;
    playerNumber?: number | null;
    badge?: string | null;
    profession?: string;
  };
  ownRole: "ENGINEER" | "IMPOSTER" | null;
  ownStatus: string;
  partnerImpostors?: Array<{
    id: string;
    name: string;
    badge?: string | null;
    playerNumber?: number | null;
    status: string;
  }>;
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
  activeMeeting?: {
    id: string;
    status: string;
    type: string;
    phase: "DISCUSSION" | "VOTING" | "REVEAL";
    secondsRemaining: number;
    discussionDurationSeconds: number;
    votingDurationSeconds: number;
    reason: string | null;
    calledByName: string | null;
    votes: Array<{
      id: string;
      voterId: string;
      voterName: string;
      voterBadge: string | null;
      targetId: string | null;
      targetName: string | null;
      targetBadge: string | null;
      isSkip: boolean;
    }>;
  } | null;
  meetingRoster: Array<{
    id: string;
    name: string;
    playerNumber?: number | null;
    badge?: string | null;
    status: string;
  }> | null;
  finalResult?: {
    winner: string;
    reason: string;
    championName: string | null;
    championBadge: string | null;
  } | null;
}

export default function PlayerGameConsolePage() {
  const router = useRouter();
  const [state, setState] = useState<ParticipantState | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpTaskId, setOtpTaskId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [activePlayTask, setActivePlayTask] = useState<{ taskId: string; title: string; points: number } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [targetBadgeInput, setTargetBadgeInput] = useState("");
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [votedParticipantId, setVotedParticipantId] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [showKillAnimation, setShowKillAnimation] = useState(false);
  const prevGameStatusRef = useRef<string | null>(null);

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
      const newStatus = data?.game?.status;
      const wasLobby = prevGameStatusRef.current === "SETUP" || prevGameStatusRef.current === "READY";
      const nowLive = newStatus && newStatus !== "SETUP" && newStatus !== "READY";
      if (wasLobby && nowLive && data?.ownRole) {
        setShowRoleReveal(true);
      }
      prevGameStatusRef.current = newStatus;
      setState(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 2500);
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

  const handleMiniGameCompleted = async (taskId: string) => {
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, solved: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit task completion");
      notify(`Objective Complete! +${data.points || 15} Points`);
      setActivePlayTask(null);
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Task completion failed", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleEliminateByBadge = async () => {
    const rawBadge = targetBadgeInput.trim().toUpperCase().replace(/^#/, "");
    if (!rawBadge) {
      notify("Enter target badge ID", "err");
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/actions/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetBadge: rawBadge }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Action failed.");

      // Trigger dramatic kill animation
      setShowKillAnimation(true);
      setTimeout(() => setShowKillAnimation(false), 2000);

      notify(`Target #${rawBadge} eliminated!`);
      setTargetBadgeInput("");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Action failed", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSolvePuzzle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puzzleAnswer.trim()) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: puzzleAnswer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Incorrect sequence answer.");
      notify(data.message || "Sequence accepted! +10 Points awarded.");
      setPuzzleAnswer("");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Verification failed", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCallMeeting = async () => {
    if (state?.ownStatus === "ELIMINATED") {
      notify("Dead players cannot call an emergency meeting.", "err");
      return;
    }
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
    if (state?.ownStatus === "ELIMINATED") {
      notify("Dead players cannot vote.", "err");
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch("/api/game/votes/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: state?.activeMeeting?.id,
          targetParticipantId: targetId,
        }),
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

  const displayBadge = state?.identity.badge || (state?.identity.playerNumber ? String(state.identity.playerNumber).padStart(2, "0") : "--");
  const overrideTask = state?.ownTasks?.find((t) => t.title === "SYSTEM OVERRIDE");
  const isOverrideDone = overrideTask?.status === "COMPLETED";

  // Alive crewmates available for impostor targeting (excludes self & partner impostors)
  const targetableCrewmates = state?.meetingRoster?.filter((p) => {
    if (p.status !== "ALIVE") return false;
    if (p.id === state.identity.id) return false;
    if (state.partnerImpostors?.some((pi) => pi.id === p.id)) return false;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30 relative">
      <IsaHeader />

      {/* KILL SLASH ANIMATION OVERLAY */}
      {showKillAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FF3B5C]/10/90 pointer-events-none animate-in fade-in zoom-in duration-150">
          <div className="relative text-center">
            <div className="text-6xl sm:text-8xl font-black text-[#FF3B5C] tracking-tighter drop-shadow-[0_0_50px_rgba(239,68,68,1)]">
              KILL CONFIRMED
            </div>
            <div className="w-full h-1 bg-white shadow-[0_0_20px_white] transform -rotate-12 mt-4" />
          </div>
        </div>
      )}

      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Header HUD */}
        <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-4 sm:p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg sm:text-xl font-black text-yellow-400 bg-yellow-950/40 border border-yellow-500/30 px-2.5 py-1 rounded-lg">
              #{displayBadge}
            </span>
            <div>
              <div className="font-bold text-white text-sm sm:text-base leading-tight truncate max-w-[150px]">
                {state?.identity.name}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                <span>ROOM: <span className="text-[#FF3B5C] font-bold">{state?.game.roomCode || "ARENA"}</span></span>
                {state?.identity.profession && (
                  <span className="px-1.5 py-0.2 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 text-[9px] font-bold">
                    {state.identity.profession}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border block ${
                isEliminated
                  ? "bg-[#FF3B5C]/10 text-[#FF3B5C] border-[#FF3B5C]/30"
                  : isLobby
                  ? "bg-black/50 text-zinc-400 border-white/[0.08]"
                  : "bg-black/50 text-zinc-300 border-white/[0.08]"
              }`}
            >
              {isEliminated
                ? "GHOST (ELIMINATED)"
                : isLobby
                ? "WAITING LOBBY"
                : "ACTIVE OPERATIVE"}
            </span>
            <span className="text-[9px] font-mono text-zinc-500 mt-1 block uppercase">
              STATUS: {isLobby ? "WAITING FOR HOST" : isMeeting ? "MEETING" : isVoting ? "VOTING" : isFinished ? "GAME OVER" : "GAME LIVE"}
            </span>
          </div>
        </div>

        {/* ELIMINATED NOTICE OVERLAY BANNER */}
        {isEliminated && !isLobby && (
          <div className="p-4 rounded-2xl bg-[#FF3B5C]/5 border border-[#FF3B5C]/30 text-center space-y-1.5 shadow-xl">
            <div className="text-2xl">💀</div>
            <div className="font-mono text-xs font-black text-[#FF3B5C] uppercase tracking-widest">
              YOU WERE ELIMINATED
            </div>
            <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
              You are now in Ghost mode. You cannot call emergency meetings, speak in chat, or cast votes. You can still complete tasks, but you will not earn individual points.
            </p>
          </div>
        )}

        {actionMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono ${
              actionMsg.kind === "ok"
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                : "bg-[#FF3B5C]/10 border-[#FF3B5C]/30 text-red-200"
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* ROLE REVEAL CONFIDENTIAL MODAL                                */}
        {/* ------------------------------------------------------------- */}
        {showRoleReveal && state?.ownRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[40px] animate-in fade-in zoom-in duration-300">
            <div
              className={`w-full max-w-sm rounded-[2.5rem] border border-white/[0.1] p-8 text-center space-y-6 shadow-2xl ${
                state.ownRole === "IMPOSTER"
                  ? "border-red-500 bg-[#12121A]/60 backdrop-blur-[30px] shadow-[0_0_100px_rgba(255,59,92,0.4)]"
                  : "border-cyan-500 bg-[#12121A]/60 backdrop-blur-[30px] shadow-[0_0_100px_rgba(0,240,255,0.4)]"
              }`}
            >
              <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-400 block">
                CONFIDENTIAL DOSSIER
              </span>

              <div className="space-y-2">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                  YOUR SECRET ROLE
                </div>
                <div
                  className={`font-mono text-4xl sm:text-5xl font-black tracking-widest ${
                    state.ownRole === "IMPOSTER" ? "text-[#FF3B5C] drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]" : "text-[#00F0FF] drop-shadow-[0_0_20px_rgba(6,182,212,0.7)]"
                  }`}
                >
                  {state.ownRole}
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                {state.ownRole === "IMPOSTER"
                  ? "Infiltrate the crew. Target players discreetly using their badge ID. Blend in with normal tasks. Do not target your fellow impostors."
                  : "Complete physical campus station tasks. Report suspicious players. Vote out impostors during meetings."}
              </p>

              <button
                onClick={() => setShowRoleReveal(false)}
                className={`w-full py-3 rounded-xl font-mono text-xs font-black uppercase tracking-wider text-white shadow-xl transition-all ${
                  state.ownRole === "IMPOSTER"
                    ? "bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] shadow-red-900/50"
                    : "bg-[#00F0FF] hover:bg-white text-[#0B0B0F] shadow-cyan-900/50"
                }`}
              >
                Enter Arena Console →
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 1: WAITING LOBBY                                        */}
        {/* ------------------------------------------------------------- */}
        {isLobby && (
          <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-6 sm:p-8 space-y-6 text-center shadow-2xl">
            <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-400 bg-black/50 border border-white/[0.08] px-3 py-1 rounded inline-block">
              WAITING LOBBY
            </span>

            <div>
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                ROOM CODE
              </div>
              <div className="font-mono text-5xl font-black text-[#FF3B5C] tracking-widest mt-1">
                {state?.game.roomCode || "ACTIVE"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/50/80 border border-white/[0.08] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                YOU ARE CONNECTED
              </div>
              <div className="text-zinc-400">
                Player Badge: <span className="text-white font-bold">#{displayBadge}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm text-zinc-200 font-bold">Waiting for Host</p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                The host will start the game when everyone is ready. Your secret role will be revealed when the match begins.
              </p>
            </div>

            <div className="pt-4 border-t border-white/[0.08]/80">
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
        {/* STATE 2: LIVE GAME CONSOLE (Visually Neutral Layout)           */}
        {/* ------------------------------------------------------------- */}
        {!isLobby && !isMeeting && !isVoting && !isFinished && (
          <div className="space-y-5">
            {/* Objective Directive Card */}
            <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-5 space-y-2 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">
                  MISSION DIRECTIVE
                </span>
                <button
                  onClick={() => setShowRoleReveal(true)}
                  className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase underline"
                >
                  Secret Dossier
                </button>
              </div>

              <div>
                <h2 className="text-base font-black uppercase text-white tracking-tight">
                  Campus Station Operations
                </h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-mono">
                  Complete assigned objectives and solve campus overrides. Report anomalies during debriefings.
                </p>
              </div>
            </div>

            {/* PARTNER IMPOSTORS CARD (If Impostor) */}
            {state?.ownRole === "IMPOSTER" && state.partnerImpostors && state.partnerImpostors.length > 0 && (
              <div className="rounded-[2.5rem] border border-[#FF3B5C]/30 bg-[#12121A]/60 backdrop-blur-[30px] p-4 space-y-2.5 shadow-xl">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#FF3B5C] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  PARTNER IMPOSTOR(S)
                </span>
                <div className="space-y-1.5">
                  {state.partnerImpostors.map((p) => {
                    const b = p.badge || (p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--");
                    return (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-black/50 border border-white/[0.08] flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-white font-bold">#{b} {p.name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            p.status === "ALIVE"
                              ? "bg-[#FF3B5C]/10 text-red-300 border border-[#FF3B5C]/30"
                              : "bg-white/[0.04] text-zinc-500 line-through"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DISCREET IMPOSTOR ACTION CARD */}
            {state?.ownRole === "IMPOSTER" && !isEliminated && (
              <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-5 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase text-zinc-300 tracking-wider">
                    PLAYER ACTION
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {cooldownRemaining > 0 ? `Action available in ${cooldownRemaining}s` : "READY"}
                  </span>
                </div>

                {/* Quick Target Chips (Alive Crewmates) */}
                {targetableCrewmates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-zinc-500 block">
                      Target Alive Crewmate
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {targetableCrewmates.map((p) => {
                        const b = p.badge || (p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--");
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setTargetBadgeInput(b)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                              targetBadgeInput === b
                                ? "bg-[#FF3B5C] border-[#FF3B5C] text-[#0B0B0F] font-black"
                                : "bg-black/50 border-white/[0.08] text-zinc-300 hover:border-white/[0.08]"
                            }`}
                          >
                            #{b} {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Target Badge ID
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={targetBadgeInput}
                      onChange={(e) => setTargetBadgeInput(e.target.value.toUpperCase())}
                      disabled={cooldownRemaining > 0 || actionBusy}
                      placeholder="e.g. K7Q4"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/[0.08] text-white font-mono text-sm uppercase tracking-widest focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <button
                    onClick={handleEliminateByBadge}
                    disabled={cooldownRemaining > 0 || !targetBadgeInput.trim() || actionBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-40 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    {cooldownRemaining > 0 ? `Action available in ${cooldownRemaining}s` : "SUBMIT ACTION"}
                  </button>
                </div>
              </div>
            )}

            {/* TASK DIRECTORY & INTERACTIVE MINI-GAMES */}
            <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white">
                    Assigned Tasks ({state?.ownProgress.completed} / {state?.ownTasks.length})
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Play the interactive terminal simulator or enter physical station OTP.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-zinc-400">
                  {state?.ownProgress.percentage}% Done
                </span>
              </div>

              <div className="space-y-2.5">
                {state?.ownTasks?.map((t) => {
                  const isCompleted = t.status === "COMPLETED";
                  return (
                    <div
                      key={t.taskId}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors ${
                        isCompleted
                          ? "bg-black/50/40 border-zinc-850 opacity-60"
                          : "bg-black/50 border-white/[0.08]"
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
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded self-start sm:self-auto">
                          COMPLETED
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                          <button
                            onClick={() => setActivePlayTask(t)}
                            className="px-3 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-white text-[#0B0B0F] text-white font-mono text-[11px] font-bold uppercase transition-colors"
                          >
                            Play Mini-Game
                          </button>
                          <button
                            onClick={() => {
                              setOtpTaskId(t.taskId);
                              setOtpValue("");
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-mono text-[11px] font-bold uppercase transition-colors"
                          >
                            OTP
                          </button>
                        </div>
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
                className="w-full py-3 px-4 rounded-xl bg-black/50 hover:bg-zinc-850 border border-white/[0.08] text-zinc-300 font-mono text-xs font-bold uppercase tracking-wider transition-all"
              >
                Call Emergency Meeting
              </button>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 3: EMERGENCY MEETING & VOTING & CHAT                     */}
        {/* ------------------------------------------------------------- */}
        {(isMeeting || isVoting) && (
          <div className="rounded-[2.5rem] border border-[#FF3B5C]/30 bg-[#12121A]/60 backdrop-blur-[30px] p-5 sm:p-6 space-y-5 shadow-2xl text-center">
            <div className="inline-block p-2.5 rounded-full bg-[#FF3B5C]/10 border border-red-500 animate-pulse">
              <span className="font-mono text-xs font-black uppercase text-[#FF3B5C]">
                🚨 EMERGENCY ALARM ACTIVE
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                {state?.activeMeeting?.phase === "DISCUSSION"
                  ? "EMERGENCY DISCUSSION"
                  : state?.activeMeeting?.phase === "VOTING"
                  ? "VOTING FLOOR OPEN"
                  : "MEETING CONCLUDED"}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="font-mono text-lg font-black text-yellow-400 bg-yellow-950/60 border border-yellow-500/40 px-3 py-0.5 rounded-lg">
                  ⏱ {state?.activeMeeting?.secondsRemaining ?? 0}s
                </span>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  {state?.activeMeeting?.phase === "DISCUSSION" ? "30s Discussion Window" : "60s Voting Window"}
                </span>
              </div>
            </div>

            {/* REAL-TIME MEETING CHAT */}
            {state?.activeMeeting?.id && (
              <MeetingChat
                meetingId={state.activeMeeting.id}
                isAlive={!isEliminated}
                currentParticipantId={state.identity.id}
              />
            )}

            {/* PUBLIC LIVE VOTES FEED ("sabke votes visible honge") */}
            {state?.activeMeeting?.votes && state.activeMeeting.votes.length > 0 && (
              <div className="rounded-[2.5rem] border border-white/[0.08] bg-black/50/60 p-4 space-y-2 text-left">
                <div className="text-[11px] font-mono font-bold uppercase text-zinc-400 flex items-center justify-between">
                  <span>LIVE BALLOT FEED ({state.activeMeeting.votes.length} Votes Cast)</span>
                  <span className="text-emerald-400 text-[9px] animate-pulse">TRANSPARENT</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs font-mono">
                  {state.activeMeeting.votes.map((v) => (
                    <div
                      key={v.id}
                      className="p-1.5 rounded-lg bg-[#12121A]/60 backdrop-blur-[30px]/80 border border-white/[0.08] flex items-center justify-between"
                    >
                      <span className="text-white font-bold">
                        {v.voterBadge ? `#${v.voterBadge}` : ""} {v.voterName}
                      </span>
                      <span className="text-zinc-500 text-[10px]">→</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          v.isSkip
                            ? "bg-white/[0.04] text-zinc-400"
                            : "bg-[#FF3B5C]/10 text-red-300 border border-[#FF3B5C]/30"
                        }`}
                      >
                        {v.isSkip ? "SKIPPED" : `${v.targetBadge ? `#${v.targetBadge}` : ""} ${v.targetName}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VOTING BUTTONS (UNLOCKED DURING VOTING PHASE FOR ALIVE OPERATIVES) */}
            {state?.activeMeeting?.phase === "VOTING" && !isEliminated && (
              <div className="space-y-3 pt-1 text-left">
                <span className="text-[10px] font-mono uppercase text-zinc-400 block text-center font-bold">
                  CAST YOUR VOTE
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {state?.meetingRoster
                    ?.filter((p) => p.status === "ALIVE")
                    .map((p) => {
                      const isMe = p.id === state.identity.id;
                      const hasVotedThis = votedParticipantId === p.id;
                      const pBadge = p.badge || (p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--");
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleCastVote(p.id)}
                          disabled={actionBusy || Boolean(votedParticipantId)}
                          className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                            hasVotedThis
                              ? "bg-[#FF3B5C]/10 border-red-500 text-white font-bold"
                              : "bg-black/50 border-white/[0.08] text-zinc-200 hover:border-[#FF3B5C]/30"
                          }`}
                        >
                          <span>#{pBadge} {p.name}</span>
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
                      ? "bg-white/[0.04] border-zinc-500 text-white font-bold"
                      : "bg-black/50 border-white/[0.08] text-zinc-400 hover:text-white"
                  }`}
                >
                  {votedParticipantId === "SKIP" ? "Vote Cast: Skipped" : "Skip Vote"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 4: GAME OVER (EXACTLY ONE WINNER SPOTLIGHT)             */}
        {/* ------------------------------------------------------------- */}
        {isFinished && (
          <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-6 sm:p-8 space-y-6 text-center shadow-2xl">
            <span className="text-[10px] font-mono tracking-widest uppercase text-yellow-400 bg-yellow-950/60 border border-yellow-500/30 px-3 py-1 rounded inline-block">
              MATCH CONCLUDED
            </span>

            <div className="space-y-2">
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                WINNER
              </div>
              <div className="font-mono text-3xl sm:text-4xl font-black text-white tracking-wider">
                {state?.finalResult?.championBadge ? `#${state.finalResult.championBadge}` : ""}
                {state?.finalResult?.championName ? ` ${state.finalResult.championName}` : (state?.finalResult?.winner || "CHAMPION")}
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              {state?.finalResult?.reason || "The round has ended. Review final statistics and return to player home."}
            </p>

            <Link
              href="/player"
              className="block w-full py-3 px-4 rounded-xl bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 text-center"
            >
              Return to Player Home
            </Link>
          </div>
        )}

        {/* MODAL: INTERACTIVE MINI-GAME MODAL */}
        {activePlayTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-lg bg-[#12121A]/60 backdrop-blur-[30px] border border-white/[0.08] rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white uppercase font-mono">
                    {activePlayTask.title}
                  </h3>
                  <span className="text-[10px] font-mono text-[#00F0FF]">
                    +{activePlayTask.points} Points Objective
                  </span>
                </div>
                <button
                  onClick={() => setActivePlayTask(null)}
                  className="p-1.5 text-zinc-500 hover:text-white font-mono text-sm"
                >
                  ✕
                </button>
              </div>

              {/* RENDER SPECIFIC MINI-GAME COMPONENT */}
              {activePlayTask.title.includes("REACTOR") ? (
                <ReactorCircuitTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("CALIBRATE ENGINES") || activePlayTask.title.includes("ENGINE") ? (
                <EngineCalibrationTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("THRUSTER") ? (
                <ThrusterMatrixTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("DNA") ? (
                <DnaSequenceTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("CENTRIFUGE") || activePlayTask.title.includes("CHEMICAL") ? (
                <ChemicalCentrifugeTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("TELESCOPE") || activePlayTask.title.includes("PULSAR") ? (
                <TelescopeLockTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("COMMS") || activePlayTask.title.includes("SPECTRAL LOCK") ? (
                <CommsSpectralTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("BREAKER") ? (
                <BreakerGridTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("VOLTAGE") || activePlayTask.title.includes("REGULATOR") ? (
                <VoltageRegulatorTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("O2") || activePlayTask.title.includes("PRESSURE") ? (
                <O2PressureTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("HYDRO") || activePlayTask.title.includes("JUNCTION") ? (
                <HydroPipeTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("FILTER") || activePlayTask.title.includes("DECONTAM") ? (
                <FilterDecontamTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("SHIELD") ? (
                <ShieldsTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : activePlayTask.title.includes("WIRE") ? (
                <WiresTask
                  onSuccess={() => handleMiniGameCompleted(activePlayTask.taskId)}
                  onCancel={() => setActivePlayTask(null)}
                />
              ) : (
                /* Fallback for SYSTEM OVERRIDE */
                <div className="p-4 rounded-2xl bg-black/50 border border-white/[0.08] space-y-4 text-center">
                  <div className="font-mono text-xs text-zinc-400">
                    Solve sequence override: <span className="text-white font-bold">2, 4, 8, 16, ?</span>
                  </div>
                  <form onSubmit={handleSolvePuzzle} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={puzzleAnswer}
                      onChange={(e) => setPuzzleAnswer(e.target.value.trim())}
                      placeholder="Enter solution (e.g. 32)"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#12121A]/60 backdrop-blur-[30px] border border-white/[0.08] text-white font-mono text-center text-lg focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePlayTask(null)}
                        className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-mono text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionBusy || !puzzleAnswer.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-white text-[#0B0B0F] text-white font-mono text-xs font-bold uppercase"
                      >
                        Submit
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: TASK OTP INPUT */}
        {otpTaskId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#12121A]/60 backdrop-blur-[30px] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-2xl">
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
                  className="w-full px-3 py-3 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-500 font-mono text-center text-xl font-bold tracking-widest focus:outline-none focus:border-cyan-500"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpTaskId(null);
                      setOtpValue("");
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-black/50 hover:bg-white/[0.04] text-zinc-300 font-mono text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="flex-1 py-2.5 rounded-lg bg-[#00F0FF] hover:bg-white text-[#0B0B0F] text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-950/50"
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
