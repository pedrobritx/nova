"use client";

import { CircleAlert, CircleCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";
import { importFeeds, type ImportState } from "@/app/actions";
import { Body, Icon, Notice } from "./ui";

export function ImportForm() {
  const [state, run, running] = useActionState<ImportState, FormData>(importFeeds, null);
  const id = useId();
  const r = state?.result;
  return (
    <div className="nv2-stack" style={{ gap: "var(--s5)" }}>
      <form action={run} className="nv2-stack" style={{ gap: "var(--s4)" }}>
        <div className="file-drop">
          <Icon icon={Upload} />
          <label htmlFor={id} className="t-label t-strong">OPML file</label>
          <input id={id} name="opml" type="file" accept=".opml,.xml,text/xml,application/xml,text/x-opml" required />
          <span className="t-meta">Up to 500 feeds, 2 MB</span>
        </div>
        <div className="nv2-line" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="m-mat m-pigment" aria-busy={running || undefined}>
            <Body />
            <span className="m-label">{running ? "Importing…" : "Import"}</span>
          </button>
        </div>
      </form>
      <div aria-live="polite" className="nv2-stack" style={{ gap: "var(--s3)" }}>
        {running && <p className="t-meta">Reading your feeds. Large files take up to half a minute.</p>}
        {state?.error && (
          <Notice icon={CircleAlert} error>
            {state.error}
          </Notice>
        )}
        {r && (
          <>
            <Notice icon={CircleCheck}>
              Following {r.added} {r.added === 1 ? "source" : "sources"}
              {r.folders.length ? ` in ${r.folders.length} ${r.folders.length === 1 ? "folder" : "folders"}` : ""}.{" "}
              {r.queued > 0 ? `${r.queued} more will be read in the next few minutes.` : ""}
            </Notice>
            {r.failed.length > 0 && (
              <Notice icon={CircleAlert} error>
                {r.failed.length} could not be read yet: {r.failed.slice(0, 5).map((f) => f.title).join(", ")}
                {r.failed.length > 5 ? ` and ${r.failed.length - 5} more` : ""}. Nova will keep trying.
              </Notice>
            )}
            <p>
              <Link className="nv2-link" href="/">Go to Today</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
