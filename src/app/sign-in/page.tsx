import type { Metadata } from "next";
import Link from "next/link";
import { NovaMark } from "@/components/mark";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() {
  return (
    <main className="nv2-above" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--s5)" }}>
      <div className="nv2-glass nv2-stack" style={{ width: "min(440px, 100%)", gap: "var(--s5)", padding: "var(--s7) var(--s6)", borderRadius: "var(--r-window)" }}>
        <div className="nv2-line" style={{ gap: "var(--s3)" }}>
          <NovaMark size={40} />
          <span className="t-section">Nova</span>
        </div>
        <div className="nv2-stack" style={{ gap: "var(--s2)" }}>
          <h1 className="t-page-s">Read your way</h1>
          <p className="t-body t-muted">Sign in to sync across devices, or read as a guest with data saved only in this browser.</p>
        </div>
        <SignInForm />
        <div className="nv2-stack" style={{ gap: "var(--s3)" }}>
          <div className="t-meta t-muted" style={{ textAlign: "center" }}>or</div>
          <Link className="m-mat m-glass" href="/guest" style={{ display: "flex", justifyContent: "center", padding: "var(--s3)", textDecoration: "none" }}>
            <span className="m-body" aria-hidden="true"><span className="m-refract" /><span className="m-light" /></span>
            <span className="m-label">Continue as guest</span>
          </Link>
          <p className="t-meta t-muted" style={{ textAlign: "center" }}>Guest data remains on this device until browser website data is cleared. You can export your sources at any time.</p>
        </div>
      </div>
    </main>
  );
}