"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Camera, MessageSquare } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  requiresPhoto: boolean;
  requiresAnswer: boolean;
  forImposter: boolean;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
  points: number;
}

export function TasksTab({ gameStatus }: { gameStatus: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // New task form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [requiresAnswer, setRequiresAnswer] = useState(false);
  const [forImposter, setForImposter] = useState(false);
  const [points, setPoints] = useState(1);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "EXPERT">("EASY");
  
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    void fetchTasks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/game/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          requiresPhoto,
          requiresAnswer,
          points,
          difficulty
        }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setRequiresPhoto(false);
        setRequiresAnswer(false);
        setPoints(1);
        setDifficulty("EASY");
        await fetchTasks();
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

  if (loading) {
    return <div className="text-zinc-500 font-mono text-sm text-center py-10">LOADING TASKS...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">Match Tasks</h2>
          <p className="text-sm text-zinc-400">
            Create tasks that engineers must complete to survive. 
            {gameStatus !== "SETUP" && " (Game is already started, assigning new tasks may not affect current rounds)"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CREATE TASK FORM */}
        <div className="lg:col-span-1 border border-white/[0.08] rounded-[2.5rem] bg-[#12121A]/60 backdrop-blur-[30px] p-6 h-fit">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" /> Add New Task
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">

            <div>
              <label className="block text-xs font-sans uppercase text-zinc-400 mb-1">Task Assignment</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForImposter(false)}
                  className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-colors ${!forImposter ? 'bg-[#00F0FF]/10 border-[#00F0FF]/50 text-[#00F0FF]' : 'bg-black/50 border-white/[0.08] text-zinc-400 hover:border-white/[0.2]'}`}
                >
                  Crewmates
                </button>
                <button
                  type="button"
                  onClick={() => setForImposter(true)}
                  className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-colors ${forImposter ? 'bg-[#FF3B5C]/10 border-[#FF3B5C]/50 text-[#FF3B5C]' : 'bg-black/50 border-white/[0.08] text-zinc-400 hover:border-white/[0.2]'}`}
                >
                  Imposters
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-sans uppercase text-zinc-400 mb-1">Title</label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fix Navigation Array"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF]"
              />
            </div>
            
            <div>
              <label className="block text-xs font-sans uppercase text-zinc-400 mb-1">Description</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Steps to complete the task..."
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-sans uppercase text-zinc-400 mb-1">Points</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00F0FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-sans uppercase text-zinc-400 mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
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
                <span className="text-sm text-zinc-300 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-zinc-500" /> Require Photo Upload
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresAnswer}
                  onChange={(e) => setRequiresAnswer(e.target.checked)}
                  className="rounded border-white/[0.08] bg-black/50 text-[#00F0FF] focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-sm text-zinc-300 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-zinc-500" /> Require Text Answer
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 bg-[#00F0FF] text-black font-black uppercase tracking-wider text-sm rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Task"}
            </button>
          </form>
        </div>


        {/* TASK LIST */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* CREWMATE TASKS */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#00F0FF] mb-2 flex items-center gap-2">
              Crewmate Objectives ({tasks.filter((t) => !t.forImposter).length})
            </h3>
            {tasks.filter((t) => !t.forImposter).length === 0 ? (
              <div className="border border-white/[0.08] rounded-[2.5rem] bg-[#12121A]/60 backdrop-blur-[30px] p-8 text-center">
                <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">No Crewmate tasks</p>
              </div>
            ) : (
              tasks.filter((t) => !t.forImposter).map((task) => (
                <div key={task.id} className="group relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-white/[0.04] bg-[#0A0A0E]/80 backdrop-blur-md p-4 rounded-2xl hover:border-[#00F0FF]/30 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-bold text-base">{task.title}</h4>
                      <span className="px-2 py-0.5 rounded border border-white/[0.08] text-[10px] uppercase font-bold text-zinc-400 bg-white/[0.02]">
                        {task.difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] font-mono text-emerald-400 bg-emerald-500/10">
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
                    className="p-3 text-zinc-600 hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/10 rounded-xl transition-colors shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* IMPOSTER TASKS */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#FF3B5C] mb-2 flex items-center gap-2">
              Imposter Objectives ({tasks.filter((t) => t.forImposter).length})
            </h3>
            {tasks.filter((t) => t.forImposter).length === 0 ? (
              <div className="border border-white/[0.08] rounded-[2.5rem] bg-[#12121A]/60 backdrop-blur-[30px] p-8 text-center">
                <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">No Imposter tasks</p>
              </div>
            ) : (
              tasks.filter((t) => t.forImposter).map((task) => (
                <div key={task.id} className="group relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-white/[0.04] bg-[#0A0A0E]/80 backdrop-blur-md p-4 rounded-2xl hover:border-[#FF3B5C]/30 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-bold text-base">{task.title}</h4>
                      <span className="px-2 py-0.5 rounded border border-[#FF3B5C]/30 text-[10px] uppercase font-bold text-[#FF3B5C] bg-[#FF3B5C]/10">
                        SABOTAGE
                      </span>
                      <span className="px-2 py-0.5 rounded border border-white/[0.08] text-[10px] uppercase font-bold text-zinc-400 bg-white/[0.02]">
                        {task.difficulty}
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
                    className="p-3 text-zinc-600 hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/10 rounded-xl transition-colors shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
