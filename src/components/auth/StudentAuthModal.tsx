"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  onAccountCreated: (account: { name: string; collegeRegId: string; code: string }) => void;
  currentAccount: { name: string; collegeRegId: string; code: string } | null;
}

export function StudentAuthModal({ open, onClose, onAccountCreated, currentAccount }: Props) {
  const [tab, setTab] = useState<"register" | "login">("register");
  const [fullName, setFullName] = useState("");
  const [collegeRegId, setCollegeRegId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (!open) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !collegeRegId.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, collegeRegId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.participant) {
        const acc = {
          name: data.participant.fullName || data.participant.name,
          collegeRegId: data.participant.collegeRegId || collegeRegId.toUpperCase(),
          code: data.participant.code,
        };
        onAccountCreated(acc);
        setMsg({ kind: "ok", text: data.message || "Account registered! Pending admin approval." });
      } else {
        setMsg({ kind: "err", text: data.message || "Registration failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/participant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const acc = {
          name: data.name,
          collegeRegId: code.trim().toUpperCase(),
          code: code.trim().toUpperCase(),
        };
        onAccountCreated(acc);
        setMsg({ kind: "ok", text: "Logged in successfully!" });
        setTimeout(onClose, 800);
      } else {
        setMsg({ kind: "err", text: data.message || "Invalid credentials or pending admin approval" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border-2 border-cyan/40 bg-panel p-6 shadow-[0_0_50px_rgba(0,255,255,0.2)]">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan">
              ISA MUJ STUDENT ACCESS
            </span>
            <h2 className="font-display text-xl font-black uppercase text-yellow">
              {currentAccount ? "Your Account" : "Create Account / Login"}
            </h2>
          </div>
          <button onClick={onClose} className="font-mono text-xs font-bold text-fg-dim hover:text-fg">
            ✕ CLOSE
          </button>
        </div>

        {currentAccount ? (
          <div className="space-y-4 text-center">
            <div className="rounded-[2.5rem] border border-cyan/30 bg-elevated p-4 space-y-1">
              <p className="font-display text-lg font-bold text-yellow">{currentAccount.name}</p>
              <p className="font-mono text-xs text-cyan font-bold">Reg ID: {currentAccount.collegeRegId}</p>
              <p className="font-mono text-xs text-fg-faint">PIN Code: {currentAccount.code}</p>
            </div>
            <p className="text-xs text-fg-dim">
              Your account is active. Click "Join Game" in the navbar to enter the live game console or room lobby!
            </p>
            <Button variant="cyan" block onClick={onClose}>
              Continue to Main Site
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab switch */}
            <div className="flex rounded-full border border-line bg-elevated p-1">
              <button
                type="button"
                onClick={() => setTab("register")}
                className={`flex-1 rounded-full py-1.5 font-display text-xs font-bold uppercase transition-all ${
                  tab === "register" ? "bg-yellow text-ink font-extrabold shadow" : "text-fg-dim"
                }`}
              >
                1. Register
              </button>
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 rounded-full py-1.5 font-display text-xs font-bold uppercase transition-all ${
                  tab === "login" ? "bg-cyan text-ink font-extrabold shadow" : "text-fg-dim"
                }`}
              >
                2. Login
              </button>
            </div>

            {tab === "register" ? (
              <form onSubmit={handleRegister} className="space-y-3 text-left">
                <div>
                  <label className="text-xs font-bold uppercase text-fg-dim">Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full rounded-xl border border-line bg-elevated px-4 py-2.5 font-display text-sm outline-none focus:border-yellow"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-fg-dim">College Registration ID</label>
                  <input
                    value={collegeRegId}
                    onChange={(e) => setCollegeRegId(e.target.value.toUpperCase())}
                    placeholder="e.g. 239301094"
                    required
                    className="w-full rounded-xl border border-line bg-elevated px-4 py-2.5 font-mono text-sm outline-none focus:border-yellow"
                  />
                </div>
                <Button type="submit" variant="cyan" block disabled={busy || !fullName.trim() || !collegeRegId.trim()}>
                  {busy ? "Registering…" : "Create Student Account"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3 text-left">
                <div>
                  <label className="text-xs font-bold uppercase text-fg-dim">Registration ID or PIN Code</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="NS-XXXXXX or College Reg ID"
                    required
                    className="w-full rounded-xl border border-line bg-elevated px-4 py-2.5 font-mono text-sm text-center outline-none focus:border-cyan"
                  />
                </div>
                <Button type="submit" variant="cyan" block disabled={busy || !code.trim()}>
                  {busy ? "Logging in…" : "Login Account"}
                </Button>
              </form>
            )}

            {msg && (
              <p className={`text-center text-xs font-bold ${msg.kind === "ok" ? "text-green" : "text-red"}`}>
                {msg.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
