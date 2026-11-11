import "server-only";
import { cookies } from "next/headers";

/** The reader's time zone, as their browser reported it; UTC until it has. */
export async function timeZone(): Promise<string> {
  const raw = (await cookies()).get("nova-tz")?.value;
  if (!raw) return "UTC";
  try {
    const tz = decodeURIComponent(raw);
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Calendar day of an instant in a time zone, as a comparable number. */
export function dayNumber(d: Date, tz: string): number {
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: tz }).split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}
