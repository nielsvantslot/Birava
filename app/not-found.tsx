import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-black">Page not found</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          This page doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
