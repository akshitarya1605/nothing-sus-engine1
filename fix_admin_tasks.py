import re

with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

# Add necessary imports if they are not there:
if "import { useState, useEffect } from 'react';" not in content:
    content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";')
if "import { Trash2, Plus, Camera, MessageSquare } from \"lucide-react\";" not in content:
    content = content.replace('import { Users, Gauge, Siren, Ghost, ShieldAlert, Cpu, Activity, Play, Settings2 } from "lucide-react";', 'import { Users, Gauge, Siren, Ghost, ShieldAlert, Cpu, Activity, Play, Settings2, Trash2, Plus, Camera, MessageSquare } from "lucide-react";')

old_tasks_panel = """function TasksPanel({ points, live }: { points: number; live: LiveState["taskProgress"] | null }) {
  const pct = Math.min(100, Math.round((points / POINT_TARGET) * 100));
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-white/[0.06] bg-black/25 p-6">
        <div className="relative">
          <ProgressRing value={pct / 100} />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-4xl font-extrabold tabular-nums tracking-[-0.04em] text-white">{pct}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">of target</p>
            </div>
          </div>
        </div>
        <p className="mt-5 font-mono text-sm text-zinc-300">
          {points.toLocaleString("en-IN")} <span className="text-zinc-600">/ {POINT_TARGET.toLocaleString("en-IN")}</span>
        </p>
        {live && (
          <p className="mt-2 text-xs text-zinc-500">
            {live.completed} completed · {live.inPlay} in play
          </p>
        )}
        <p className="mt-4 rounded-full border border-[#00F0FF]/20 bg-[#00F0FF]/[0.06] px-3 py-1 text-[11px] font-semibold text-[#7FF7FF]">
          {(POINT_TARGET - points).toLocaleString("en-IN")} pts to crew victory
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {DISCIPLINES.map((d) => {
          const Icon = d.icon;
          const p = Math.round((d.done / d.total) * 100);
          return (
            <li
              key={d.key}
              className="group rounded-[2.5rem] border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.035]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.06] bg-black/30 text-zinc-400 transition-colors group-hover:text-[#00F0FF]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-white">{d.label}</p>
                    <p className="shrink-0 font-mono text-xs text-zinc-400">
                      {d.done}/{d.total} <span className="text-zinc-600">tasks</span>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6]" style={{ width: `${p}%` }} />
                    </div>
                    <span className="w-16 text-right font-mono text-[11px] text-[#7FF7FF]">{d.points.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}"""

