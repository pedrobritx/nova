import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { AddSourceForm } from "@/components/add-source";
import { IconLink } from "@/components/ui";

export const metadata: Metadata = { title: "Add a source" };

export default function AddSourcePage() {
  return (
    <div className="measure nv2-stack" style={{ gap: "var(--s6)" }}>
      <nav className="nv2-line" aria-label="Back">
        <IconLink icon={ChevronLeft} label="Back to Sources" href="/sources" />
      </nav>
      <header className="nv2-stack" style={{ gap: "var(--s2)" }}>
        <h1 className="t-page-s">Add a source</h1>
        <p className="t-lead t-muted">Paste a website or a feed address. Nova finds the feed for you.</p>
      </header>
      <AddSourceForm />
    </div>
  );
}
