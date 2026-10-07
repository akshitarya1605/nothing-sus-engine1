import re

with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

# I will find the exact string of GhostPanel and replace it.
ghost_panel_regex = r"function GhostPanel\(\{ ghosts \}: \{ ghosts: Player\[\] \}\) \{.*?\}(?=\n\nexport default function)"
ghost_panel_match = re.search(ghost_panel_regex, content, re.DOTALL)

if not ghost_panel_match:
    print("Could not find GhostPanel!")
    # let's try finding the end of GhostPanel differently
    ghost_panel_regex = r"function GhostPanel\(\{ ghosts \}: \{ ghosts: Player\[\] \}\) \{.*?\n\}\n\n"
    ghost_panel_match = re.search(ghost_panel_regex, content, re.DOTALL)


if ghost_panel_match:
    old_panel = ghost_panel_match.group(0)
    
    new_panel = """function GhostPanel({ ghosts }: { ghosts: Player[] }) {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch("/api/game/tasks");
        const data = await res.json();
        if(data.success) {
          // Ghost tasks are Crewmate tasks
          setTasks(data.tasks.filter((t: any) => !t.forImposter));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="rounded-[2.5rem] border border-white/[0.06] bg-black/25 p-5 h-fit">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-white">In the lounge</p>
          <span className="rounded-full bg-[#8B5CF6]/15 px-2 py-0.5 font-mono text-xs text-[#C4B5FD]">{ghosts.length}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Silent zone · no talking to the living.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {ghosts.map((g) => (
            <li key={g.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2">
              <CrewGlyph color={g.color} dimmed className="h-6 w-6" />
              <span className="text-sm font-semibold text-zinc-300">{g.name}</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-600">#{String(g.num).padStart(2, "0")}</span>
            </li>
          ))}
          {ghosts.length === 0 && <li className="py-6 text-center text-xs text-zinc-600">No ghosts yet.</li>}
        </ul>
      </div>

      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center text-xs text-zinc-500 py-10">Syncing Ghost Directives...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-xs text-zinc-500 py-10 border border-dashed border-white/[0.08] rounded-2xl">
            No Crewmate objectives found in the Task Matrix.
          </div>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {tasks.map((t, i) => {
              const isSolved = solved.has(t.id);
              const isRevealed = revealed.has(t.id);
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex flex-col rounded-[2.5rem] border p-4 transition-all duration-300 hover:-translate-y-0.5",
                    isSolved ? "border-emerald-400/25 bg-emerald-400/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:border-[#8B5CF6]/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-zinc-600">MISSION {String(i + 1).padStart(2, "0")}</span>
                    {isSolved && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        <Check className="h-3 w-3" strokeWidth={3} /> Verified
                      </span>
                    )}
                  </div>
                  <p className="mt-2 flex-1 text-sm font-semibold leading-relaxed text-zinc-200">{t.title}</p>
                  {t.description && (
                    <p className="mt-1 text-xs text-zinc-400 font-mono leading-relaxed">{t.description}</p>
                  )}
                  <p
                    className={cn(
                      "mt-3 rounded-lg border border-dashed px-3 py-2 font-mono text-xs transition-all duration-300",
                      isRevealed ? "border-[#8B5CF6]/30 text-[#C4B5FD]" : "select-none border-white/[0.06] text-transparent [text-shadow:0_0_8px_rgba(255,255,255,0.5)]",
                    )}
                  >
                    OTP: {t.otpHash?.substring(0, 4) || "NO-OTP"} • {t.points} PTS
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRevealed((s) => toggle(s, t.id))}
                      className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[11px] font-bold text-zinc-300 transition-colors hover:text-white", FOCUS_RING)}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> {isRevealed ? "Hide Details" : "Show Details"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolved((s) => toggle(s, t.id))}
                      className={cn(
                        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-bold transition-colors",
                        isSolved ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20" : "border-transparent bg-[#8B5CF6]/15 text-[#C4B5FD] hover:bg-[#8B5CF6]/25 hover:text-white",
                        FOCUS_RING,
                      )}
                    >
                      {isSolved ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      {isSolved ? "Undo" : "Mark Verified"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
"""
    content = content.replace(old_panel, new_panel)
    with open("src/app/admin/page.tsx", "w") as f:
        f.write(content)
else:
    print("Could not find the function block to replace.")

