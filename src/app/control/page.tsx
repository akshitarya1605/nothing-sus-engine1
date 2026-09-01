"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminGameState } from "@/lib/game/state";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Badge, RolePill, StatusPill } from "@/components/ui/Badge";
import { ConnectionChip } from "@/components/ui/ConnectionChip";
import { ProgressBar } from "@/components/ui/Progress";
import { ConfirmModal } from "@/components/ui/Modal";

type State = AdminGameState;
type Tab = "setup" | "run" | "monitor";

export default function ControlPage() {
  const [state, setState] = useState<State | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("setup");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/game/state", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) setDenied(true);
      return;
    }
    setDenied(false);
    setState(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEvent = useCallback(() => void refresh(), [refresh]);
  const { status: rt } = useGameRealtime({ enabled: !denied, onEvent });

  const call = useCallback(
    async (path: string, body?: unknown): Promise<Record<string, unknown>> => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const b = await res.json().catch(() => ({}));
      setToast(res.ok ? null : { kind: "err", msg: b.message ?? "Action failed" });
      await refresh();
      return b;
    },
    [refresh],
  );

  const notify = (msg: string) => setToast({ kind: "ok", msg });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (denied) {
    return (
      <main className="ns-screen grid place-items-center bg-void">
        <p className="font-mono text-fg-faint">Open the control room from your admin link.</p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="ns-screen grid place-items-center bg-void">
        <p className="font-display text-2xl text-fg-faint">Loading control room…</p>
      </main>
    );
  }

  return (
    <main className="ns-screen bg-void px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Control Room</h1>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Badge tone={state.game.status === "LIVE" ? "green" : "neutral"}>{state.game.status}</Badge>
              {state.game.currentRoundNumber > 0 && (
                <span className="text-fg-dim">
                  Round {state.game.currentRoundNumber}
                  {state.game.currentPhase ? ` · ${state.game.currentPhase}` : ""}
                </span>
              )}
              {state.game.rolesLocked && <Badge tone="yellow">Roles locked</Badge>}
            </div>
          </div>
          <ConnectionChip status={rt} />
        </header>

        {toast && (
          <div
            className={cn(
              "mb-4 rounded-chunky border-[3px] border-ink px-4 py-2 text-sm",
              toast.kind === "ok" ? "bg-green/15 text-green" : "bg-red/15 text-red",
            )}
          >
            {toast.msg}
          </div>
        )}

        <nav className="mb-5 flex gap-2">
          {(["setup", "run", "monitor"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-pill border-[3px] border-ink px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide",
                tab === t ? "bg-yellow text-ink" : "bg-panel text-fg-dim",
              )}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "setup" && <SetupTab state={state} call={call} notify={notify} />}
        {tab === "run" && <RunTab state={state} call={call} notify={notify} />}
        {tab === "monitor" && <MonitorTab state={state} />}
      </div>
    </main>
  );
}

type CallFn = (path: string, body?: unknown) => Promise<Record<string, unknown>>;
type NotifyFn = (msg: string) => void;

/* ================================================================= SETUP */

