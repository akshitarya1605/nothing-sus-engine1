"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IsaHeader } from "@/components/ui/IsaHeader";

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <JoinContent />
    </Suspense>
  );
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const roomParam = searchParams.get("room") || searchParams.get("code");
    if (roomParam) {
      setRoomCode(roomParam.toUpperCase());
    }

    // Verify authenticated session
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push(`/login?next=/join${roomParam ? `?room=${roomParam}` : ""}`);
        } else {
          setAuthenticated(true);
          setPlayerName(data.account.fullName);
        }
      })
      .catch(() => {
        router.push("/login");
      })
      .finally(() => setCheckingAuth(false));
  }, [router, searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    setLoading(true);
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

      router.push("/player/game");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join room.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <p className="text-zinc-500 animate-pulse text-sm">Verifying Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden">
        <div className="w-full max-w-md relative z-10">
          <div className="rounded-[2.5rem] border border-[#FF3B5C]/30 bg-[#12121A]/60 backdrop-blur-[30px] p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#FF3B5C]">
                ROOM ENTRY
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Player: <span className="text-white font-bold">{playerName.split(" ")[0]}</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">
                Enter Room Code
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Enter the room code displayed on the arena TV display.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-[#FF3B5C]/30 bg-[#FF3B5C]/5 text-red-200 text-xs font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="SUS-XXXX"
                  className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-500 font-mono text-center text-2xl font-black tracking-widest uppercase focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
              >
                {loading ? "Joining Game..." : "Join Game"}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href="/player"
                className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Back to Player Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
