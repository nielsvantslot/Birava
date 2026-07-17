export default function CrewsLoading() {
  return (
    <>
      <div className="section" style={{ minHeight: 140 }}>
        <div className="h-row">
          <h3>Your crews</h3>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="row">
            <div className="avatar" />
            <div className="grow">
              <div
                style={{
                  height: 14,
                  width: 140,
                  background: "var(--surface-2)",
                  borderRadius: 7,
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  height: 11,
                  width: 180,
                  background: "var(--surface-2)",
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="section" style={{ minHeight: 200 }}>
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Start a crew</h3>
        </div>
      </div>
      <div className="section" style={{ minHeight: 120 }}>
        <div className="h-row" style={{ marginBottom: 6 }}>
          <h3>Join with a code</h3>
        </div>
      </div>
    </>
  );
}
