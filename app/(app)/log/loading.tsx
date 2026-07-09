export default function LogLoading() {
  return (
    <>
      <div className="section" style={{ minHeight: 420 }}>
        <div className="h-row" style={{ marginBottom: 4 }}>
          <h3>Log a drink</h3>
        </div>
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
      <div className="section" style={{ minHeight: 160 }}>
        <div className="h-row">
          <h3>Recent</h3>
        </div>
      </div>
    </>
  );
}
