import { cn } from "@/lib/utils";

/** An on/off toggle button — the `role="switch"` + `.switch`/`.switch.on` (app/globals.css) wiring shared by every settings toggle in the app. */
export function Switch({
  on,
  onClick,
  disabled,
  label,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn("switch", on && "on")}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
