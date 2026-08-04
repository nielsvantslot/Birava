"use client";

// Static fallback the service worker serves for a navigation that fails
// with no network and nothing cached for that URL yet (see public/sw.js).
// No auth, no data fetching — must render standalone, offline, on a device
// that has never loaded anything else from this app.

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-black">You&apos;re offline</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          This page hasn&apos;t been opened before, so there&apos;s nothing
          saved to show yet. Once you&apos;re back online it&apos;ll load
          normally — and any drink you log while offline is saved on your
          device and synced automatically.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