new_tasks_panel = """
function TasksPanel({ points, live }: { points: number; live: LiveState["taskProgress"] | null }) {
  const pct = Math.min(100, Math.round((points / POINT_TARGET) * 100));
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsVal, setPointsVal] = useState(10);
  const [difficulty, setDifficulty] = useState("EASY");
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresAnswer, setRequiresAnswer] = useState(false);
  const [forImposter, setForImposter] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/game/tasks");
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/game/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, points: pointsVal, difficulty, requiresPhoto, requiresAnswer, forImposter }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks([data.task, ...tasks]);
        setTitle("");
        setDescription("");
        setPointsVal(10);
        setRequiresPhoto(false);
        setRequiresAnswer(false);
        setForImposter(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await fetch(`/api/game/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const taskTabs = [
    { id: "crewmate", label: "Crewmate" },
    { id: "imposter", label: "Imposter" },
  ];
  const [activeTaskTab, setActiveTaskTab] = useState<"crewmate" | "imposter">("crewmate");

  const filteredTasks = tasks.filter(t => activeTaskTab === "imposter" ? t.forImposter : !t.forImposter);

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      {/* ADD TASK PANEL */}
      <div className="flex flex-col border border-white/[0.06] bg-black/25 rounded-[2.5rem] p-6 h-fit relative overflow-hidden">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4 flex items-center gap-2 relative z-10">
          <Plus className="w-4 h-4 text-emerald-400" /> Add New Mission
        </h3>
        <form onSubmit={handleCreate} className="space-y-4 relative z-10">
          <div>
            <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 mb-1">Target Audience</label>
            <SegmentedTabs 
              label="Audience" 
              idPrefix="task-audience" 
              value={forImposter ? "imposter" : "crewmate"} 
              onChange={(v) => setForImposter(v === "imposter")}
              items={[
                { id: "crewmate", label: "Crewmates" },
                { id: "imposter", label: "Imposters" }
              ]} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 mb-1">Title</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix Navigation Array"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF] transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 mb-1">Problem Statement</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Steps to complete the task..."
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF] resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 mb-1">Points</label>
              <input
                required
                type="number"
                min="1"
                value={pointsVal}
                onChange={(e) => setPointsVal(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
                <option value="EXPERT">EXPERT</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/[0.08]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresPhoto}
                onChange={(e) => setRequiresPhoto(e.target.checked)}
                className="rounded border-white/[0.08] bg-black/50 text-[#00F0FF] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <Camera className="w-3.5 h-3.5 text-zinc-500" /> Require Photo Upload
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresAnswer}
                onChange={(e) => setRequiresAnswer(e.target.checked)}
                className="rounded border-white/[0.08] bg-black/50 text-[#00F0FF] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-500" /> Require Text Answer
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full mt-2 py-3 font-black uppercase tracking-widest text-xs rounded-xl transition-all duration-300 shadow-xl disabled:opacity-50 ${forImposter ? 'bg-[#FF3B5C] text-[#0B0B0F] shadow-[0_0_15px_rgba(255,59,92,0.4)] hover:bg-white' : 'bg-[#00F0FF] text-[#0B0B0F] shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:bg-white'}`}
          >
            {submitting ? "Adding..." : "Inject Matrix Task"}
          </button>
        </form>
        
        {/* Glow behind the panel */}
        <div className={`absolute -bottom-10 -right-10 w-40 h-40 blur-3xl opacity-20 transition-colors ${forImposter ? 'bg-[#FF3B5C]' : 'bg-[#00F0FF]'} pointer-events-none`} />
      </div>

      {/* TASK LIST */}
      <div className="flex flex-col">
        <div className="mb-4">
          <SegmentedTabs 
            label="Matrix List" 
            idPrefix="matrix-list" 
            value={activeTaskTab} 
            onChange={(v) => setActiveTaskTab(v as "crewmate" | "imposter")}
            items={taskTabs} 
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-3">
          {loading ? (
            <div className="py-10 text-center font-mono text-xs uppercase tracking-widest text-zinc-600 animate-pulse">Syncing Matrix...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="border border-white/[0.04] bg-white/[0.01] rounded-[2.5rem] p-10 text-center">
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">No matrix objectives found</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div key={task.id} className="group relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-white/[0.04] bg-[#0A0A0E]/80 backdrop-blur-md p-4 rounded-2xl hover:border-white/[0.1] transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-white font-bold text-base">{task.title}</h4>
                    <span className="px-2 py-0.5 rounded border border-white/[0.08] text-[10px] uppercase font-bold text-zinc-400 bg-white/[0.02]">
                      {task.difficulty}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono bg-opacity-10 ${task.forImposter ? 'border-[#FF3B5C]/30 text-[#FF3B5C] bg-[#FF3B5C]/10' : 'border-[#00F0FF]/30 text-[#00F0FF] bg-[#00F0FF]/10'}`}>
                      +{task.points} PTS
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2">{task.description}</p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    {task.requiresPhoto && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                        <Camera className="w-3 h-3" /> Photo Reqd
                      </span>
                    )}
                    {task.requiresAnswer && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                        <MessageSquare className="w-3 h-3" /> Answer Reqd
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-3 text-zinc-600 hover:text-[#FF3B5C] hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
"""

content = content.replace(old_tasks_panel, new_tasks_panel)

# Also fix the SegmentedTabs active state glow to support the "imposter" active state
# SegmentedTabs doesn't inherently know red vs blue unless we pass a prop or change the color based on the selected value
# We can modify SegmentedTabs to use the value to pick the glow color:
segmented_tabs_old = """      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/[0.1] shadow-[0_0_24px_-6px_rgba(0,240,255,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${items.length})`, transform: `translateX(${idx * 100}%)` }}
      />"""

segmented_tabs_new = """      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 rounded-full border transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${value === 'imposter' ? 'border-[#FF3B5C]/40 bg-[#FF3B5C]/[0.15] shadow-[0_0_24px_-6px_rgba(255,59,92,0.6)]' : 'border-[#00F0FF]/40 bg-[#00F0FF]/[0.1] shadow-[0_0_24px_-6px_rgba(0,240,255,0.6)]'}`}
        style={{ width: `calc((100% - 0.5rem) / ${items.length})`, transform: `translateX(${idx * 100}%)` }}
      />"""

content = content.replace(segmented_tabs_old, segmented_tabs_new)

# Add active text color to segment tab items
item_old = """            <span className={cn("relative z-10 font-bold uppercase tracking-wider transition-colors", active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")}>"""
item_new = """            <span className={cn("relative z-10 font-bold uppercase tracking-wider transition-colors", active ? (item.id === "imposter" ? "text-[#FF3B5C]" : "text-white") : "text-zinc-500 group-hover:text-zinc-300")}>"""
content = content.replace(item_old, item_new)

with open("src/app/admin/page.tsx", "w") as f:
    f.write(content)

