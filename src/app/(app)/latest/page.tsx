import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkAllRead, RefreshButton } from "@/components/actions-ui";
import { ItemList } from "@/components/item-list";
import { Skeleton } from "@/components/skeleton";
import { getLatest } from "@/lib/data";
import { context } from "@/lib/server";
import { timeZone } from "@/lib/tz";

export const metadata: Metadata = { title: "Latest" };

export default function LatestPage(props: PageProps<"/latest">) {
  return (
    <>
      <header className="page-head">
        <div className="nv2-fill">
          <h1 className="t-page">Latest</h1>
        </div>
        <div className="page-tools">
          <RefreshButton />
          <MarkAllRead />
        </div>
      </header>
      <Suspense fallback={<Skeleton kind="list" />}>
        <LatestItems searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function LatestItems({ searchParams }: { searchParams: PageProps<"/latest">["searchParams"] }) {
  const params = await searchParams;
  const unreadOnly = params.show === "unread";
  const before = typeof params.before === "string" && !Number.isNaN(Date.parse(params.before)) ? params.before : null;
  const { db } = await context();
  const [items, tz] = await Promise.all([getLatest(db, { before, unreadOnly }), timeZone()]);
  const older = items.length === 60 ? `/latest?${new URLSearchParams({ ...(unreadOnly ? { show: "unread" } : {}), before: items.at(-1)!.publishedAt })}` : null;
  return (
    <>
      <nav className="nv2-wrap" style={{ gap: "var(--s2)" }} aria-label="Show">
        <Link href="/latest" className="nv2-chip" aria-current={!unreadOnly ? "page" : undefined}>All</Link>
        <Link href="/latest?show=unread" className="nv2-chip" aria-current={unreadOnly ? "page" : undefined}>Unread</Link>
      </nav>
      <ItemList items={items} olderHref={older} unreadOnly={unreadOnly} tz={tz} />
    </>
  );
}
