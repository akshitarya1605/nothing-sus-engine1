"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#050508",
          color: "#f4f5f8",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28 }}>Nothing Sus hit a wall</h1>
          <p style={{ opacity: 0.7 }}>Reload the page. If it persists, restart the app.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              border: "3px solid #08080d",
              borderRadius: 999,
              background: "#ffd93f",
              color: "#08080d",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
