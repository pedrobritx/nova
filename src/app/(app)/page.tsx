import { CircleCheck, Layers, Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkAllRead, RefreshButton } from "@/components/actions-ui";
import { FolderStrip } from "@/components/folder-strip";
import { Skeleton } from "@/components/skeleton";
import { LeadStory, StoryTile } from "@/components/stories";
import { Empty, Icon, LinkButton } from "@/components/ui";
import { getSources, getToday } from "@/lib/data";
import { context } from "@/lib/server";
import { timeZone } from "@/lib/tz";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <>
      <header className="page-head">
        <div className="nv2-fill">
          <h1 className="t-page">Today</h1>
        </div>
        <div className="page-tools">
          <RefreshButton />
          <MarkAllRead />
        </div>
      </header>
      <Suspense fallback={null}>
        <FolderStrip />
      </Suspense>
      <Suspense fallback={<Skeleton kind="today" />}>
        <TodayStories />
      </Suspense>
    </>
  );
}

async function TodayStories() {
  const { db, demo } = await context();
  const [stories, tz] = await Promise.all([getToday(db), timeZone()]);

  if (!stories.length) {
    const sources = await getSources(db);
    if (!sources.length) {
      return (
        <Empty icon={Layers} title="Nothing to read yet">
          <p className="t-body t-muted" style={{ maxWidth: 420 }}>
            Follow a few websites and Nova gathers their new posts here, with duplicates merged into one story.
          </p>
          <div className="nv2-wrap" style={{ gap: "var(--s2)", justifyContent: "center" }}>
            <LinkButton kind="pigment" icon={Plus} href="/sources/add">Add a source</LinkButton>
            <LinkButton icon={Upload} href="/sources/import">Import OPML</LinkButton>
          </div>
        </Empty>
      );
    }
    return (
      <Empty icon={CircleCheck} title="You’re all caught up">
        <p className="t-body t-muted">New stories appear here as your sources publish them.</p>
        <Link className="nv2-link" href="/latest">See everything in Latest</Link>
      </Empty>
    );
  }

  const [lead, ...rest] = stories;
  const top = rest.slice(0, 6);
  const more = rest.slice(6);
  const merged = stories.reduce((n, s) => n + Math.max(0, s.sourceCount - 1), 0);

  return (
    <>
      {demo && (
        <p className="t-meta">
          Demo library: sample sources on reserved .example addresses. Set up Supabase to follow real feeds.
        </p>
      )}
      <LeadStory story={lead} tz={tz} />
      {top.length > 0 && (
        <section className="section" aria-labelledby="top-h">
          <div className="nv2-line" style={{ gap: "var(--s3)" }}>
            <h2 id="top-h" className="t-section nv2-fill">Top stories</h2>
            {merged > 0 && (
              <span className="t-meta nv2-line" style={{ gap: "var(--s2)" }}>
                <Icon icon={Layers} size={16} />
                {merged} duplicate{merged === 1 ? "" : "s"} merged
              </span>
            )}
          </div>
          <div className="cards">
            {top.map((s) => (
              <StoryTile key={s.id} story={s} tz={tz} />
            ))}
          </div>
        </section>
      )}
      {more.length > 0 && (
        <section className="section" aria-labelledby="more-h">
          <h2 id="more-h" className="t-section">More today</h2>
          <div className="cards">
            {more.map((s) => (
              <StoryTile key={s.id} story={s} tz={tz} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
