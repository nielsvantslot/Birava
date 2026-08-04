interface ActiveWeeksStreakProps {
  weeks: { current: number; best: number; strip: boolean[] };
  /**
   * achievements/page.tsx explains the rest-week rule via a callout below,
   * so its legend stays terse; stats/page.tsx has no callout, so its legend
   * carries the explanation inline instead. Mutually exclusive by design —
   * never both.
   */
  showRestWeekCallout?: boolean;
}

/**
 * The streak stat cards + week-strip + legend — shared by stats/page.tsx and
 * achievements/page.tsx so they can't drift apart (this used to be two
 * copy-pasted blocks with slightly different wording in each).
 */
export function ActiveWeeksStreak({ weeks, showRestWeekCallout = false }: ActiveWeeksStreakProps) {
  return (
    <>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="label">Current</div>
          <div className="num">
            {weeks.current}
            <small>wk</small>
          </div>
          <div className="sub">weeks with at least one session</div>
        </div>
        <div className="stat">
          <div className="label">Best</div>
          <div className="num">
            {weeks.best}
            <small>wk</small>
          </div>
          <div className="sub">your longest run</div>
        </div>
      </div>
      <div className="weeks">
        {weeks.strip.map((on, i) => (
          <div key={i} className={on ? "cell on" : "cell rest"}></div>
        ))}
      </div>
      <div className="weeks-legend">
        <span>
          <i className="on"></i> active{showRestWeekCallout ? "" : " week"}
        </span>
        <span>
          <i className="rest"></i> rest week
          {showRestWeekCallout ? "" : " — recovery counts, the streak survives it"}
        </span>
      </div>
      {showRestWeekCallout && (
        <div className="callout" style={{ margin: "16px 0 0" }}>
          <div className="mark" style={{ color: "var(--accent)" }}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21c4-3.5 6-6.6 6-9.5C18 7 15.5 4 12 4S6 7 6 11.5c0 2.9 2 6 6 9.5z"></path>
              <path d="M9 11.5l2 2 4-4"></path>
            </svg>
          </div>
          <div>
            <b>A rest week won&apos;t break it</b>
            <p>
              The streak counts weeks with at least one session — never
              consecutive days. Skip a week and it reads as recovery, not a
              failure. Birava will never nudge you to drink to keep a number
              alive.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
