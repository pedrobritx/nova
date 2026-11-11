import { Folder } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MarkAllRead } from "@/components/actions-ui";
import { ItemList } from "@/components/item-list";
import { Skeleton } from "@/components/skeleton";
import { StoryTile } from "@/components/stories";
import { Icon } from "@/components/ui";
import { getFolders, getLatest, getToday, isUuid } from "@/lib/data";
import { context } from "@/lib/server";
import { timeZone } from "@/lib/tz";

export default function FolderPage(props: PageProps<"/folders/[id]">) {
  return (
    <Suspense fallback={<Skeleton kind="list" />}>
      <FolderView params={props.params} />
    </Suspense>
  );
}

async function FolderView({ params }: { params: PageProps<"/folders/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { db } = await context();
  const [{ folders }, stories, items, tz] = await Promise.all([getFolders(db), getToday(db, id), getLatest(db, { folderId: id }), timeZone()]);
  const folder = folders.find((f) => f.id === id);
  if (!folder) notFound();
  const merged = stories.filter((s) => s.sourceCount > 1).slice(0, 3);
  return (
    <>
      <header className="page-head">
        <div className="nv2-fill nv2-stack" style={{ gap: "var(--s1)" }}>
          <span className="t-meta nv2-line" style={{ gap: "var(--s2)" }}>
            <Icon icon={Folder} size={16} />
            {folder.sources} {folder.sources === 1 ? "source" : "sources"} · {folder.unread} unread
          </span>
          <h1 className="t-page">{folder.name}</h1>
        </div>
        <div className="page-tools">
          <MarkAllRead folder={id} />
        </div>
      </header>
      {merged.length > 0 && (
        <section className="section" aria-labelledby="stories-h">
          <h2 id="stories-h" className="t-section">Stories</h2>
          <div className="cards">
            {merged.map((s) => <StoryTile key={s.id} story={s} tz={tz} />)}
          </div>
        </section>
      )}
      <ItemList items={items} olderHref={null} showFolder={false} tz={tz} />
    </>
  );
}
