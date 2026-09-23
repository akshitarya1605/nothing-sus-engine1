"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IsaHeader } from "@/components/ui/IsaHeader";

export default function LoginPage() {
  const router = useRouter();
  const [collegeRegId, setCollegeRegId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!collegeRegId.trim() || !password) {
      setError("Please fill in both Registration ID and Password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeRegId: collegeRegId.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to log in.");
      }

      // Success -> Redirect to Player Home
      router.push("/player");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden">
        {/* Subtle grid backdrop */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="w-full max-w-md relative z-10">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-6">
              <span className="text-[10px] font-mono tracking-widest uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-2.5 py-1 rounded">
                STUDENT ACCESS
              </span>
              <h1 className="text-2xl font-black uppercase tracking-tight mt-3 text-white">
                Welcome Back
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Log in to your account to enter active game rooms.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-lg border border-red-500/30 bg-red-950/40 text-red-200 text-xs font-mono leading-relaxed">
                {error}
                {error.includes("pending") && (
                  <div className="mt-2 pt-2 border-t border-red-500/20 text-zinc-300">
                    Show your ID card to the ISA event booth to activate your account.
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  College Registration ID
                </label>
                <input
                  type="text"
                  required
                  value={collegeRegId}
                  onChange={(e) => setCollegeRegId(e.target.value)}
                  placeholder="e.g. 230910452"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </div>

              <div className="pt-3 text-center border-t border-zinc-800/80">
                <p className="text-xs text-zinc-400">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/register"
                    className="text-red-400 hover:text-red-300 font-mono underline ml-1"
                  >
                    Register here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
