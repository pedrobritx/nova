import { SearchX } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="nv2-above" style={{ minHeight: "60dvh", display: "grid", placeItems: "center", padding: "var(--s5)" }}>
      <div className="empty nv2-tile" style={{ maxWidth: 480 }}>
        <Icon icon={SearchX} />
        <h1 className="t-section">Nothing here</h1>
        <p className="t-body t-muted">The item may have left your library when you unfollowed its source.</p>
        <Link className="nv2-link" href="/">Back to Today</Link>
      </div>
    </main>
  );
}
