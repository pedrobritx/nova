"use client";

import { CircleAlert, FileText, Plus, Search } from "lucide-react";
import { useActionState, useId } from "react";
import { findSource, followFeed, type FindState, type FollowState } from "@/app/actions";
import type { FoundFeed } from "@/lib/feeds/discover";
import { Badge, Body, Icon, Mono, Notice } from "./ui";

export function AddSourceForm() {
  const [found, find, finding] = useActionState<FindState, FormData>(findSource, null);
  const id = useId();
  return (
    <div className="nv2-stack" style={{ gap: "var(--s5)" }}>
      <form action={find} className="nv2-stack" style={{ gap: "var(--s3)" }}>
        <div className="field">
          <label htmlFor={`${id}-address`}>Website or feed address</label>
          <div className="nv2-line" style={{ gap: "var(--s2)" }}>
            <input
              id={`${id}-address`}
              name="address"
              className="input nv2-fill"
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="typeandgrid.example"
              defaultValue={found?.input}
              required
            />
            <button type="submit" className="m-mat m-glass" aria-busy={finding || undefined}>
              <Body />
              <span className="m-label">
                <Icon icon={Search} />
                {finding ? "Finding…" : "Find"}
              </span>
            </button>
          </div>
        </div>
      </form>
      <div aria-live="polite">
        {found?.error && (
          <Notice icon={CircleAlert} error>
            {found.error}
          </Notice>
        )}
        {found?.feeds && (
          <section className="nv2-stack" style={{ gap: "var(--s3)" }} aria-label="Feeds found">
            <p className="t-kicker">{found.feeds.length === 1 ? "1 feed found" : `${found.feeds.length} feeds found`}</p>
            {found.feeds.map((f) => (
              <FeedChoice key={f.url} feed={f} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function FeedChoice({ feed }: { feed: FoundFeed }) {
  const [state, follow, following] = useActionState<FollowState, FormData>(followFeed, null);
  const id = useId();
  return (
    <form action={follow} className="nv2-tile card-body" style={{ padding: "var(--s5)", gap: "var(--s4)" }}>
      <input type="hidden" name="feed" value={feed.url} />
      <div className="nv2-line" style={{ gap: "var(--s3)" }}>
        <Mono name={feed.title} large />
        <div className="nv2-fill nv2-stack">
          <span className="t-label t-strong">{feed.title}</span>
          <span className="t-meta nv2-clip">{feed.url}</span>
        </div>
        {feed.fullText && <Badge icon={FileText}>Full text</Badge>}
      </div>
      {feed.latest.length > 0 && (
        <ul className="nv2-points t-body">
          {feed.latest.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <div className="nv2-wrap" style={{ gap: "var(--s3)", alignItems: "flex-end" }}>
        <div className="field nv2-fill" style={{ minWidth: 200 }}>
          <label htmlFor={`${id}-folder`}>Folder (optional)</label>
          <input id={`${id}-folder`} name="folder" className="input" type="text" placeholder="Web & design" maxLength={80} />
        </div>
        <button type="submit" className="m-mat m-pigment" aria-busy={following || undefined}>
          <Body />
          <span className="m-label">
            <Icon icon={Plus} />
            {following ? "Following…" : "Follow"}
          </span>
        </button>
      </div>
      {state?.error && (
        <Notice icon={CircleAlert} error>
          {state.error}
        </Notice>
      )}
    </form>
  );
}
