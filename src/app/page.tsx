/**
 * Deliberately plain — this prompt is about the game engine, not UI
 * polish. Admin/spectator have no guessable entry point by design (see
 * docs/SECURITY.md "Admin access") — this page only links the
 * participant login, which is the one interface with a public URL.
 */
export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 640 }}>
      <h1>Nothing Sus — Game Engine</h1>
      <p>Functional QA console. No visual design yet — see docs/GAME_ENGINE.md.</p>
      <ul>
        <li><a href="/participant">Participant login</a></li>
      </ul>
      <p style={{ color: "#888", fontSize: 13 }}>
        Admin and spectator access are secret-URL only (/control/&lt;secret&gt;,
        /spectator/&lt;secret&gt;) — there is no public link to them, by design.
      </p>
    </main>
  );
}
