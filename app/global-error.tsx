"use client";

// The last-resort error boundary — replaces the entire root layout, so it
// can't rely on globals.css having loaded (offline with a cache miss on
// that specific asset is exactly when this is most likely to render).
// Every color here is a literal from globals.css's :root, not a var()
// reference, so this always looks intentional instead of falling back to
// the browser's unstyled/dark-mode-default rendering.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          background: "#0A0D09",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 384, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#EEF2E7", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#88907F", margin: "8px 0 16px" }}>
            Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 8,
              background: "#A9C641",
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "#141A06",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
