export default function LogLoading() {
  return (
    <>
      <div className="section" style={{ minHeight: 420 }}>
        {/* Not "Log a drink" — this fallback has no access to ?edit=<id>, so
            it can't know yet whether the real heading will be that or "Edit
            check-in". A neutral pulsing bar avoids flashing the wrong one. */}
        <div
          style={{
            height: 20,
            width: 150,
            background: "var(--surface-2)",
            borderRadius: 8,
            marginBottom: 10,
          }}
        />
        <div
          style={{
            height: 14,
            width: 220,
            background: "var(--surface-2)",
            borderRadius: 7,
            marginBottom: 18,
          }}
        />
        {[0, 1, 2].map((i) => (
          <div key={i} className="field">
            <div
              style={{
                height: 12,
                width: 60,
                background: "var(--surface-2)",
                borderRadius: 6,
                marginBottom: 7,
              }}
            />
            <div
              style={{
                height: 50,
                background: "var(--surface-2)",
                borderRadius: 12,
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
