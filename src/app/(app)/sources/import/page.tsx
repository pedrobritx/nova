import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";
import { IconLink } from "@/components/ui";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <div className="measure nv2-stack" style={{ gap: "var(--s6)" }}>
      <nav className="nv2-line" aria-label="Back">
        <IconLink icon={ChevronLeft} label="Back to Sources" href="/sources" />
      </nav>
      <header className="nv2-stack" style={{ gap: "var(--s2)" }}>
        <h1 className="t-page-s">Import your feeds</h1>
        <p className="t-lead t-muted">Every reader can export an OPML file. Nova keeps its folders.</p>
      </header>
      <ImportForm />
    </div>
  );
}
