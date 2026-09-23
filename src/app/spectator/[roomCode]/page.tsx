"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";
import { QRCode } from "@/components/ui/QRCode";
import { IsaHeader } from "@/components/ui/IsaHeader";

interface ProjectorState {
  status: string;
  roomCode?: string | null;
  maxPlayers?: number;
  round: { number: number; name: string; msRemaining: number | null } | null;
  phase: string | null;
  globalProgress: { completed: number; inPlay: number; percentage: number };
  aliveCount: number;
  eliminatedCount: number;
  playerRoster?: Array<{ id: string; name: string; playerNumber?: number | null; status: string }>;
  meetingState: { status: string; type: string; calledBy?: string | null } | null;
  votingState: { isOpen: boolean; votesCastCount?: number; totalEligibleCount?: number } | null;
  eliminationReveal: { participantId: string; name: string; role: "ENGINEER" | "IMPOSTER" } | null;
  finalResult: {
    winner: string;
    reason: string;
    stats: unknown;
    declaredByHost: boolean;
    championName: string | null;
  } | null;
}

export default function SpectatorRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = use(params);
  const [state, setState] = useState<ProjectorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReveal, setShowReveal] = useState(false);
  const lastRevealId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      let res = await fetch("/api/game/state?as=SPECTATOR", { cache: "no-store" });
      let data = res.ok ? await res.json() : null;

      // If unauthorized OR bound to a different room code, rebind spectator session
      if (!res.ok || (data && data.roomCode !== roomCode)) {
        const bindRes = await fetch(`/api/spectator/session?roomCode=${encodeURIComponent(roomCode)}`);
        if (bindRes.ok) {
          const retry = await fetch("/api/game/state?as=SPECTATOR", { cache: "no-store" });
          if (retry.ok) data = await retry.json();
        }
      }
      if (data) setState(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    void refresh();
    const beat = setInterval(() => void refresh(), 4000);
    return () => clearInterval(beat);
  }, [refresh]);

  const onEvent = useCallback(() => void refresh(), [refresh]);
  useGameRealtime({ enabled: true, as: "SPECTATOR", onEvent });

  useEffect(() => {
    const r = state?.eliminationReveal;
    if (r && r.participantId !== lastRevealId.current) {
      lastRevealId.current = r.participantId;
      setShowReveal(true);
      const t = setTimeout(() => setShowReveal(false), 10000);
      return () => clearTimeout(t);
    }
  }, [state?.eliminationReveal]);

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join?room=${roomCode}` : `/join?room=${roomCode}`;

  const isLobby = state?.status === "SETUP" || state?.status === "READY";
  const isMeeting = state?.status === "MEETING";
  const isVoting = state?.status === "VOTING";
  const isFinished = state?.status === "FINISHED" || Boolean(state?.finalResult);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden relative">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(185,28,28,0.15),transparent_70%)] pointer-events-none" />

      {/* Top Banner */}
      <header className="relative z-10 flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-red-600 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-red-900/40">
            ISA
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-widest uppercase text-red-400 font-bold">
              INTERNATIONAL SOCIETY OF AUTOMATION — MANIPAL UNIVERSITY JAIPUR
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-100 uppercase">
              NOTHING SUS // LIVE ARENA BROADCAST
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono">
            ROOM: <span className="text-red-400 font-bold">{roomCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              {state?.status || "LIVE FEED"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Presentation Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-8">
        <AnimatePresence mode="wait">
          {/* STAGE 1: LOBBY & WAITING ROOM */}
          {isLobby && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center"
            >
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-mono tracking-widest uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-3 py-1 rounded">
                    JOIN ON YOUR MOBILE DEVICE
                  </span>
                  <h2 className="text-5xl sm:text-6xl font-black tracking-tighter text-white mt-4">
                    ROOM CODE
                  </h2>
                  <div className="font-mono text-6xl sm:text-7xl font-black text-red-500 tracking-widest mt-2 drop-shadow-[0_0_35px_rgba(239,68,68,0.5)]">
                    {roomCode}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-2">
                  <div className="text-xs font-mono text-zinc-400">1. Go to <span className="text-white font-bold">{typeof window !== "undefined" ? window.location.host : "nothing-sus-engine.vercel.app"}/join</span></div>
                  <div className="text-xs font-mono text-zinc-400">2. Log in with your <span className="text-white font-bold">College Reg ID</span></div>
                  <div className="text-xs font-mono text-zinc-400">3. Enter Room Code: <span className="text-red-400 font-bold">{roomCode}</span></div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-zinc-400">Connected Players:</span>
                  <span className="px-3 py-1 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 font-mono font-bold text-sm">
                    {state?.playerRoster?.length || 0} / {state?.maxPlayers || 30} Players Ready
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-2xl">
                <div className="p-4 bg-white rounded-2xl shadow-xl">
                  <QRCode value={joinUrl} size={240} />
                </div>
                <p className="text-xs font-mono text-zinc-400 mt-4 tracking-wider uppercase">
                  Scan QR with Camera to Join Instantly
                </p>
              </div>
            </motion.div>
          )}

          {/* STAGE 2: ELIMINATION REVEAL POPUP */}
          {showReveal && state?.eliminationReveal && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center space-y-6 max-w-2xl p-10 rounded-3xl border-2 border-red-500/40 bg-zinc-950/95 shadow-2xl shadow-red-950/80"
            >
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
                EJECTION TRANSMISSION
              </span>
              <h2 className="text-4xl sm:text-5xl font-black text-white">
                {state.eliminationReveal.name} was ejected.
              </h2>
              <div
                className={`text-3xl font-black font-mono tracking-wider ${
                  state.eliminationReveal.role === "IMPOSTER" ? "text-red-500" : "text-cyan-400"
                }`}
              >
                {state.eliminationReveal.role === "IMPOSTER"
                  ? "THEY WERE AN IMPOSTOR."
                  : "THEY WERE NOT AN IMPOSTOR."}
              </div>
            </motion.div>
          )}

          {/* STAGE 3: EMERGENCY MEETING / DISCUSSION */}
          {!showReveal && (isMeeting || isVoting) && (
            <motion.div
              key="meeting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8 max-w-3xl"
            >
              <div className="inline-block p-4 rounded-full bg-red-950/80 border-2 border-red-500 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                <span className="text-xs font-mono font-black uppercase tracking-widest text-red-400">
                  CRITICAL ALERT
                </span>
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-white uppercase tracking-tight">
                {isVoting ? "VOTING IN PROGRESS" : "EMERGENCY MEETING"}
              </h2>
              <p className="text-lg text-zinc-300 max-w-xl mx-auto">
                {isVoting
                  ? "All active players are casting confidential votes on their personal consoles."
                  : "Floor open for interrogation. Discuss who is sabotaging campus systems."}
              </p>
              {isVoting && state?.votingState && (
                <div className="font-mono text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-xl inline-block">
                  Votes Recorded: <span className="text-white font-bold">{state.votingState.votesCastCount || 0}</span> Cast
                </div>
              )}
            </motion.div>
          )}

          {/* STAGE 4: LIVE ROUND / TASKS MONITOR */}
          {!showReveal && !isLobby && !isMeeting && !isVoting && !isFinished && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-5xl space-y-10"
            >
              {/* Global Task Progress Bar */}
              <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-950/80 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono uppercase tracking-wider text-zinc-400">
                    Total Campus Tasks Completed
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {state?.globalProgress?.percentage || 0}%
                  </span>
                </div>
                <div className="w-full bg-zinc-900 h-6 rounded-full overflow-hidden p-1 border border-zinc-800">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    style={{ width: `${state?.globalProgress?.percentage || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                  <span>{state?.globalProgress?.completed || 0} Objectives Cleared</span>
                  <span>{state?.globalProgress?.inPlay || 0} Objectives Remaining</span>
                </div>
              </div>

              {/* Roster Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {state?.playerRoster?.map((p) => (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border text-center font-mono text-xs transition-all ${
                      p.status === "ELIMINATED"
                        ? "bg-zinc-950 border-zinc-900 text-zinc-600 line-through opacity-40"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-200"
                    }`}
                  >
                    <div className="text-[10px] text-zinc-500 font-bold">
                      #{p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--"}
                    </div>
                    <div className="font-semibold truncate mt-1 text-white">{p.name}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STAGE 5: GAME OVER / RESULTS */}
          {isFinished && state?.finalResult && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 max-w-3xl"
            >
              <div className="text-xs font-mono tracking-widest uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-3 py-1 rounded inline-block">
                MATCH CONCLUDED
              </div>
              <h2 className="text-6xl font-black text-white uppercase tracking-tight">
                {state.finalResult.winner === "ENGINEERS" ? "ENGINEERS WIN" : "IMPOSTORS WIN"}
              </h2>
              <p className="text-lg text-zinc-400 max-w-xl mx-auto">
                {state.finalResult.reason}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/80 pt-4 flex items-center justify-between text-xs font-mono text-zinc-500">
        <div>Manipal University Jaipur — Student Chapter</div>
        <div>@isa_muj_chapter</div>
      </footer>
    </div>
  );
}
