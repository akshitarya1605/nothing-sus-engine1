"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IsaHeader } from "@/components/ui/IsaHeader";
import { QRCode } from "@/components/ui/QRCode";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";

interface Preset {
  id: string;
  name: string;
  maxPlayers: number;
  imposterCount: number;
  killCooldownSeconds: number;
}

interface PendingAccount {
  id: string;
  fullName: string;
  collegeRegId: string;
  createdAt: string;
}

interface AdminStateResponse {
  game: {
    id: string;
    roomCode: string | null;
    maxPlayers: number;
    presetId: string | null;
    status: string;
    currentRoundNumber: number;
    currentPhase: string | null;
    rolesLocked: boolean;
    pausedFromStatus: string | null;
    pauseReason: string | null;
    adminSecret: string;
    spectatorSecret: string;
  };
  config: {
    imposterCount: number;
    killCooldownSeconds: number;
  } | null;
  rounds: Array<{ id: string; number: number; name: string; status: string; startedAt: string | null }>;
  groups: Array<{
    id: string;
    name: string;
    participantCount: number;
    taskProgress: { completed: number; inPlay: number; percentage: number };
  }>;
  participants: Array<{
    id: string;
    name: string;
    code: string;
    playerNumber: number | null;
    badge?: string | null;
    collegeRegId?: string | null;
    fullName?: string | null;
    isApproved?: boolean;
    batchNumber: number;
    weaponUnlocked: boolean;
    lastKillAt: string | null;
    role: string | null;
    status: string;
    groupId: string | null;
    groupName: string | null;
    currentRoundNumber: number | null;
  }>;
  taskProgress: { completed: number; inPlay: number; percentage: number };
  activeMeeting: {
    id: string;
    status: string;
    type: string;
    voteCount: number;
    aliveVoterCount: number;
  } | null;
  recentAuditLog: Array<{
    id: string;
    action: string;
    actorType: string;
    actorId: string | null;
    createdAt: string;
  }>;
  pendingRoleReveals: Array<{
    eliminationId: string;
    participantId: string;
    participantName: string;
  }>;
}

interface PersonRecord {
  id: string;
  fullName: string;
  collegeRegId: string;
  approvalStatus: string;
  approvedAt: string | null;
  createdAt: string;
  activeParticipation: {
    participantId: string;
    gameId: string;
    roomCode: string | null;
    gameStatus: string;
    playerNumber: number | null;
    role: string | null;
    status: string;
  } | null;
}

interface PeopleStats {
  totalAccounts: number;
  pendingCount: number;
  approvedCount: number;
  inGameCount: number;
}

