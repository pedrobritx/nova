/** Placeholder shapes while a page's data streams in. Hidden from screen readers, which get a status. */
export function Skeleton({ kind }: { kind: "today" | "list" | "story" | "reader" | "table" }) {
  return (
    <div className="nv2-stack" style={{ gap: "var(--s4)" }}>
      <span className="nv2-sr" role="status">Loading</span>
      {kind === "today" && (
        <>
          <div className="skeleton" style={{ height: 320 }} aria-hidden="true" />
          <div className="cards" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}
          </div>
        </>
      )}
      {(kind === "list" || kind === "table") && (
        <div className="skeleton" style={{ height: 480 }} aria-hidden="true" />
      )}
      {(kind === "story" || kind === "reader") && (
        <div className="measure nv2-stack" style={{ gap: "var(--s4)" }} aria-hidden="true">
          <div className="skeleton" style={{ height: 48, width: "70%" }} />
          <div className="skeleton" style={{ height: 22 }} />
          <div className="skeleton" style={{ height: 22, width: "85%" }} />
          <div className="skeleton" style={{ height: 360 }} />
        </div>
      )}
    </div>
  );
}
