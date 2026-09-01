"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="ns-screen grid place-items-center bg-void px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl">🛠</p>
        <h1 className="ns-outline font-display text-4xl font-bold uppercase text-red">Something broke</h1>
        <p className="max-w-sm text-fg-dim">
          The ship hit a snag. Try again — if it keeps happening, tell the host.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
