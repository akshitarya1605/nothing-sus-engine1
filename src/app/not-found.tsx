import Link from "next/link";

export default function NotFound() {
  return (
    <main className="ns-screen grid place-items-center bg-void px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl">👻</p>
        <h1 className="ns-outline font-display text-4xl font-bold uppercase text-yellow">Nothing here</h1>
        <p className="max-w-sm text-fg-dim">This page drifted off into space.</p>
        <Link href="/" className="font-display text-cyan underline">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
