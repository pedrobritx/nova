import type { Metadata } from "next";
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
          <h1 className="t-page-s">Sign in</h1>
          <p className="t-body t-muted">Nova emails you a link. No password to remember.</p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
