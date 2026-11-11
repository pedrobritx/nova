/* eslint-disable @next/next/no-img-element -- feed images come from any host and are already sanitised; next/image would need every host allow-listed. */

// A story's picture, or, when the feed has none, a calm pattern drawn from the title so cards
// still differ from one another. Feed images load lazily and send no referrer.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Art({ src, seed, thumb = false }: { src: string | null; seed: string; thumb?: boolean }) {
  const cls = thumb ? "nv2-thumb" : "nv2-art";
  if (src) {
    return (
      <span className={cls}>
        <img className="art-img" src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      </span>
    );
  }
  const h = hash(seed);
  const waves = [0, 1, 2].map((i) => {
    const y = 60 + i * 34 + ((h >> (i * 5)) % 18);
    const a = 14 + ((h >> (i * 3)) % 22);
    return `M0 ${y} C 80 ${y - a}, 160 ${y + a}, 320 ${y - a / 2}`;
  });
  return (
    <span className={cls}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="320" height="180" style={{ fill: "var(--g1)" }} />
        <circle cx={60 + (h % 200)} cy={50 + ((h >> 8) % 60)} r={36 + ((h >> 4) % 30)} style={{ fill: "var(--g2)", opacity: 0.9 }} />
        {waves.map((d, i) => (
          <path key={i} d={d} style={{ fill: "none", stroke: "var(--accent)", strokeWidth: 2.5, opacity: 0.18 + i * 0.12 }} />
        ))}
      </svg>
    </span>
  );
}