export default function ControlPage() {
  const [activeTab, setActiveTab] = useState<"game" | "people">("game");
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [showApprovals, setShowApprovals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Room Creation state
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [maxPlayers, setMaxPlayers] = useState(30);
  const [imposterCount, setImposterCount] = useState(3);
  const [cooldown, setCooldown] = useState(60);

  // People Database state
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [peopleStats, setPeopleStats] = useState<PeopleStats>({
    totalAccounts: 0,
    pendingCount: 0,
    approvedCount: 0,
    inGameCount: 0,
  });
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<string>("ALL");
  const [peopleLoading, setPeopleLoading] = useState(false);

  const notify = (msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshGame = useCallback(async () => {
    try {
      const res = await fetch("/api/game/state?as=ADMIN", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) setDenied(true);
        return;
      }
      setDenied(false);
      const data = await res.json();
      setState(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/approvals", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPendingAccounts(data.pending || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch("/api/game/presets", { cache: "no-store" });
      if (res.ok) setPresets(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const fetchPeople = useCallback(async () => {
    setPeopleLoading(true);
    try {
      const q = new URLSearchParams();
      if (peopleSearch) q.set("search", peopleSearch);
      if (peopleFilter) q.set("filter", peopleFilter);

      const res = await fetch(`/api/admin/people?${q.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPeople(data.accounts || []);
        if (data.stats) setPeopleStats(data.stats);
      }
    } catch {
      /* ignore */
    } finally {
      setPeopleLoading(false);
    }
  }, [peopleSearch, peopleFilter]);

  useEffect(() => {
    void refreshGame();
    void refreshApprovals();
    void fetchPresets();
    const beat = setInterval(() => {
      void refreshGame();
      void refreshApprovals();
    }, 3000);
    return () => clearInterval(beat);
  }, [refreshGame, refreshApprovals, fetchPresets]);

  useEffect(() => {
    if (activeTab === "people") {
      void fetchPeople();
    }
  }, [activeTab, fetchPeople]);

  // Realtime hook for immediate responsiveness on join/events
  const onRealtimeEvent = useCallback(() => {
    void refreshGame();
    void refreshApprovals();
    if (activeTab === "people") void fetchPeople();
  }, [refreshGame, refreshApprovals, activeTab, fetchPeople]);

  useGameRealtime({ enabled: !denied, as: "ADMIN", onEvent: onRealtimeEvent });

  // Host Actions
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy("create");
    try {
      const body: Record<string, unknown> = {
        maxPlayers,
        imposterCount,
        killCooldownSeconds: cooldown,
      };
      if (selectedPresetId) body.presetId = selectedPresetId;

      const res = await fetch("/api/game/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create room.");

      notify(`Room ${data.roomCode} initialized!`);
      await refreshGame();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Creation failed", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleStartGame = async () => {
    const participants = state?.participants || [];
    if (participants.length < 1) {
      notify("Cannot start: At least 1 player must be in the waiting room.", "err");
      return;
    }
    setActionBusy("start");
    try {
      const res = await fetch("/api/game/room/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to launch match.");
      }

      notify(data.message || "Match Started! Roles transmitted to all player consoles.");
      await refreshGame();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to launch match", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleCancelRoom = async () => {
    if (!confirm("Are you sure you want to cancel and close this room?")) return;
    setActionBusy("cancel");
    try {
      const res = await fetch("/api/game/room/cancel", { method: "POST" });
      if (!res.ok) throw new Error("Failed to cancel room.");
      notify("Room cancelled.");
      await refreshGame();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to cancel", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleCallEmergencyMeeting = async () => {
    setActionBusy("meeting");
    try {
      const res = await fetch("/api/game/meetings/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMERGENCY" }),
      });
      if (!res.ok) throw new Error("Failed to trigger meeting.");
      notify("Emergency meeting triggered!");
      await refreshGame();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handlePauseToggle = async () => {
    const isPaused = state?.game?.status === "PAUSED";
    const endpoint = isPaused ? "/api/game/resume" : "/api/game/pause";
    setActionBusy("pause");
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Host action" }),
      });
      notify(isPaused ? "Game resumed" : "Game paused");
      await refreshGame();
    } catch {
      notify("Action failed", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleDeclareWinner = async (winner: "ENGINEERS" | "IMPOSTERS") => {
    if (!confirm(`Conclude match and declare ${winner} victorious?`)) return;
    setActionBusy("declare");
    try {
      await fetch("/api/game/declare-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner, reason: `Host declared ${winner} victory.` }),
      });
      notify(`${winner} declared winners!`);
      await refreshGame();
    } catch {
      notify("Failed to declare outcome", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleApproveAccount = async (accountId: string, action: "approve" | "reject") => {
    setActionBusy(`acc-${accountId}`);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, action }),
      });
      if (!res.ok) throw new Error("Failed");
      notify(`Account ${action === "approve" ? "Approved" : "Rejected"}`);
      await refreshApprovals();
      if (activeTab === "people") await fetchPeople();
    } catch {
      notify("Failed to update account", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleApproveAllAccounts = async () => {
    setActionBusy("approve-all");
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveAll: true, action: "approve" }),
      });
      const data = await res.json();
      notify(`Approved ${data.count || "all"} accounts!`);
      await refreshApprovals();
      if (activeTab === "people") await fetchPeople();
    } catch {
      notify("Failed to approve all", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handlePeopleAction = async (action: string, accountId?: string, participantId?: string) => {
    setActionBusy(`${action}-${accountId || participantId}`);
    try {
      const res = await fetch("/api/admin/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountId, participantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action failed");
      notify(data.message || "Action executed");
      await fetchPeople();
      await refreshGame();
      await refreshApprovals();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setActionBusy(null);
    }
  };

  if (denied) {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
        <IsaHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 space-y-4 shadow-2xl text-center">
            <span className="text-[10px] tracking-wider uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
              RESTRICTED ACCESS
            </span>
            <h1 className="text-xl font-bold text-white">Host Authentication</h1>
            <p className="text-xs text-zinc-400 font-sans">
              Enter your Host Secret Key to unlock the control console.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passphrase.trim()) {
                  window.location.href = `/control/${encodeURIComponent(passphrase.trim())}`;
                }
              }}
              className="space-y-3"
            >
              <input
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter Host Key (e.g. ARSH235)"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-colors"
              >
                Unlock Console
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const game = state?.game;
  const roomCode = game?.roomCode;
  const gameStatus = game?.status;
  const isNoGame = !roomCode || gameStatus === "FINISHED";
  const isLobby = Boolean(roomCode && (gameStatus === "SETUP" || gameStatus === "READY"));
  const isLive = Boolean(roomCode && !isNoGame && !isLobby);

  const participants = state?.participants || [];
  const aliveCount = participants.filter((p) => p.status === "ALIVE").length;
  const eliminatedCount = participants.filter((p) => p.status === "ELIMINATED").length;
  const impostorCount = participants.filter((p) => p.role === "IMPOSTER").length;

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?room=${roomCode || ""}`
      : `/join?room=${roomCode || ""}`;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-6">
            <span className="font-sans text-base font-black tracking-wider text-white">
              NOTHING SUS CONTROL
            </span>

            <nav className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("game")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-colors ${
                  activeTab === "game"
                    ? "bg-zinc-800 text-white border border-zinc-700"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Game
              </button>
              <button
                onClick={() => setActiveTab("people")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                  activeTab === "people"
                    ? "bg-zinc-800 text-white border border-zinc-700"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>People</span>
                {pendingAccounts.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
                    {pendingAccounts.length}
                  </span>
                )}
              </button>
              <Link
                href="/control/presets"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
              >
                Presets
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Approvals Notification Button */}
            <button
              onClick={() => setShowApprovals(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-zinc-700 text-xs font-sans font-bold transition-colors flex items-center gap-2"
            >
              <span>Approvals</span>
              {pendingAccounts.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black animate-pulse">
                  ● {pendingAccounts.length}
                </span>
              ) : (
                <span className="text-zinc-500 text-[10px]">0</span>
              )}
            </button>

            {roomCode && (
              <a
                href={`/spectator/${roomCode}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-red-950/40"
              >
                <span>Arena TV</span>
                <span className="text-red-400">↗</span>
              </a>
            )}
          </div>
        </header>

        {toast && (
          <div
            className={`p-3 rounded-xl border text-xs font-sans ${
              toast.kind === "ok"
                ? "bg-[#B6FF3B]/10/80 border-[#B6FF3B]/20 text-emerald-200"
                : "bg-red-950/80 border-red-500/40 text-red-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 1: GAME ENGINE WORKFLOW                                   */}
        {/* ============================================================= */}
        {activeTab === "game" && (
          <>
            {/* ------------------------------------------------------------- */}
            {/* STATE 1: NO ACTIVE GAME -> CREATE ROOM                        */}
            {/* ------------------------------------------------------------- */}
            {isNoGame && (
              <div className="max-w-xl mx-auto rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="border-b border-zinc-800 pb-4">
                  <span className="text-[10px] tracking-wider uppercase text-zinc-500">
                    HOST WORKSPACE
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
                    Create Game Room
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    No active match is running. Initialize a new room code to launch the waiting lobby on the arena TV.
                  </p>
                </div>

                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs font-sans uppercase text-zinc-400 mb-1.5">
                      Select Preset Blueprint
                    </label>
                    <select
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-zinc-900 border border-white/[0.08] text-white text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-red-500"
                    >
                      <option value="">-- Standard Configuration --</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.imposterCount} Impostors, {p.maxPlayers} Max)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-sans uppercase text-zinc-500 mb-1">
                        Max Players
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 30)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-white text-xs font-bold uppercase tracking-wider text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans uppercase text-zinc-500 mb-1">
                        Impostors
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={imposterCount}
                        onChange={(e) => setImposterCount(parseInt(e.target.value) || 3)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-white text-xs font-bold uppercase tracking-wider text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans uppercase text-zinc-500 mb-1">
                        Kill Cooldown (s)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={cooldown}
                        onChange={(e) => setCooldown(parseInt(e.target.value) || 60)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-white text-xs font-bold uppercase tracking-wider text-center"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={actionBusy === "create"}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
                    >
                      {actionBusy === "create" ? "Generating Room..." : "Create Game Room"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STATE 2: WAITING LOBBY (SUS-XXXX)                             */}
            {/* ------------------------------------------------------------- */}
            {isLobby && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-red-500/30 bg-[#12121A]/40 backdrop-blur-[20px] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
                  <div className="space-y-2">
                    <span className="text-[10px] tracking-wider uppercase text-zinc-400 block">
                      ACTIVE WAITING LOBBY
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="font-sans text-5xl sm:text-6xl font-black text-red-500 tracking-widest drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]">
                        {roomCode}
                      </div>
                      <button
                        onClick={() => {
                          if (roomCode) navigator.clipboard.writeText(roomCode);
                          notify("Room code copied to clipboard!");
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-zinc-700 text-xs font-sans text-zinc-300 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-sans text-zinc-400">
                        WAITING FOR PLAYERS TO JOIN (SCAN QR OR ENTER CODE)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleStartGame}
                      disabled={actionBusy === "start" || participants.length === 0}
                      className="py-3 px-6 rounded-2xl bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50"
                    >
                      {actionBusy === "start" ? "Launching Match..." : `Start Game (${participants.length} Players)`}
                    </button>
                    <a
                      href={`/spectator/${roomCode}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-3 px-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      <span>Open Spectator</span>
                      <span>↗</span>
                    </a>
                    <button
                      onClick={handleCancelRoom}
                      disabled={actionBusy === "cancel"}
                      className="py-3 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-zinc-400 hover:text-red-400 border border-white/[0.08] text-xs font-bold uppercase tracking-wider uppercase transition-colors"
                    >
                      Cancel Room
                    </button>
                  </div>
                </div>

                {/* QR Code and Instructions Banner */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider font-bold uppercase text-white tracking-wider">
                      Player Join Instructions
                    </h3>
                    <div className="text-xs font-sans text-zinc-400 space-y-1.5">
                      <p>1. Players open: <span className="text-white font-bold">{typeof window !== "undefined" ? window.location.host : ""}/join</span></p>
                      <p>2. Log in using their <span className="text-[#00F0FF] font-bold">College Registration ID</span> & password</p>
                      <p>3. Enter active Room Code: <span className="text-red-400 font-bold">{roomCode}</span></p>
                      <p className="text-[11px] text-zinc-500 pt-1">
                        Only ISA-approved accounts can enter the game. Unapproved students will see a pending banner.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-2xl shadow-lg flex-shrink-0">
                    <QRCode value={joinUrl} size={130} />
                  </div>
                </div>

                {/* Live Joined Players Table */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider font-bold uppercase text-white tracking-wider flex items-center gap-2">
                      <span>Connected Players Manifest</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-xs text-red-400 font-bold">
                        {participants.length} / {game?.maxPlayers || 30}
                      </span>
                    </h3>
                    <span className="text-xs font-sans text-zinc-500">
                      Live sync via Supabase Realtime
                    </span>
                  </div>

                  {participants.length === 0 ? (
                    <div className="py-16 text-center text-zinc-600 text-xs font-bold uppercase tracking-wider space-y-2">
                      <p className="text-zinc-400 font-bold text-sm">0 players currently connected.</p>
                      <p className="text-[11px] text-zinc-600">
                        When approved students join via /join, their player tags will appear here immediately.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5 truncate pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-sans text-yellow-400 font-black">
                                #{p.badge || String(p.playerNumber).padStart(2, "0")}
                              </span>
                              <span className="font-bold text-white truncate">{p.name}</span>
                            </div>
                            {p.collegeRegId && (
                              <div className="text-[10px] font-sans text-zinc-500">
                                ID: {p.collegeRegId}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[9px] font-sans text-[#B6FF3B] bg-[#B6FF3B]/10/60 border border-[#B6FF3B]/20 px-1.5 py-0.5 rounded uppercase font-bold">
                              READY
                            </span>
                            <button
                              onClick={() => handlePeopleAction("kick_game", undefined, p.id)}
                              className="text-[10px] text-zinc-600 hover:text-red-400 font-sans px-1"
                              title="Remove from room"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STATE 3: LIVE MATCH MONITOR                                   */}
            {/* ------------------------------------------------------------- */}
            {isLive && (
              <div className="space-y-6">
                {/* Live Status Bar */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-3.5 h-3.5 rounded-full ${
                        gameStatus === "LIVE"
                          ? "bg-emerald-500 animate-ping"
                          : "bg-red-500 animate-pulse"
                      }`}
                    />
                    <div>
                      <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                        Room {roomCode} — {gameStatus}
                      </h2>
                      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-zinc-400 mt-1">
                        <span className="text-[#B6FF3B] font-bold">{aliveCount} Alive</span>
                        <span>•</span>
                        <span className="text-zinc-500">{eliminatedCount} Eliminated</span>
                        <span>•</span>
                        <span className="text-red-400 font-bold">{impostorCount} Impostors</span>
                      </div>
                    </div>
                  </div>

                  {/* Host Control Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCallEmergencyMeeting}
                      disabled={actionBusy === "meeting"}
                      className="px-4 py-2.5 rounded-2xl bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider shadow-lg shadow-red-950/50"
                    >
                      Call Meeting
                    </button>
                    <button
                      onClick={handlePauseToggle}
                      disabled={actionBusy === "pause"}
                      className="px-3.5 py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] transition-colors text-zinc-200 text-xs font-bold uppercase tracking-wider uppercase"
                    >
                      {gameStatus === "PAUSED" ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={() => handleDeclareWinner("ENGINEERS")}
                      className="px-3 py-2.5 rounded-2xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase tracking-wider"
                    >
                      Engineers Win
                    </button>
                    <button
                      onClick={() => handleDeclareWinner("IMPOSTERS")}
                      className="px-3 py-2.5 rounded-2xl bg-red-950 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider"
                    >
                      Impostors Win
                    </button>
                    <button
                      onClick={handleCancelRoom}
                      className="px-3 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-zinc-500 hover:text-red-400 border border-white/[0.08] text-xs font-bold uppercase tracking-wider"
                    >
                      End Match
                    </button>
                  </div>
                </div>

                {/* Task Progress & Player Roster */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    {/* Task Progress */}
                    <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-5 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between text-xs font-sans">
                        <span className="text-zinc-400 uppercase">Engineer Campus Tasks</span>
                        <span className="text-[#B6FF3B] font-bold text-sm">
                          {state?.taskProgress?.percentage || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-3.5 rounded-full overflow-hidden border border-white/[0.08]">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${state?.taskProgress?.percentage || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Player Matrix */}
                    <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-5 space-y-4 shadow-xl">
                      <h3 className="text-xs font-bold uppercase tracking-wider font-bold uppercase text-zinc-400 tracking-wider">
                        Player Status Manifest
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {participants.map((p) => (
                          <div
                            key={p.id}
                            className={`p-3 rounded-2xl border text-xs font-sans flex items-center justify-between ${
                              p.status === "ELIMINATED"
                                ? "bg-[#12121A]/40 backdrop-blur-[20px] border-zinc-900 text-zinc-600 line-through opacity-50"
                                : p.role === "IMPOSTER"
                                ? "bg-red-950/30 border-red-900 text-red-200"
                                : "bg-zinc-900/60 border-zinc-800 text-white"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="text-yellow-400 font-bold mr-1.5">
                                #{p.badge || String(p.playerNumber).padStart(2, "0")}
                              </span>
                              <span>{p.name}</span>
                            </div>
                            <span className="text-[9px] uppercase font-bold">
                              {p.status === "ELIMINATED" ? "DEAD" : p.role || "ALIVE"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Event Feed */}
                  <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-5 space-y-3 shadow-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider font-bold uppercase text-zinc-400 tracking-wider">
                      Live Event Feed
                    </h3>
                    <div className="space-y-2 text-xs font-sans max-h-80 overflow-y-auto">
                      {!state?.recentAuditLog || state.recentAuditLog.length === 0 ? (
                        <p className="text-zinc-600 text-center py-10">No events yet.</p>
                      ) : (
                        state.recentAuditLog.map((log) => (
                          <div
                            key={log.id}
                            className="p-2 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex items-center justify-between text-[11px]"
                          >
                            <span className="text-zinc-300">{log.action}</span>
                            <span className="text-zinc-600 text-[9px]">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================= */}
        {/* TAB 2: PEOPLE DATABASE (STUDENT ACCOUNTS & ROSTER)            */}
        {/* ============================================================= */}
        {activeTab === "people" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px] p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold uppercase text-white font-sans tracking-wider">
                    Student Accounts & Registry
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Manage college registration IDs, approval status, and active room participation.
                  </p>
                </div>

                {peopleStats.pendingCount > 0 && (
                  <button
                    onClick={handleApproveAllAccounts}
                    disabled={actionBusy === "approve-all"}
                    className="px-4 py-2 rounded-2xl bg-[#B6FF3B] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(182,255,59,0.4)] text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-950/40"
                  >
                    Approve All Pending ({peopleStats.pendingCount})
                  </button>
                )}
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder="Search by student name or college Reg ID..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-900 border border-white/[0.08] text-white text-xs font-bold uppercase tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "ALL", label: "All", count: peopleStats.totalAccounts },
                    { id: "PENDING", label: "Pending", count: peopleStats.pendingCount },
                    { id: "APPROVED", label: "Approved", count: peopleStats.approvedCount },
                    { id: "IN_GAME", label: "In Game", count: peopleStats.inGameCount },
                    { id: "REJECTED", label: "Rejected" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setPeopleFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                        peopleFilter === f.id
                          ? "bg-red-600 text-white font-bold"
                          : "bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-zinc-400 border border-white/[0.08]"
                      }`}
                    >
                      <span>{f.label}</span>
                      {f.count !== undefined && (
                        <span className="text-[10px] opacity-75">({f.count})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* People Table */}
              <div className="overflow-x-auto pt-2">
                {peopleLoading ? (
                  <div className="py-16 text-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    Loading student database...
                  </div>
                ) : people.length === 0 ? (
                  <div className="py-16 text-center text-zinc-600 text-xs font-bold uppercase tracking-wider space-y-1">
                    <p>No student accounts match the current filter.</p>
                    <p className="text-[11px] text-zinc-700">
                      Students register at /register with their Full Name and College Reg ID.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Student Name</th>
                        <th className="pb-3 font-semibold">College Reg ID</th>
                        <th className="pb-3 font-semibold">Account Status</th>
                        <th className="pb-3 font-semibold">Current Game</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {people.map((person) => {
                        const inGame = person.activeParticipation;
                        return (
                          <tr key={person.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="py-3.5 pr-4">
                              <span className="font-bold text-white">{person.fullName}</span>
                              <div className="text-[10px] text-zinc-500">
                                Registered {new Date(person.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3.5 pr-4 text-[#00F0FF] font-bold">
                              {person.collegeRegId}
                            </td>
                            <td className="py-3.5 pr-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  person.approvalStatus === "APPROVED"
                                    ? "bg-[#B6FF3B]/10/70 text-[#B6FF3B] border border-emerald-500/30"
                                    : person.approvalStatus === "PENDING"
                                    ? "bg-amber-950/70 text-amber-300 border border-amber-500/30 animate-pulse"
                                    : "bg-red-950/70 text-red-400 border border-red-500/30"
                                }`}
                              >
                                {person.approvalStatus}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4">
                              {inGame ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-red-400">{inGame.roomCode}</span>
                                    <span className="text-yellow-400 font-bold">
                                      #{(inGame as { badge?: string | null }).badge || String(inGame.playerNumber).padStart(2, "0")}
                                    </span>
                                  </div>
                                  <span className="text-[9px] uppercase px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                                    {inGame.status}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="py-3.5 text-right space-x-1.5">
                              {person.approvalStatus === "PENDING" && (
                                <>
                                  <button
                                    onClick={() => handlePeopleAction("approve", person.id)}
                                    disabled={actionBusy === `approve-${person.id}`}
                                    className="px-2.5 py-1 rounded bg-[#B6FF3B] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(182,255,59,0.4)] text-white text-[11px] font-bold uppercase transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handlePeopleAction("reject", person.id)}
                                    disabled={actionBusy === `reject-${person.id}`}
                                    className="px-2 py-1 rounded bg-white/[0.08] hover:bg-white/[0.12] transition-colors text-zinc-400 text-[11px] transition-colors"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {person.approvalStatus === "APPROVED" && (
                                <>
                                  {!inGame && roomCode && (
                                    <button
                                      onClick={() => handlePeopleAction("add_to_game", person.id)}
                                      disabled={actionBusy === `add-${person.id}`}
                                      className="px-2 py-1 rounded bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] font-bold hover:bg-red-900 transition-colors"
                                      title="Add player to active room midgame"
                                    >
                                      + Add to Game
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handlePeopleAction("reject", person.id)}
                                    disabled={actionBusy === `reject-${person.id}`}
                                    className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-zinc-700 text-zinc-400 text-[11px] transition-colors"
                                    title="Revoke approval"
                                  >
                                    Revoke
                                  </button>
                                </>
                              )}

                              {person.approvalStatus === "REJECTED" && (
                                <button
                                  onClick={() => handlePeopleAction("approve", person.id)}
                                  disabled={actionBusy === `approve-${person.id}`}
                                  className="px-2 py-1 rounded bg-[#B6FF3B]/10 border border-[#B6FF3B]/20 text-[#B6FF3B] text-[11px] font-bold transition-colors"
                                >
                                  Re-Approve
                                </button>
                              )}

                              {inGame && (
                                <button
                                  onClick={() =>
                                    handlePeopleAction("kick_game", undefined, inGame.participantId)
                                  }
                                  className="px-2 py-1 rounded bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] transition-colors"
                                  title="Remove player from active room"
                                >
                                  Kick
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (confirm(`Permanently delete account for ${person.fullName}?`)) {
                                    handlePeopleAction("delete_account", person.id);
                                  }
                                }}
                                className="px-1.5 py-1 text-zinc-600 hover:text-red-400 text-[11px] transition-colors"
                                title="Delete account record"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* COMPACT APPROVALS DRAWER / MODAL                              */}
        {/* ------------------------------------------------------------- */}
        {showApprovals && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-[#12121A]/40 backdrop-blur-[20px] border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase font-sans tracking-wider">
                    Student Account Approvals
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Verify student IDs and activate their accounts for game participation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingAccounts.length > 0 && (
                    <button
                      onClick={handleApproveAllAccounts}
                      disabled={actionBusy === "approve-all"}
                      className="px-3 py-1.5 rounded-xl bg-[#B6FF3B] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(182,255,59,0.4)] text-white text-xs font-bold uppercase tracking-wider font-bold uppercase transition-colors"
                    >
                      Approve All ({pendingAccounts.length})
                    </button>
                  )}
                  <button
                    onClick={() => setShowApprovals(false)}
                    className="p-1.5 text-zinc-500 hover:text-white text-sm font-bold uppercase tracking-wider"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {pendingAccounts.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                  No accounts waiting for approval.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-2xl border border-white/[0.08] bg-zinc-900/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">{acc.fullName}</div>
                        <div className="text-[11px] font-sans text-[#00F0FF]">
                          ID: {acc.collegeRegId}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveAccount(acc.id, "approve")}
                          disabled={actionBusy === `acc-${acc.id}`}
                          className="px-3 py-1.5 rounded-xl bg-[#B6FF3B] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(182,255,59,0.4)] text-white text-xs font-bold uppercase tracking-wider font-bold uppercase transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveAccount(acc.id, "reject")}
                          disabled={actionBusy === `acc-${acc.id}`}
                          className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] transition-colors text-zinc-400 text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
