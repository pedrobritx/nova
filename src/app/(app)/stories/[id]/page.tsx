import { ChevronLeft, ExternalLink, Info } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MarkAllRead } from "@/components/actions-ui";
import { Skeleton } from "@/components/skeleton";
import { MergeReason } from "@/components/stories";
import { Icon, IconLink, Mono, Time } from "@/components/ui";
import { Art } from "@/components/art";
import { getStory, isUuid } from "@/lib/data";
import { context } from "@/lib/server";
import { timeZone } from "@/lib/tz";
import Link from "next/link";

export default function StoryPage(props: PageProps<"/stories/[id]">) {
  return (
    <Suspense fallback={<Skeleton kind="story" />}>
      <StoryView params={props.params} />
    </Suspense>
  );
}

async function StoryView({ params }: { params: PageProps<"/stories/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { db } = await context();
  const [story, tz] = await Promise.all([getStory(db, id), timeZone()]);
  if (!story) notFound();

  const original = story.items[0]; // items arrive oldest first
  const fullest = [...story.items].filter((i) => i.mergedBy !== "copy").sort((a, b) => b.contentLength - a.contentLength)[0] ?? original;
  const sources = new Set(story.items.map((i) => i.source)).size;
  const copies = story.items.filter((i) => i.mergedBy === "copy").length;
  const unread = story.items.filter((i) => !i.isRead).length;

  return (
    <article className="measure nv2-stack" style={{ gap: "var(--s6)" }}>
      <nav className="nv2-line" style={{ gap: "var(--s2)" }} aria-label="Story">
        <IconLink icon={ChevronLeft} label="Back to Today" href="/" />
        <span className="nv2-fill" />
        {unread > 0 && <MarkAllRead story={story.id} label="Mark story read" />}
      </nav>
      <header className="nv2-stack" style={{ gap: "var(--s3)" }}>
        <span className="t-eyebrow">
          {original.folder ? `${original.folder} · ` : ""}
          {sources} sources · updated <Time iso={story.items.at(-1)!.publishedAt} tz={tz} />
        </span>
        <h1 className="t-hl-page">{story.title}</h1>
        {original.excerpt && <p className="t-dek">{original.excerpt}</p>}
      </header>

      <Link href={`/items/${fullest.id}`} className="nv2-tile tile-row">
        <Art src={fullest.imageUrl} seed={story.title} thumb />
        <span className="nv2-fill nv2-stack" style={{ gap: "var(--s1)" }}>
          <span className="t-eyebrow">Read the fullest version</span>
          <span className="t-hl-card">{fullest.title}</span>
          <span className="t-meta">{fullest.source}</span>
        </span>
      </Link>

      <section className="section" aria-labelledby="coverage-h">
        <div className="nv2-line" style={{ gap: "var(--s3)" }}>
          <h2 id="coverage-h" className="t-section nv2-fill">Coverage</h2>
          <span className="t-meta">Oldest first</span>
        </div>
        <ol className="list nv2-tile">
          {story.items.map((i) => (
            <li key={i.id}>
              <Link href={`/items/${i.id}`} className="nv2-row">
                <span className="t-meta" style={{ width: 52 }}>
                  <Time iso={i.publishedAt} tz={tz} />
                </span>
                <Mono name={i.source} />
                <span className="nv2-fill nv2-stack" style={{ gap: "var(--s1)" }}>
                  <span className={i.isRead ? "t-hl-row t-muted" : "t-hl-row"}>{i.title}</span>
                  <span className="t-meta nv2-clip">{i.source}</span>
                </span>
                <MergeReason by={i.mergedBy} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="nv2-tile card-body" aria-labelledby="why-h" style={{ padding: "var(--s5)" }}>
        <h2 id="why-h" className="t-label t-strong nv2-line" style={{ gap: "var(--s2)" }}>
          <Icon icon={Info} size={18} />
          Why these are one story
        </h2>
        <p className="t-body t-muted">
          {story.items.length - copies - 1 > 0 && `${story.items.length - copies - 1} ${story.items.length - copies - 1 === 1 ? "item links" : "items link"} to the same article. `}
          {copies > 0 && `${copies} ${copies === 1 ? "item is a word-for-word copy" : "items are word-for-word copies"} of an earlier one. `}
          Nova merges items from the same week only.
        </p>
        {original.url && (
          <a className="nv2-link nv2-line" style={{ gap: "var(--s1)" }} href={original.url} target="_blank" rel="noopener noreferrer">
            Open the first report on {original.source}
            <Icon icon={ExternalLink} size={16} />
          </a>
        )}
      </section>
    </article>
  );
}
