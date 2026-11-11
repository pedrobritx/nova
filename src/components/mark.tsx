/** Nova's mark: a four-point star on the accent. */
export function NovaMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="16" cy="16" r="16" style={{ fill: "var(--accent)" }} />
      <path d="M16 6c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10z" style={{ fill: "var(--on-accent)" }} />
    </svg>
  );
}
