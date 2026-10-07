"use client";

import { useState } from "react";
import Link from "next/link";
import { IsaHeader } from "@/components/ui/IsaHeader";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [collegeRegId, setCollegeRegId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !collegeRegId.trim() || !password) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          collegeRegId: collegeRegId.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create account.");
      }

      setRegistered(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
          <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
            {registered ? (
              <div className="text-center space-y-5 py-4">
                <div className="inline-block px-3 py-1 rounded bg-amber-950/80 border border-amber-500/40 text-amber-400 font-mono text-xs uppercase tracking-wider font-bold animate-pulse">
                  APPROVAL REQUIRED
                </div>

                <h1 className="text-3xl font-black uppercase tracking-tight text-white">
                  Account Created
                </h1>

                <div className="p-4 rounded-xl bg-black/50 border border-white/[0.08] space-y-2 text-left text-xs font-mono">
                  <div className="text-zinc-500">STUDENT NAME</div>
                  <div className="text-white font-bold text-sm">{fullName}</div>
                  <div className="text-zinc-500 pt-1">COLLEGE REGISTRATION ID</div>
                  <div className="text-[#00F0FF] font-bold">{collegeRegId.toUpperCase()}</div>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed">
                  Your account is waiting for ISA host verification. Please present your Student ID Card at the ISA Desk in the arena to get activated.
                </p>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="block w-full py-3 px-4 rounded-lg bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 text-center"
                  >
                    Proceed to Login
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-[#FF3B5C] bg-[#FF3B5C]/10/60 border border-[#FF3B5C]/30 px-2.5 py-1 rounded">
                    PLAYER REGISTRATION
                  </span>
                  <h1 className="text-2xl font-black uppercase tracking-tight mt-3 text-white">
                    Create Player Account
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Register once with your official college credentials to participate in any event match.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3 rounded-lg border border-[#FF3B5C]/30 bg-[#FF3B5C]/5 text-red-200 text-xs font-mono">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Arshpreet Singh"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-black/50 border border-white/[0.08] text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500 font-sans"
                    />
                  </div>

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
                      className="w-full px-3.5 py-2.5 rounded-lg bg-black/50 border border-white/[0.08] text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500 font-mono uppercase"
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
                      placeholder="Create secure password"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-black/50 border border-white/[0.08] text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-black/50 border border-white/[0.08] text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 rounded-lg bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </button>
                  </div>

                  <div className="pt-3 text-center border-t border-white/[0.08]/80">
                    <p className="text-xs text-zinc-400">
                      Already registered?{" "}
                      <Link
                        href="/login"
                        className="text-[#FF3B5C] hover:text-red-300 font-mono underline ml-1"
                      >
                        Log in here
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
