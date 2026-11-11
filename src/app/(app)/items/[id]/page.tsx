import { ChevronLeft, ExternalLink, Layers } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MarkReadOnOpen } from "@/components/actions-ui";
import { Skeleton } from "@/components/skeleton";
import { Icon, IconLink, LinkButton, Mono, MonoStack, Time } from "@/components/ui";
import { getItem, getStory, isUuid } from "@/lib/data";
import { context } from "@/lib/server";
import { timeZone } from "@/lib/tz";

export default function ReaderPage(props: PageProps<"/items/[id]">) {
  return (
    <Suspense fallback={<Skeleton kind="reader" />}>
      <Reader params={props.params} />
    </Suspense>
  );
}

async function Reader({ params }: { params: PageProps<"/items/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { db } = await context();
  const [item, tz] = await Promise.all([getItem(db, id), timeZone()]);
  if (!item) notFound();
  const story = item.storyId && item.storySize > 1 ? await getStory(db, item.storyId) : null;
  const others = story?.items.filter((i) => i.id !== item.id) ?? [];
  const minutes = Math.max(1, Math.round((item.contentHtml?.replace(/<[^>]+>/g, " ").split(/\s+/).length ?? 0) / 220));

  return (
    <article className="measure reader">
      <MarkReadOnOpen itemId={item.id} already={item.isRead} />
      <nav className="nv2-line" style={{ gap: "var(--s2)" }} aria-label="Item">
        <IconLink icon={ChevronLeft} label={story ? "Back to the story" : "Back to Latest"} href={story ? `/stories/${story.id}` : "/latest"} />
        <span className="nv2-fill" />
        {item.url && (
          <LinkButton icon={ExternalLink} href={item.url} target="_blank" rel="noopener noreferrer">
            Open original
          </LinkButton>
        )}
      </nav>
      <header className="reader-head">
        <span className="t-eyebrow">
          {item.folder ? `${item.folder} · ` : ""}
          {item.source}
        </span>
        <h1 className="t-hl-page">{item.title}</h1>
        <p className="nv2-line t-meta" style={{ gap: "var(--s3)" }}>
          <Mono name={item.source} />
          <span className="nv2-fill">
            {item.author ? `${item.author} · ` : ""}
            <Time iso={item.publishedAt} tz={tz} /> · {minutes} min
          </span>
        </p>
      </header>
      <hr className="nv2-divider" />
      {item.contentHtml ? (
        // Sanitised at ingest by sanitizeContent(): no scripts, styles, frames or handlers.
        <div className="prose" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
      ) : (
        <p className="t-lead t-muted">This feed sends headlines only. Open the original to read the article.</p>
      )}
      {story && others.length > 0 && (
        <Link href={`/stories/${story.id}`} className="nv2-tile tile-row">
          <MonoStack names={others.map((o) => o.source)} />
          <span className="nv2-fill nv2-stack" style={{ gap: "var(--s1)" }}>
            <span className="t-label t-strong">Part of a story · {story.items.length} items</span>
            <span className="t-meta">Also covered by {[...new Set(others.map((o) => o.source))].join(", ")}</span>
          </span>
          <Icon icon={Layers} />
        </Link>
      )}
    </article>
  );
}
