"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RolePill, StatusPill } from "@/components/ui/Badge";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { OtpInput } from "@/components/ui/OtpInput";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { ConfirmModal } from "@/components/ui/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  userAccount: { name: string; collegeRegId: string; code: string } | null;
}

interface ParticipantState {
  identity: { id: string; name: string; code: string; playerNumber?: number | null };
  ownRole: "ENGINEER" | "IMPOSTER" | null;
  ownStatus: string;
  weaponUnlocked?: boolean;
  weaponClue?: string | null;
  killCooldownSeconds?: number;
  lastKillAt?: string | null;
  game: { status: string; currentRoundNumber: number; currentPhase: string | null; roomCode?: string };
  round: { number: number; name: string; msRemaining: number | null } | null;
  meetingStatus: string | null;
  ownTasks: Array<{ taskId: string; title: string; difficulty: string; points: number; status: string }>;
  ownProgress: { completed: number; inPlay: number; percentage: number };
  notifications: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  meetingRoster: Array<{ id: string; name: string; playerNumber?: number | null; status: string }> | null;
}

export function IntegratedGameModal({ open, onClose, userAccount }: Props) {
  const [state, setState] = useState<ParticipantState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState<Record<string, string>>({});
  const [otpFeedback, setOtpFeedback] = useState<Record<string, string>>({});
  const [weaponCode, setWeaponCode] = useState("");
  const [targetNum, setTargetNum] = useState("");
  const [targetMsg, setTargetMsg] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    if (!open) return;
    try {
      const res = await fetch("/api/game/state?as=PARTICIPANT", { cache: "no-store" });
      if (res.ok) {
        setState(await res.json());
        setError(null);
      } else if (res.status === 401 && userAccount?.code) {
        // Auto login with userAccount code
        const loginRes = await fetch("/api/auth/participant-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: userAccount.code }),
        });
        if (loginRes.ok) {
          const stateRes = await fetch("/api/game/state?as=PARTICIPANT", { cache: "no-store" });
          if (stateRes.ok) setState(await stateRes.json());
        } else {
          const errData = await loginRes.json().catch(() => ({}));
          setError(errData.message || "Account pending admin approval.");
        }
      }
    } catch {
      /* ignore */
    }
  }, [open, userAccount]);

  useEffect(() => {
    if (!open) return;
    void refreshState();
    const interval = setInterval(() => void refreshState(), 5000);
    return () => clearInterval(interval);
  }, [open, refreshState]);

  if (!open) return null;

  const submitOtp = async (taskId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/game/tasks/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, otp: otp[taskId] || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.correct) {
        setOtpFeedback({ ...otpFeedback, [taskId]: "Task complete!" });
      } else {
        setOtpFeedback({ ...otpFeedback, [taskId]: data.message || "Incorrect code" });
      }
      void refreshState();
    } finally {
      setBusy(false);
    }
  };

  const unlockWeapon = async () => {
    if (!weaponCode.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/game/eliminations/unlock-weapon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: weaponCode.trim() }),
      });
      if (res.ok) {
        setWeaponCode("");
        void refreshState();
      }
    } finally {
      setBusy(false);
    }
  };

  const executeKill = async () => {
    const num = parseInt(targetNum.trim(), 10);
    if (isNaN(num)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/game/eliminations/kill-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayerNumber: num }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTargetMsg(`Player #${num} eliminated!`);
        setTargetNum("");
        void refreshState();
      } else {
        setTargetMsg(data.message || "Kill failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const roomCode = state?.game?.roomCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 p-4 backdrop-blur-xl">
      <div className="flex h-full max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border-2 border-cyan/40 bg-panel shadow-[0_0_50px_rgba(0,255,255,0.15)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line bg-elevated px-5 py-4">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan">
              ISA MUJ GAME CONSOLE
            </span>
            <h2 className="font-display text-xl font-black uppercase text-yellow">
              {state?.identity?.name || userAccount?.name || "Player Console"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-line bg-panel px-3 py-1 font-mono text-xs font-bold text-fg-dim hover:text-fg"
          >
            CLOSE ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <Panel tone="danger" className="text-center font-semibold text-red">
              {error}
            </Panel>
          )}

          {!state && !error && (
            <div className="py-12 text-center text-fg-dim">Connecting to Game Server…</div>
          )}

          {state && (
            <>
              {/* Waiting Room / Pre-Game */}
              {(!state.round || state.game.status === "SETUP" || state.game.status === "READY") && (
                <Panel className="text-center flex flex-col items-center gap-4 py-6">
                  <PlayerAvatar id={state.identity.id} size={72} />
                  <div>
                    <h3 className="font-display text-xl font-bold text-yellow">{state.identity.name}</h3>
                    {state.identity.playerNumber && (
                      <span className="mt-1 inline-block rounded-full border border-yellow/40 bg-yellow/10 px-3 py-0.5 font-mono text-xs font-bold text-yellow">
                        Badge #{String(state.identity.playerNumber).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  {roomCode && (
                    <div className="w-full rounded-xl border border-cyan/30 bg-elevated p-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-fg-faint">LOBBY ROOM CODE</p>
                      <p className="font-mono text-xl font-bold text-cyan">{roomCode}</p>
                    </div>
                  )}
                  <div className="w-full rounded-full border border-yellow/40 bg-yellow/10 py-2 font-display text-xs font-bold uppercase text-yellow animate-pulse">
                    Waiting for ISA Host to start the round…
                  </div>
                </Panel>
              )}

              {/* Active Game Round */}
              {state.round && state.game.status === "LIVE" && (
                <div className="space-y-4">
                  <Panel tone="cyan" className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-xs uppercase tracking-wider text-fg-faint">
                        Round {state.round.number} · {state.round.name}
                      </p>
                      <p className="font-display text-3xl font-bold">
                        <CountdownTimer msRemaining={state.round.msRemaining} />
                      </p>
                    </div>
                    <RolePill role={state.ownRole} />
                  </Panel>

                  {/* Impostor Kill Panel */}
                  {state.ownRole === "IMPOSTER" && state.ownStatus === "ALIVE" && (
                    <Panel tone="danger" className="space-y-3">
                      <h4 className="font-display text-sm font-bold uppercase tracking-wider text-red">
                        Impostor Kill Pad
                      </h4>
                      {!state.weaponUnlocked ? (
                        <div className="space-y-2 text-xs">
                          <p className="text-fg-dim">Find the physical murder weapon in the venue to unlock kills.</p>
                          {state.weaponClue && <p className="font-bold text-yellow">Clue: {state.weaponClue}</p>}
                          <div className="flex gap-2">
                            <input
                              value={weaponCode}
                              onChange={(e) => setWeaponCode(e.target.value.toUpperCase())}
                              placeholder="Enter weapon code"
                              className="flex-1 rounded-lg border border-line bg-elevated px-3 py-1.5 font-mono text-xs uppercase"
                            />
                            <Button size="sm" variant="danger" disabled={busy} onClick={unlockWeapon}>
                              Unlock
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <p className="text-fg-dim">Enter target's badge number (#01-#30) to eliminate:</p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={targetNum}
                              onChange={(e) => setTargetNum(e.target.value)}
                              placeholder="Target #"
                              className="w-24 rounded-lg border border-line bg-elevated px-3 py-1.5 font-mono text-xs font-bold"
                            />
                            <Button size="sm" variant="danger" disabled={busy || !targetNum.trim()} onClick={executeKill}>
                              Eliminate Player
                            </Button>
                          </div>
                          {targetMsg && <p className="text-xs font-bold text-yellow">{targetMsg}</p>}
                        </div>
                      )}
                    </Panel>
                  )}

                  {/* Tasks List */}
                  <div className="space-y-2">
                    <h4 className="font-display text-sm font-bold uppercase tracking-wider text-fg-dim">
                      Assigned Tasks ({state.ownTasks.filter((t) => t.status === "COMPLETED").length}/{state.ownTasks.length})
                    </h4>
                    {state.ownTasks.map((t) => {
                      const done = t.status === "COMPLETED";
                      return (
                        <Panel key={t.taskId} tone={done ? "cyan" : "default"} className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`font-display text-sm font-bold ${done ? "line-through text-cyan" : ""}`}>{t.title}</p>
                              <p className="text-[10px] text-fg-faint">{t.difficulty} · {t.points} pts</p>
                            </div>
                            {done && <span className="text-cyan font-bold text-sm">✓ Done</span>}
                          </div>
                          {!done && state.ownStatus === "ALIVE" && (
                            <div className="flex gap-2 items-center">
                              <input
                                value={otp[t.taskId] || ""}
                                onChange={(e) => setOtp({ ...otp, [t.taskId]: e.target.value })}
                                maxLength={4}
                                placeholder="4-digit OTP"
                                className="w-28 rounded-lg border border-line bg-elevated px-2 py-1 text-center font-mono text-xs"
                              />
                              <Button size="sm" variant="cyan" disabled={busy || (otp[t.taskId] || "").length < 4} onClick={() => submitOtp(t.taskId)}>
                                Submit
                              </Button>
                            </div>
                          )}
                          {otpFeedback[t.taskId] && (
                            <p className="text-[10px] font-bold text-yellow">{otpFeedback[t.taskId]}</p>
                          )}
                        </Panel>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
