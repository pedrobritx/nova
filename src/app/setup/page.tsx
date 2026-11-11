import type { Metadata } from "next";
import { NovaMark } from "@/components/mark";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <main className="nv2-above" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--s5)" }}>
      <div className="nv2-glass nv2-stack" style={{ width: "min(600px, 100%)", gap: "var(--s4)", padding: "var(--s7) var(--s6)", borderRadius: "var(--r-window)" }}>
        <NovaMark size={40} />
        <h1 className="t-page-s">Nova needs a database</h1>
        <p className="t-body">
          This server has no Supabase settings yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>,{" "}
          <code>SUPABASE_SECRET_KEY</code> and <code>CRON_SECRET</code> to the environment, then restart.
        </p>
        <p className="t-body t-muted">
          To look around first, start Nova with <code>NOVA_DEMO=1</code>: it runs on sample feeds with an in-memory database. The README has the full setup.
        </p>
      </div>
    </main>
  );
}
