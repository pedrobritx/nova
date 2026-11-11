import { Download, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/actions";
import { AppearanceSettings } from "@/components/appearance-settings";
import { Body, Icon } from "@/components/ui";
import { context } from "@/lib/server";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="measure nv2-stack" style={{ gap: "var(--s6)" }}>
      <header>
        <h1 className="t-page">Settings</h1>
      </header>
      <section className="nv2-tile card-body" style={{ padding: "var(--s5)", gap: "var(--s4)" }} aria-labelledby="look-h">
        <h2 id="look-h" className="t-section">Appearance</h2>
        <AppearanceSettings />
      </section>
      <section className="nv2-tile card-body" style={{ padding: "var(--s5)", gap: "var(--s4)" }} aria-labelledby="data-h">
        <h2 id="data-h" className="t-section">Your library</h2>
        <p className="t-body t-muted">Take your sources and folders to any other reader.</p>
        <div>
          <a className="m-mat m-glass" href="/api/opml" download>
            <Body />
            <span className="m-label">
              <Icon icon={Download} />
              Export OPML
            </span>
          </a>
        </div>
      </section>
      <section className="nv2-tile card-body" style={{ padding: "var(--s5)", gap: "var(--s4)" }} aria-labelledby="account-h">
        <h2 id="account-h" className="t-section">Account</h2>
        <Suspense fallback={<p className="t-meta">Loading</p>}>
          <Account />
        </Suspense>
      </section>
    </div>
  );
}

async function Account() {
  const { viewer, demo } = await context();
  if (demo) return <p className="t-body t-muted">Demo mode: nothing is saved after the server stops.</p>;
  return (
    <div className="nv2-wrap" style={{ gap: "var(--s4)", justifyContent: "space-between" }}>
      <p className="t-body">
        Signed in as <span className="t-strong">{viewer.email}</span>
      </p>
      <form action={signOut}>
        <button type="submit" className="m-mat m-glass">
          <Body />
          <span className="m-label">
            <Icon icon={LogOut} />
            Sign out
          </span>
        </button>
      </form>
    </div>
  );
}
