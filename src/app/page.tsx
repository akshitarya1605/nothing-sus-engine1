/**
 * Deliberately plain — this prompt is about the game engine, not UI
 * polish. Three links into the three functionally-separate consoles.
 */
export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 640 }}>
      <h1>Nothing Sus — Game Engine</h1>
      <p>Functional QA consoles for the three clients. No visual design yet — see docs/GAME_ENGINE.md.</p>
      <ul>
        <li><a href="/player">Player</a></li>
        <li><a href="/admin">Admin</a></li>
        <li><a href="/projector">Projector</a></li>
      </ul>
    </main>
  );
}
