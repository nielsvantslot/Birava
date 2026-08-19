import { Code2 } from "lucide-react";

/**
 * Marks someone who worked on Birava itself — pure credit, not a drink
 * achievement, so it deliberately skips --accent (actions/your-data only)
 * and --honey (achievements only) and uses the neutral --ink-dim instead.
 */
export function DevBadge() {
  return (
    <Code2
      size={13}
      strokeWidth={2.25}
      color="var(--ink-dim)"
      style={{ flexShrink: 0, verticalAlign: "middle" }}
      aria-label="Birava developer"
    >
      <title>Birava developer</title>
    </Code2>
  );
}
