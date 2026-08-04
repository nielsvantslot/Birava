"use client";

// Static fallback the service worker serves for a navigation that fails
// with no network and nothing cached for that URL yet (see public/sw.js).
// No auth, no data fetching — must render standalone, offline, on a device
// that has never loaded anything else from this app. Its HTML is precached
// at SW install, but that doesn't guarantee globals.css is cached too (that
// only happens the first time some page actually loads it) — every color
// below is a literal from globals.css's :root, not a var() reference, so
// this can never fall back to the browser's unstyled/dark-mode-default
// rendering the way a var()-dependent page could.

export default function OfflinePage() {
  return (
    <div
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
          You&apos;re offline
        </h1>
        <p style={{ fontSize: 14, color: "#88907F", margin: "8px 0 16px" }}>
          This page hasn&apos;t been opened before, so there&apos;s nothing
          saved to show yet. Once you&apos;re back online it&apos;ll load
          normally — and any drink you log while offline is saved on your
          device and synced automatically.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
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
    </div>
  );
}