function SetupTab({ state, call, notify }: { state: State; call: CallFn; notify: NotifyFn }) {
  const [imposterCount, setImposterCount] = useState(3);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => notify(`Copied ${label}`)).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <h2 className="mb-3 font-display text-lg">Links</h2>
        <div className="flex flex-col gap-2 text-sm">
          <LinkRow label="Control (this room)" url={`${origin}/control/${state.game.adminSecret}`} onCopy={copy} />
          <LinkRow label="Projector screen" url={`${origin}/spectator/${state.game.spectatorSecret}`} onCopy={copy} />
          <LinkRow label="Player join" url={`${origin}/play`} onCopy={copy} />
        </div>
        <a
          href={`/control/print`}
          target="_blank"
          className="mt-3 inline-block font-display text-sm text-cyan underline"
        >
          Open printable code cards →
        </a>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Roles</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-fg-dim">Imposters</label>
          <input
            type="number"
            min={0}
            value={imposterCount}
            onChange={(e) => setImposterCount(Math.max(0, Number(e.target.value)))}
            className="w-16 rounded-lg border-[3px] border-ink bg-elevated px-2 py-1 text-center"
          />
          <Button size="sm" onClick={() => call("/api/game/roles/assign", { imposterCount })}>
            Assign roles
          </Button>
          <Button size="sm" variant="ghost" onClick={() => call("/api/game/roles/lock")}>
            Lock roles
          </Button>
          <Button size="sm" variant="cyan" onClick={() => call("/api/game/rounds/ready")}>
            Mark game ready
          </Button>
        </div>
        <p className="mt-2 text-xs text-fg-faint">
          {state.participants.length} players ·{" "}
          {state.participants.filter((p) => p.role).length} with roles ·{" "}
          {state.game.rolesLocked ? "locked" : "unlocked"}
        </p>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Players ({state.participants.length})</h2>
        <AddPlayer call={call} />
        <BulkImport call={call} notify={notify} />
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-fg-faint">
              <tr>
                <th className="py-1">Name</th>
                <th>Code</th>
                <th>Group</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.participants.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-1.5">{p.name}</td>
                  <td className="font-mono">{p.code}</td>
                  <td className="text-fg-dim">{p.groupName ?? "—"}</td>
                  <td className="py-1 text-right">
                    <button
                      className="text-xs text-cyan"
                      onClick={async () => {
                        const r = await call("/api/game/participants/reset-code", { participantId: p.id });
                        if (r.code) notify(`${p.name}: new code ${r.code}`);
                      }}
                    >
                      reset code
                    </button>
                    {" · "}
                    <button
                      className="text-xs text-fg-faint"
                      onClick={() => call("/api/game/participants/force-logout", { participantId: p.id })}
                    >
                      force logout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Groups</h2>
        <div className="flex flex-col gap-1 text-sm">
          {state.groups.map((g) => (
            <div key={g.id} className="flex justify-between border-t border-line py-1 first:border-0">
              <span>{g.name}</span>
              <span className="text-fg-dim">
                {g.participantCount} players · {g.taskProgress.percentage}%
              </span>
            </div>
          ))}
        </div>
        <AddGroup call={call} />
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Tasks ({state.tasks.length})</h2>
        <CreateTask rounds={state.rounds} call={call} notify={notify} />
        <div className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-fg-faint">
              <tr>
                <th className="py-1">Title</th>
                <th>Round</th>
                <th>Done</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.tasks.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-1.5">{t.title}</td>
                  <td>{t.roundNumber}</td>
                  <td className="text-fg-dim">{t.completedCount}</td>
                  <td className="text-right">
                    <button
                      className="text-xs text-cyan"
                      onClick={async () => {
                        const r = await call("/api/game/tasks/regenerate-otp", { taskId: t.id });
                        if (r.otp) notify(`${t.title}: OTP ${r.otp}`);
                      }}
                    >
                      new OTP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function LinkRow({ label, url, onCopy }: { label: string; url: string; onCopy: (t: string, l: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-elevated px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs uppercase text-fg-faint">{label}</p>
        <p className="truncate font-mono text-xs text-fg-dim">{url}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onCopy(url, label)}>
        Copy
      </Button>
    </div>
  );
}

/* ================================================================= RUN */

function RunTab({ state, call, notify }: { state: State; call: CallFn; notify: NotifyFn }) {
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: () => void; label: string }>(
    null,
  );
  const [announce, setAnnounce] = useState("");
  const nextRound = state.game.currentRoundNumber === 0 ? 1 : state.game.currentRoundNumber + 1;
  const m = state.activeMeeting;

  return (
    <div className="flex flex-col gap-5">
      <Panel tone="cyan">
        <p className="font-display text-sm uppercase tracking-wide text-fg-faint">Now</p>
        <p className="font-display text-2xl font-bold">
          {state.game.status}
          {state.game.currentPhase ? ` · ${state.game.currentPhase}` : ""}
        </p>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Rounds</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="cyan" onClick={() => call("/api/game/rounds/start", { roundNumber: nextRound })}>
            Start round {nextRound}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => call("/api/game/rounds/complete")}>
            End round
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              state.game.status === "PAUSED"
                ? call("/api/game/resume")
                : call("/api/game/pause", { reason: "Paused by host" })
            }
          >
            {state.game.status === "PAUSED" ? "Resume game" : "Pause game"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              setConfirm({
                title: "Finish the game?",
                body: "This ends the game and computes the winner. There's no undo.",
                label: "Finish game",
                action: () => call("/api/game/rounds/finish"),
              })
            }
          >
            Finish game
          </Button>
        </div>
      </Panel>

      <Panel tone={m ? "danger" : "default"}>
        <h2 className="mb-3 font-display text-lg">Meeting &amp; voting</h2>
        {m ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-dim">
              {m.type} meeting · <span className="uppercase">{m.status}</span> · votes {m.voteCount}/
              {m.aliveVoterCount}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => call("/api/game/meetings/start-voting", { meetingId: m.id })}>
                Open voting
              </Button>
              <Button size="sm" variant="ghost" onClick={() => call("/api/game/meetings/close-voting", { meetingId: m.id })}>
                Close voting
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setConfirm({
                    title: "Confirm the vote result?",
                    body: "Eliminates whoever the vote landed on (or nobody on a tie/skip).",
                    label: "Confirm result",
                    action: async () => {
                      const r = await call("/api/game/meetings/reveal-result", { meetingId: m.id });
                      if (r.outcome) notify(`Result: ${r.outcome}`);
                    },
                  })
                }
              >
                Confirm result
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => call("/api/game/meetings/call", { reason: "Host called a meeting" })}>
            Call a meeting
          </Button>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Role reveal</h2>
        <RevealRole call={call} />
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Announcement</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (announce.trim()) {
              void call("/api/game/announcements", { message: announce.trim() });
              setAnnounce("");
            }
          }}
        >
          <input
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
            maxLength={280}
            placeholder="Shown to everyone…"
            className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 text-sm outline-none focus:border-cyan"
          />
          <Button size="sm" type="submit" disabled={!announce.trim()}>
            Post
          </Button>
        </form>
      </Panel>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel={confirm?.label}
        danger
      />
    </div>
  );
}

