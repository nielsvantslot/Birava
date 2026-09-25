import type { ElementType, ReactNode } from "react";
import { DevBadge } from "@/components/ui/dev-badge";
import { cn } from "@/lib/utils";

/**
 * A username plus its conditional DevBadge, laid out inline via the
 * `.username-row` class (app/globals.css). Centralizes the flex+gap wrapper
 * that used to be hand-copied (and drifted: gap 5 vs 6, flex vs inline-flex)
 * at every call site that renders a username.
 */
export function UsernameLabel({
  name,
  isDeveloper,
  as: Tag = "span",
  block = false,
  className,
}: {
  name: ReactNode;
  isDeveloper?: boolean;
  as?: ElementType;
  /** Use `display: flex` instead of the default `inline-flex` — for wrappers that need to force block-level stacking (e.g. a bare `<span>` standing in for a block). */
  block?: boolean;
  className?: string;
}) {
  return (
    <Tag className={cn("username-row", block && "username-row--block", className)}>
      {name}
      {isDeveloper && <DevBadge />}
    </Tag>
  );
}
