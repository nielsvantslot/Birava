"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-black">Something went wrong</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
