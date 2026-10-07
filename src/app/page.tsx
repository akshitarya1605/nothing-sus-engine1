"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IsaHeader } from "@/components/ui/IsaHeader";
import { HostScript } from "@/components/ui/HostScript";
import { User, ShieldAlert, KeyRound, ArrowRight } from "lucide-react";

export default function UnifiedAuthPage() {
  const router = useRouter();
  const [role, setRole] = useState<"player" | "admin">("player");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player fields
  const [collegeRegId, setCollegeRegId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Admin fields
  const [adminSecret, setAdminSecret] = useState("");

  const handlePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        if (!collegeRegId.trim() || !password) throw new Error("Please fill in both Registration ID and Password.");
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collegeRegId: collegeRegId.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to log in.");
        router.push("/player");
      } else {
        if (!fullName.trim() || !collegeRegId.trim() || !password) throw new Error("Please fill all fields.");
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: fullName.trim(), collegeRegId: collegeRegId.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to register.");
        setMode("login");
        setError("Account created! Please wait for ISA approval before logging in.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSecret.trim()) {
      setError("Please enter the Admin Passcode.");
      return;
    }
    setLoading(true);
    // Redirects to the control route which sets the admin cookie and redirects back to admin
    router.push(`/control/${adminSecret.trim()}`);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white font-sans flex flex-col selection:bg-[#00F0FF]/30">
      <IsaHeader />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden">
        {/* Subtle grid backdrop */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="w-full max-w-lg relative z-10">
          <div className="rounded-[32px] border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Soft glows inside the modal */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
              <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#00F0FF]/10 blur-[80px] rounded-full" />
              <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[#8B5CF6]/10 blur-[80px] rounded-full" />
            </div>

            <div className="flex bg-black/40 p-1 rounded-2xl mb-8 border border-white/[0.05]">
              <button
                onClick={() => { setRole("player"); setError(null); }}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  role === "player" ? "bg-[#00F0FF]/10 text-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.1)] border border-[#00F0FF]/20" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <User className="w-4 h-4" />
                Player
              </button>
              <button
                onClick={() => { setRole("admin"); setError(null); }}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  role === "admin" ? "bg-[#FF3B5C]/10 text-[#FF3B5C] shadow-[0_0_20px_rgba(255,59,92,0.1)] border border-[#FF3B5C]/20" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Admin
              </button>
            </div>

            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight text-white">
                {role === "player" ? (mode === "login" ? "Player Login" : "Player Sign Up") : "Admin Access"}
              </h1>
              <p className="text-sm text-zinc-400 mt-2">
                {role === "player"
                  ? mode === "login"
                    ? "Log in to your account to enter active game rooms."
                    : "Register your college ID to participate in the game."
                  : "Enter the secure passcode to access the telemetry dashboard."}
              </p>
            </div>

            {error && (
              <div className={`mb-6 p-4 rounded-xl border text-xs font-mono leading-relaxed ${
                error.includes("created") 
                ? "border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF]" 
                : "border-[#FF3B5C]/30 bg-[#FF3B5C]/10 text-[#FF3B5C]"
              }`}>
                {error}
              </div>
            )}

            {role === "player" ? (
              <form onSubmit={handlePlayerSubmit} className="space-y-5">
                {mode === "register" && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-2 ml-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#00F0FF]/50 focus:bg-black transition-colors"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-2 ml-1">College Registration ID</label>
                  <input
                    type="text"
                    required
                    value={collegeRegId}
                    onChange={(e) => setCollegeRegId(e.target.value)}
                    placeholder="e.g. 230910452"
                    className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#00F0FF]/50 focus:bg-black transition-colors font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-2 ml-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#00F0FF]/50 focus:bg-black transition-colors font-mono"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-4 rounded-xl bg-[#00F0FF] hover:bg-white disabled:opacity-50 text-[#0B0B0F] text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_0_1px_rgba(0,240,255,0.4),0_10px_40px_-10px_rgba(0,240,255,0.65)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_14px_50px_-10px_rgba(0,240,255,0.8)] flex items-center justify-center gap-2 group"
                  >
                    {loading ? "Processing..." : mode === "login" ? "Login" : "Register"}
                    {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />}
                  </button>
                </div>

                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                    className="text-xs text-zinc-400 hover:text-white font-mono uppercase transition-colors"
                  >
                    {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-2 ml-1 flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5" />
                    Admin Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={adminSecret}
                    onChange={(e) => setAdminSecret(e.target.value)}
                    placeholder="Enter Secret Code"
                    className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/[0.08] text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#FF3B5C]/50 focus:bg-black transition-colors font-mono uppercase"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-4 rounded-xl bg-[#FF3B5C] hover:bg-white disabled:opacity-50 text-[#0B0B0F] text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_0_1px_rgba(255,59,92,0.4),0_10px_40px_-10px_rgba(255,59,92,0.65)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_14px_50px_-10px_rgba(255,59,92,0.8)] flex items-center justify-center gap-2 group"
                  >
                    {loading ? "Authenticating..." : "Enter Command Center"}
                    {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* --- Host Script / Public Instructions --- */}
        <HostScript />
      </main>
    </div>
  );
}
