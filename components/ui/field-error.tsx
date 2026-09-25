import type { CSSProperties, ReactNode } from "react";

/** Inline form-validation error text — always `var(--destructive)`, never a hand-typed hex (one call site drifted to `#E5837A`, a visibly different red). `style` only for layout (margin/font-size) that varies by form. */
export function FieldError({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ fontSize: 13, color: "var(--destructive)", marginBottom: 12, ...style }}>{children}</p>;
}
