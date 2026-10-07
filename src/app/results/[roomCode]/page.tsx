"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IsaHeader } from "@/components/ui/IsaHeader";

interface ResultsData {
  winner?: string;
  reason?: string;
  roomCode?: string;
  durationMinutes?: number;
  participants: Array<{
    id: string;
    name: string;
    playerNumber?: number | null;
    role?: "ENGINEER" | "IMPOSTER" | null;
    status: string;
    tasksCompletedCount?: number;
  }>;
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = use(params);
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/game/state?as=SPECTATOR", { cache: "no-store" });
      if (res.ok) {
        const state = await res.json();
        setData({
          winner: state.finalResult?.winner || "ENGINEERS",
          reason: state.finalResult?.reason || "All campus objectives successfully stabilized.",
          roomCode,
          participants: state.playerRoster || [],
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const isEngineersWin = data?.winner === "ENGINEERS";

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8">
        <div className="text-center space-y-4 pt-6">
          <span className="text-xs font-mono uppercase tracking-widest text-[#FF3B5C] bg-[#FF3B5C]/10/60 border border-[#FF3B5C]/30 px-3 py-1 rounded">
            OFFICIAL MATCH DEBRIEF // ROOM {roomCode}
          </span>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white">
            {isEngineersWin ? "ENGINEERS PREVAILED" : "IMPOSTORS SEIZED CONTROL"}
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            {data?.reason || "Match concluded under server authoritative rules."}
          </p>
        </div>

        {/* Unmasked Roster */}
        <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px]/80 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white uppercase font-mono tracking-wider">
                Full Agent Manifest (Unmasked)
              </h2>
              <p className="text-xs text-zinc-500">
                All roles and survival statuses revealed post-match.
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {data?.participants.length || 0} Total Agents
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data?.participants.map((p) => (
              <div
                key={p.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  p.role === "IMPOSTER"
                    ? "bg-[#FF3B5C]/10/30 border-red-900/50"
                    : "bg-black/50/60 border-white/[0.08]"
                }`}
              >
                <div>
                  <div className="font-semibold text-white truncate">{p.name}</div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    Badge #{p.playerNumber ? String(p.playerNumber).padStart(2, "0") : "--"}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border ${
                      p.role === "IMPOSTER"
                        ? "bg-[#FF3B5C]/10 text-[#FF3B5C] border-[#FF3B5C]/30"
                        : "bg-cyan-950 text-[#00F0FF] border-[#00F0FF]/30"
                    }`}
                  >
                    {p.role || "ENGINEER"}
                  </span>
                  <div className="text-[10px] font-mono text-zinc-500 mt-1 uppercase">
                    {p.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/join"
            className="py-3 px-6 rounded-xl bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/40"
          >
            Join Next Match
          </Link>
          <Link
            href="/"
            className="py-3 px-6 rounded-xl bg-black/50 hover:bg-white/[0.04] border border-white/[0.08] text-zinc-300 font-mono text-xs uppercase transition-colors"
          >
            Event Main Page
          </Link>
        </div>
      </main>
    </div>
  );
}
