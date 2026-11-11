import { Copy, Layers, Link2 } from "lucide-react";
import Link from "next/link";
import type { ItemRow, StoryCard } from "@/lib/data";
import { Art } from "./art";
import { Badge, Mono, MonoStack, Time } from "./ui";

function storyHref(s: { id: string; sourceCount: number; leadItemId: string }) {
  return s.sourceCount > 1 ? `/stories/${s.id}` : `/items/${s.leadItemId}`;
}

function Sources({ story, tz }: { story: StoryCard; tz: string }) {
  return (
    <span className="card-foot t-meta">
      <MonoStack names={story.sources.length ? story.sources : [story.leadSource]} />
      <span className="nv2-fill nv2-clip">
        {story.sourceCount > 1 ? `${story.sourceCount} sources` : story.leadSource} · <Time iso={story.lastItemAt} tz={tz} />
      </span>
    </span>
  );
}

export function LeadStory({ story, tz }: { story: StoryCard; tz: string }) {
  return (
    <Link href={storyHref(story)} className="nv2-tile lead">
      <Art src={story.imageUrl} seed={story.title} />
      <span className="lead-body">
        <span className="t-eyebrow">{story.folder ?? story.leadSource}{story.sourceCount > 1 ? " · Top story" : ""}</span>
        <span className="t-hl-lead">{story.title}</span>
        {story.excerpt && <span className="t-lead t-muted">{story.excerpt}</span>}
        <Sources story={story} tz={tz} />
      </span>
    </Link>
  );
}

export function StoryTile({ story, tz }: { story: StoryCard; tz: string }) {
  return (
    <Link href={storyHref(story)} className="nv2-tile">
      <Art src={story.imageUrl} seed={story.title} />
      <span className="card-body nv2-fill">
        <span className="t-eyebrow">{story.folder ?? story.leadSource}</span>
        <span className="t-hl-card">{story.title}</span>
        <Sources story={story} tz={tz} />
      </span>
    </Link>
  );
}

export function ItemLine({ item, tz, showFolder = true }: { item: ItemRow; tz: string; showFolder?: boolean }) {
  const merged = item.storySize > 1;
  return (
    <Link href={`/items/${item.id}`} className="nv2-row">
      {item.isRead ? <span style={{ width: 8 }} aria-hidden="true" /> : <span className="nv2-dot" role="img" aria-label="Unread" />}
      <Mono name={item.source} />
      <span className="nv2-fill nv2-stack" style={{ gap: "var(--s1)" }}>
        <span className={item.isRead ? "t-hl-row t-muted" : "t-hl-row"}>{item.title}</span>
        <span className="t-meta nv2-clip">
          {item.source}
          {showFolder && item.folder ? ` · ${item.folder}` : ""} · <Time iso={item.publishedAt} tz={tz} />
        </span>
      </span>
      {merged && item.mergedBy === "copy" && <Badge icon={Copy}>Copy</Badge>}
      {merged && item.mergedBy !== "copy" && <Badge icon={Layers}>{item.storySize} sources</Badge>}
    </Link>
  );
}

export function MergeReason({ by }: { by: ItemRow["mergedBy"] }) {
  if (by === "link") return <Badge icon={Link2}>Same link</Badge>;
  if (by === "copy") return <Badge icon={Copy}>Exact copy</Badge>;
  return null;
}

