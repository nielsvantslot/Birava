interface LocalLegendCalloutProps {
  venue: string;
  /**
   * The session detail page uses the fuller framing ("Hold the lead...");
   * the feed card (many of these can render on one screen) uses a terser
   * one-liner.
   */
  detailed?: boolean;
}

export function LocalLegendCallout({ venue, detailed = false }: LocalLegendCalloutProps) {
  return (
    <div className="callout">
      <div className="mark">
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
          <path d="M12 3l2.2 4.6 5 .7-3.6 3.6.9 5.1L12 14.6 7.5 17l.9-5.1L4.8 8.3l5-.7z"></path>
        </svg>
      </div>
      <div>
        <b>Local Legend — {venue}</b>
        <p>
          {detailed
            ? "You have more check-ins here than anyone else in the last 90 days. Hold the lead to keep the crown."
            : "You have the most check-ins here in the last 90 days."}
        </p>
      </div>
    </div>
  );
}