function RevealRole({ call }: { call: CallFn }) {
  const [id, setId] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) {
          void call("/api/game/eliminations/reveal-role", { eliminationId: id.trim() });
          setId("");
        }
      }}
    >
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="elimination id (from the audit log)"
        className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 font-mono text-xs outline-none focus:border-cyan"
      />
      <Button size="sm" type="submit" disabled={!id.trim()}>
        Reveal
      </Button>
    </form>
  );
}

/* ================================================================= MONITOR */

function MonitorTab({ state }: { state: State }) {
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <h2 className="mb-2 font-display text-lg">Global task progress</h2>
        <ProgressBar value={state.taskProgress.percentage} showLabel />
        <p className="mt-1 text-xs text-fg-faint">
          {state.taskProgress.completed}/{state.taskProgress.inPlay} tasks
        </p>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Players</h2>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel text-left text-xs uppercase text-fg-faint">
              <tr>
                <th className="py-1">Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {state.participants.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-1.5">{p.name}</td>
                  <td>
                    <RolePill role={p.role} />
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td className="text-fg-dim">{p.groupName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-display text-lg">Tasks</h2>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-fg-faint">
              <tr>
                <th className="py-1">Title</th>
                <th>Round</th>
                <th>Completed</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {state.tasks.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-1.5">{t.title}</td>
                  <td>{t.roundNumber}</td>
                  <td>{t.completedCount}</td>
                  <td className="text-fg-dim">{t.attemptCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel tone="flat">
        <h2 className="mb-2 font-display text-lg">Audit log</h2>
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-xs text-fg-dim">
          {state.recentAuditLog.map((a) => (
            <li key={a.id}>
              <span className="text-fg-faint">
                {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>{" "}
              {a.actorType} — {a.action}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ================================================================= small forms */

function AddPlayer({ call }: { call: CallFn }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          void call("/api/game/participants", { name: name.trim() });
          setName("");
        }
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a player…"
        className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 text-sm outline-none focus:border-cyan"
      />
      <Button size="sm" type="submit" disabled={!name.trim()}>
        Add
      </Button>
    </form>
  );
}

function BulkImport({ call, notify }: { call: CallFn; notify: NotifyFn }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="mt-2 text-xs text-cyan" onClick={() => setOpen(true)}>
        + bulk import (one name per line)
      </button>
    );
  return (
    <div className="mt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"Ava Chen\nBen Osei\n…"}
        className="w-full rounded-lg border-[3px] border-ink bg-elevated p-2 text-sm outline-none focus:border-cyan"
      />
      <Button
        size="sm"
        className="mt-1"
        onClick={async () => {
          const names = text.split("\n").map((n) => n.trim()).filter(Boolean);
          if (!names.length) return;
          const r = await call("/api/game/participants/bulk-import", { names });
          if (Array.isArray(r)) notify(`Imported ${r.length} players`);
          setText("");
          setOpen(false);
        }}
      >
        Import
      </Button>
    </div>
  );
}

function AddGroup({ call }: { call: CallFn }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          void call("/api/game/groups", { name: name.trim() });
          setName("");
        }
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New group…"
        className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 text-sm outline-none focus:border-cyan"
      />
      <Button size="sm" type="submit" disabled={!name.trim()}>
        Add
      </Button>
    </form>
  );
}

function CreateTask({
  rounds,
  call,
  notify,
}: {
  rounds: State["rounds"];
  call: CallFn;
  notify: NotifyFn;
}) {
  const [title, setTitle] = useState("");
  const [roundId, setRoundId] = useState("");
  useEffect(() => {
    if (!roundId && rounds[0]) setRoundId(rounds[0].id);
  }, [rounds, roundId]);

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !roundId) return;
        const r = await call("/api/game/tasks/create", {
          roundId,
          title: title.trim(),
          description: title.trim(),
          difficulty: "EASY",
          estimatedMinutes: 5,
          points: 10,
        });
        if (r.otp) notify(`"${title.trim()}" — OTP ${r.otp}`);
        setTitle("");
      }}
    >
      <select
        value={roundId}
        onChange={(e) => setRoundId(e.target.value)}
        className="rounded-lg border-[3px] border-ink bg-elevated px-2 py-2 text-sm"
      >
        {rounds.map((r) => (
          <option key={r.id} value={r.id}>
            Round {r.number}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        className="flex-1 rounded-pill border-[3px] border-ink bg-elevated px-4 py-2 text-sm outline-none focus:border-cyan"
      />
      <Button size="sm" type="submit" disabled={!title.trim() || !roundId}>
        Create
      </Button>
    </form>
  );
}
