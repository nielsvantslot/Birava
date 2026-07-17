"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** "Show n check-ins" — reveals the session's splits inline on the card. */
export function CheckinExpander({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={cn("expander", open && "open")}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="lbl">
          {open ? "Hide check-ins" : `Show ${count} check-ins`}
        </span>
        <span className="arrow">›</span>
      </button>
      {open && <div className="checkin-collapse">{children}</div>}
    </>
  );
}
