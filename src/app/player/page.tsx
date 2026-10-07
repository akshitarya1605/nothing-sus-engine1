"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IsaHeader } from "@/components/ui/IsaHeader";

interface StudentProfile {
  id: string;
  fullName: string;
  collegeRegId: string;
  approvalStatus: string;
}

interface ActiveGame {
  roomCode: string;
  playerNumber: number;
  gameStatus: string;
  role?: string | null;
  status: string;
}

export default function PlayerHomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data.authenticated) {
        router.push("/login");
        return;
      }

      setProfile(data.account);
      setActiveGame(data.activeGame || null);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSession();
  }, []);

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    setJoinLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to join room.");
      }

      // Successfully joined -> navigate directly to in-game console
      router.push("/player/game");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join room.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <p className="text-zinc-500 animate-pulse text-sm">Loading Player Profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Welcome Card */}
        <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-sans text-[10px] uppercase tracking-widest text-zinc-500">
              PLAYER PORTAL
            </span>
            <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border bg-emerald-950/80 text-emerald-400 border-emerald-500/40">
              ● APPROVED
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">
              Welcome, {profile?.fullName.split(" ")[0]}
            </h1>
            <p className="text-sm font-mono text-zinc-400 mt-1">
              Registration ID: <span className="text-zinc-200">{profile?.collegeRegId}</span>
            </p>
          </div>
        </div>

        {/* Join a Game Card */}
        <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-8 space-y-5 shadow-xl">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              Join a Game
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Enter the room code displayed on the arena projector or TV screen.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-white/[0.08] bg-[#FF3B5C]/10 text-[#FF3B5C] text-xs font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleJoinGame} className="space-y-3">
            <div>
              <input
                type="text"
                required
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. SUS-2213"
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-600 font-mono text-center text-lg font-black tracking-widest uppercase focus:outline-none focus:border-[#00F0FF]/50"
              />
            </div>
            <button
              type="submit"
              disabled={joinLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#FF3B5C] hover:bg-white disabled:opacity-50 text-[#0B0B0F] text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_0_1px_rgba(255,59,92,0.4),0_10px_40px_-10px_rgba(255,59,92,0.65)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_14px_50px_-10px_rgba(255,59,92,0.8)] flex items-center justify-center gap-2"
            >
              {joinLoading ? "Connecting to Room..." : "Join Game"}
            </button>
          </form>
        </div>

        {/* My Current Game Card */}
        <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-8 space-y-4 shadow-xl">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            MY CURRENT GAME
          </span>

          {activeGame ? (
            <div className="p-5 rounded-2xl bg-black/50 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-black text-[#FF3B5C] tracking-wider">
                  {activeGame.roomCode}
                </span>
                <span className="text-xs font-mono font-bold text-yellow-400 bg-yellow-950/60 border border-yellow-500/40 px-2 py-0.5 rounded">
                  PLAYER #{String(activeGame.playerNumber).padStart(2, "0")}
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-400">
                STATUS: <span className="text-white font-bold">{activeGame.gameStatus}</span>
              </div>
              <Link
                href="/player/game"
                className="block w-full py-2.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-mono text-xs font-bold uppercase tracking-wider text-center transition-colors"
              >
                Re-Enter Game Console →
              </Link>
            </div>
          ) : (
            <div className="py-4 text-center text-zinc-500 text-xs font-mono">
              No active game currently joined.
            </div>
          )}
        </div>

        {/* Account Details & Logout */}
        <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-6 flex items-center justify-between text-xs font-mono text-zinc-400 shadow-xl">
          <div>
            <div className="text-white font-bold">{profile?.fullName}</div>
            <div className="text-zinc-500 text-[10px]">{profile?.collegeRegId}</div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-white/[0.04] text-zinc-300 border border-white/[0.08] text-xs transition-colors"
          >
            Log Out
          </button>
        </div>
      </main>
    </div>
  );
}
