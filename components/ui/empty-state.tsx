import type { ReactNode } from "react";

/** A muted "nothing here" message for an empty list — the shared visual wrapper (ink-dim small text, consistent padding); the message itself stays each caller's own, since that varies meaningfully per screen. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 14, color: "var(--ink-dim)", padding: "14px 0" }}>{children}</p>;
}
