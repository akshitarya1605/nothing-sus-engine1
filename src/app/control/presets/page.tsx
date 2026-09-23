"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IsaHeader } from "@/components/ui/IsaHeader";

interface PresetTask {
  id?: string;
  title: string;
  description: string;
  roomName?: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
  points: number;
  estimatedMinutes: number;
  roundNumber: number;
}

interface GamePreset {
  id: string;
  name: string;
  description?: string | null;
  maxPlayers: number;
  imposterCount: number;
  killCooldownSeconds: number;
  weaponLocation?: string | null;
  weaponClue?: string | null;
  totalRounds: number;
  tasks: PresetTask[];
  createdAt: string;
}

export default function PresetsControlPage() {
  const [presets, setPresets] = useState<GamePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // New preset form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(30);
  const [imposterCount, setImposterCount] = useState(3);
  const [killCooldownSeconds, setKillCooldownSeconds] = useState(60);
  const [weaponLocation, setWeaponLocation] = useState("Room 302, Under Podium");
  const [weaponClue, setWeaponClue] = useState("Near the robotics bench");
  const [tasks, setTasks] = useState<PresetTask[]>([
    {
      title: "Calibrate Oscilloscope",
      description: "Match frequency waveform to 1000Hz on channel 1.",
      roomName: "Robotics Lab (AB1-204)",
      difficulty: "EASY",
      points: 15,
      estimatedMinutes: 5,
      roundNumber: 1,
    },
    {
      title: "Inspect Server Rack Breakers",
      description: "Ensure green LEDs on phase 3 power supply.",
      roomName: "Server Room (AB2-101)",
      difficulty: "MEDIUM",
      points: 25,
      estimatedMinutes: 8,
      roundNumber: 1,
    },
    {
      title: "Archive Microcontroller Code",
      description: "Deposit the encrypted memory cartridge with staff.",
      roomName: "IoT Center (AB3-305)",
      difficulty: "HARD",
      points: 40,
      estimatedMinutes: 10,
      roundNumber: 2,
    },
  ]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/game/presets", { cache: "no-store" });
      if (res.ok) {
        setPresets(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const notify = (msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAddTask = () => {
    setTasks([
      ...tasks,
      {
        title: "New Objective",
        description: "Task description and verification steps.",
        roomName: "Campus Zone",
        difficulty: "EASY",
        points: 10,
        estimatedMinutes: 5,
        roundNumber: 1,
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleTaskChange = (index: number, field: keyof PresetTask, val: unknown) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: val };
    setTasks(updated);
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify("Please enter a preset name", "err");
      return;
    }

    setActionBusy("create");
    try {
      const res = await fetch("/api/game/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          maxPlayers,
          imposterCount,
          killCooldownSeconds,
          weaponLocation: weaponLocation.trim() || undefined,
          weaponClue: weaponClue.trim() || undefined,
          tasks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create preset");

      notify("Preset created successfully!");
      setShowCreateModal(false);
      setName("");
      setDescription("");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Creation failed", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleDelete = async (presetId: string) => {
    if (!confirm("Are you sure you want to delete this preset template?")) return;
    setActionBusy(presetId);
    try {
      const res = await fetch("/api/game/presets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      notify("Preset deleted");
      await refresh();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Deletion failed", "err");
    } finally {
      setActionBusy(null);
    }
  };

  const handleLoadIntoGame = async (preset: GamePreset) => {
    if (!confirm(`Apply preset "${preset.name}" and generate room? This resets game to LOBBY.`)) return;
    setActionBusy(`load-${preset.id}`);
    try {
      const res = await fetch("/api/game/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: preset.id,
          maxPlayers: preset.maxPlayers,
          imposterCount: preset.imposterCount,
          killCooldownSeconds: preset.killCooldownSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load preset");
      notify(`Preset loaded! Room Code: ${data.roomCode}`);
      window.location.href = "/control";
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to load preset into room", "err");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col selection:bg-red-500/30">
      <IsaHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
                GAME ARCHITECT
              </span>
              <span className="text-xs font-mono text-zinc-500">TASK & ROOM PRESETS</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1 text-zinc-100">
              Game Presets & Blueprints
            </h1>
            <p className="text-xs text-zinc-400">
              Pre-configure physical campus tasks, zones, clues, and rules to launch games with 1 click.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/control"
              className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-mono font-medium text-zinc-200 transition-colors"
            >
              ← Back to Game Control
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/40"
            >
              + Create New Preset
            </button>
          </div>
        </div>

        {toast && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono ${
              toast.kind === "ok"
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/80 border-red-500/40 text-red-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-zinc-500 font-mono">
              Loading presets...
            </div>
          ) : presets.length === 0 ? (
            <div className="col-span-full py-16 text-center rounded-xl border border-zinc-800 bg-zinc-950/60 p-8 space-y-3">
              <p className="text-sm font-semibold text-zinc-300">No game presets found</p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Create your first preset template with physical campus tasks, room numbers, and weapon locations.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono uppercase tracking-wider"
              >
                Create Preset Now
              </button>
            </div>
          ) : (
            presets.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-lg shadow-black/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base tracking-tight">{p.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                      {p.tasks.length} Tasks
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/80 text-[11px] font-mono">
                    <div>
                      <span className="text-zinc-500 block text-[9px]">MAX PLAYERS</span>
                      <span className="text-zinc-200">{p.maxPlayers} Players</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[9px]">IMPOSTORS</span>
                      <span className="text-red-400 font-bold">{p.imposterCount} Impostors</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[9px]">KILL COOLDOWN</span>
                      <span className="text-zinc-200">{p.killCooldownSeconds}s</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[9px]">WEAPON LOCATION</span>
                      <span className="text-amber-400 truncate block">
                        {p.weaponLocation || "Unset"}
                      </span>
                    </div>
                  </div>

                  {/* Task list preview */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                      Task Highlights
                    </span>
                    {p.tasks.slice(0, 3).map((t, i) => (
                      <div
                        key={i}
                        className="text-xs text-zinc-300 flex items-center justify-between bg-zinc-900/60 px-2 py-1 rounded"
                      >
                        <span className="truncate pr-2">{t.title}</span>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {t.roomName || `${t.points} pts`}
                        </span>
                      </div>
                    ))}
                    {p.tasks.length > 3 && (
                      <span className="text-[10px] font-mono text-zinc-500 italic block text-right">
                        +{p.tasks.length - 3} more tasks...
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center gap-2">
                  <button
                    onClick={() => handleLoadIntoGame(p)}
                    disabled={actionBusy === `load-${p.id}`}
                    className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    {actionBusy === `load-${p.id}` ? "Loading..." : "Load into Game"}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={actionBusy === p.id}
                    className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 font-mono text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Create Preset */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Create Game Preset</h2>
                  <p className="text-xs text-zinc-400">Configure tasks and gameplay parameters</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-500 hover:text-white font-mono text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePreset} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Preset Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Campus Round 1 - AB1 Engineering Lab Setup"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. 30 players, 3 impostors, AB1 Ground + 2nd floor tasks"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Max Players
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={100}
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Impostor Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={imposterCount}
                      onChange={(e) => setImposterCount(parseInt(e.target.value) || 3)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Kill Cooldown (Seconds)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={killCooldownSeconds}
                      onChange={(e) => setKillCooldownSeconds(parseInt(e.target.value) || 60)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Weapon Physical Location
                    </label>
                    <input
                      type="text"
                      value={weaponLocation}
                      onChange={(e) => setWeaponLocation(e.target.value)}
                      placeholder="e.g. AB1 Room 302, Under Podium"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                      Weapon Clue (Shown to Impostor)
                    </label>
                    <input
                      type="text"
                      value={weaponClue}
                      onChange={(e) => setWeaponClue(e.target.value)}
                      placeholder="e.g. Near the oscilloscope on the second workbench"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Tasks management in preset */}
                <div className="border-t border-zinc-800 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono uppercase">
                        Configured Tasks ({tasks.length})
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        Physical tasks students must find and complete using OTP codes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTask}
                      className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200"
                    >
                      + Add Task
                    </button>
                  </div>

                  <div className="space-y-3">
                    {tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">
                            Task #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTask(idx)}
                            className="text-xs text-red-400 hover:text-red-300 font-mono"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => handleTaskChange(idx, "title", e.target.value)}
                              placeholder="Task Title (e.g. Verify Router Status)"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={task.roomName || ""}
                              onChange={(e) => handleTaskChange(idx, "roomName", e.target.value)}
                              placeholder="Location / Room (e.g. AB1 Lab 204)"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={task.description}
                              onChange={(e) =>
                                handleTaskChange(idx, "description", e.target.value)
                              }
                              placeholder="Brief instructions for the student"
                              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">
                              Points:
                            </span>
                            <input
                              type="number"
                              min={5}
                              max={100}
                              value={task.points}
                              onChange={(e) =>
                                handleTaskChange(idx, "points", parseInt(e.target.value) || 10)
                              }
                              className="w-20 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-white"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">
                              Difficulty:
                            </span>
                            <select
                              value={task.difficulty}
                              onChange={(e) =>
                                handleTaskChange(
                                  idx,
                                  "difficulty",
                                  e.target.value as PresetTask["difficulty"]
                                )
                              }
                              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-white"
                            >
                              <option value="EASY">EASY</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="HARD">HARD</option>
                              <option value="EXPERT">EXPERT</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionBusy === "create"}
                    className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/40"
                  >
                    {actionBusy === "create" ? "Saving..." : "Save Preset Blueprint"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
