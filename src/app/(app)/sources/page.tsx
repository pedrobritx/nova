import { CircleAlert, CircleCheck, Download, Plus, Rss, Upload } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MoveSource, UnfollowButton } from "@/components/source-controls";
import { Skeleton } from "@/components/skeleton";
import { Empty, Icon, LinkButton, Mono, Notice, Time } from "@/components/ui";
import { getSources } from "@/lib/data";
import { context } from "@/lib/server";
import { timeZone } from "@/lib/tz";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage(props: PageProps<"/sources">) {
  return (
    <>
      <header className="page-head">
        <div className="nv2-fill">
          <h1 className="t-page">Sources</h1>
        </div>
        <div className="page-tools">
          <LinkButton icon={Upload} href="/sources/import">Import</LinkButton>
          <a className="m-mat m-glass" href="/api/opml" download>
            <span className="m-body" aria-hidden="true"><span className="m-refract" /><span className="m-light" /></span>
            <span className="m-label"><Icon icon={Download} />Export</span>
          </a>
          <LinkButton kind="pigment" icon={Plus} href="/sources/add">Add source</LinkButton>
        </div>
      </header>
      <Suspense fallback={<Skeleton kind="table" />}>
        <SourceTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SourceTable({ searchParams }: { searchParams: PageProps<"/sources">["searchParams"] }) {
  const { added } = await searchParams;
  const { db } = await context();
  const [sources, tz] = await Promise.all([getSources(db), timeZone()]);
  if (!sources.length) {
    return (
      <Empty icon={Rss} title="No sources yet">
        <p className="t-body t-muted">Add a website or import the OPML file your old reader exports.</p>
      </Empty>
    );
  }
  const just = sources.find((s) => s.feedId === added);
  const folders = [...new Set(sources.map((s) => s.folder).filter((f): f is string => !!f))];
  const failing = sources.filter((s) => s.errorCount >= 2).length;
  return (
    <>
      {just && <Notice icon={CircleCheck}>Following {just.title}.</Notice>}
      {failing > 0 && (
        <Notice icon={CircleAlert} error>
          {failing === 1 ? "One source is" : `${failing} sources are`} failing. Nova keeps trying, less often each time.
        </Notice>
      )}
      <div className="table-wrap nv2-tile">
        <table className="src-table">
          <caption className="nv2-sr">Sources you follow</caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Folder</th>
              <th scope="col">Status</th>
              <th scope="col" style={{ textAlign: "right" }}>This week</th>
              <th scope="col"><span className="nv2-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.subscriptionId}>
                <td>
                  <span className="nv2-line" style={{ gap: "var(--s3)" }}>
                    <Mono name={s.title} />
                    <span className="nv2-stack" style={{ minWidth: 0 }}>
                      <span className="t-strong">{s.title}</span>
                      <span className="t-meta nv2-clip" style={{ maxWidth: 280 }}>{s.siteUrl ? new URL(s.siteUrl).hostname.replace(/^www\./, "") : new URL(s.url).hostname}</span>
                    </span>
                  </span>
                </td>
                <td>
                  <MoveSource subscriptionId={s.subscriptionId} current={s.folder} folders={folders} label={`Folder for ${s.title}`} />
                </td>
                <td>
                  {s.errorCount > 0 ? (
                    <span className="nv2-line t-meta" style={{ gap: "var(--s2)" }} title={s.lastError ?? undefined}>
                      <Icon icon={CircleAlert} size={16} />
                      {s.lastError ?? "Failing"}
                    </span>
                  ) : s.lastSuccessAt ? (
                    <span className="nv2-line t-meta" style={{ gap: "var(--s2)" }}>
                      <Icon icon={CircleCheck} size={16} />
                      Checked <Time iso={s.lastSuccessAt} tz={tz} />
                    </span>
                  ) : (
                    <span className="t-meta">Waiting for first check</span>
                  )}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.itemsThisWeek}</td>
                <td>
                  <UnfollowButton subscriptionId={s.subscriptionId} title={s.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
