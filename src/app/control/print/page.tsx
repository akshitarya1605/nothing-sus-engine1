"use client";

import { useEffect, useState } from "react";
import { QRCode } from "@/components/ui/QRCode";

interface P {
  id: string;
  name: string;
  code: string;
}

/** Printable player cards — one per player, name + code + a QR that deep
 * links to /play?code=…. Print (Cmd/Ctrl+P) and cut them up. */
export default function PrintCardsPage() {
  const [players, setPlayers] = useState<P[] | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/game/state", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setPlayers(s?.participants ?? null));
  }, []);

  if (!players) {
    return <main className="grid min-h-screen place-items-center bg-white text-black">Loading…</main>;
  }

  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">Player cards ({players.length})</h1>
        <button
          onClick={() => window.print()}
          className="rounded border-2 border-black bg-yellow-300 px-4 py-2 font-semibold"
        >
          Print
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {players.map((p) => (
          <div key={p.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border-2 border-black p-4 text-center">
            <p className="text-lg font-bold">{p.name}</p>
            <QRCode value={`${origin}/play?code=${encodeURIComponent(p.code)}`} size={150} />
            <p className="font-mono text-lg tracking-widest">{p.code}</p>
            <p className="text-xs text-neutral-500">Nothing Sus · scan or type your code at {origin.replace(/^https?:\/\//, "")}/play</p>
          </div>
        ))}
      </div>
    </main>
  );
}
