-- Nova: the reading loop.
--
-- Feeds, items and stories are shared: a feed is fetched once however many people follow
-- it, and duplicates are merged once. What a person sees is limited by row-level security
-- to the feeds they follow. People change their own folders, subscriptions and read state
-- through the nova_* functions; the fetcher writes feeds and items with the service role.

-- ---------------------------------------------------------------- Tables

create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https?://'),
  site_url text,
  title text not null default '',
  description text,
  format text check (format in ('rss', 'atom', 'json', 'rdf')),
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  next_fetch_at timestamptz not null default now(),
  error_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index feeds_due on public.feeds (next_fetch_at);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_id uuid not null references public.feeds (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text check (title is null or char_length(title) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, feed_id)
);
create index subscriptions_feed on public.subscriptions (feed_id);
create index subscriptions_folder on public.subscriptions (folder_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  link_key text,
  first_item_at timestamptz not null,
  last_item_at timestamptz not null,
  item_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index stories_recent on public.stories (last_item_at desc);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds (id) on delete cascade,
  story_id uuid references public.stories (id) on delete set null,
  guid text not null,
  url text,
  link_key text,
  title text not null,
  excerpt text,
  content_html text,
  author text,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  content_hash text,
  merged_by text check (merged_by in ('link', 'copy')),
  unique (feed_id, guid)
);
create index items_feed_recent on public.items (feed_id, published_at desc);
create index items_story on public.items (story_id);
create index items_link_key on public.items (link_key, published_at) where link_key is not null;
create index items_content_hash on public.items (content_hash, published_at) where content_hash is not null;

create table public.item_states (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------- Row-level security

alter table public.feeds enable row level security;
alter table public.folders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stories enable row level security;
alter table public.items enable row level security;
alter table public.item_states enable row level security;

create policy "Followed feeds" on public.feeds for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.feed_id = feeds.id and s.user_id = (select auth.uid())));

create policy "Own folders" on public.folders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Own subscriptions" on public.subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Items from followed feeds" on public.items for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.feed_id = items.feed_id and s.user_id = (select auth.uid())));

create policy "Stories with a followed item" on public.stories for select to authenticated
  using (exists (
    select 1 from public.items i join public.subscriptions s on s.feed_id = i.feed_id
    where i.story_id = stories.id and s.user_id = (select auth.uid())
  ));

create policy "Own read state" on public.item_states for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.feeds, public.folders, public.subscriptions, public.stories, public.items, public.item_states from anon, authenticated;
grant select on public.feeds, public.stories, public.items to authenticated;
grant select, insert, update, delete on public.folders, public.subscriptions, public.item_states to authenticated;
grant all on public.feeds, public.folders, public.subscriptions, public.stories, public.items, public.item_states to service_role;

-- ---------------------------------------------------------------- Fetcher (service role only)

-- Register a feed URL, or return the existing one. New feeds are due at once.
create function public.nova_upsert_feed(p_url text, p_title text, p_site_url text, p_format text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.feeds (url, title, site_url, format, description)
  values (p_url, coalesce(p_title, ''), p_site_url, p_format, p_description)
  on conflict (url) do update set
    title = case when public.feeds.title = '' then excluded.title else public.feeds.title end,
    site_url = coalesce(public.feeds.site_url, excluded.site_url),
    format = coalesce(excluded.format, public.feeds.format)
  returning id into v_id;
  return v_id;
end $$;

-- Feeds whose next fetch is due, oldest first. Claiming moves next_fetch_at forward so two
-- overlapping runs do not fetch the same feed.
create function public.nova_claim_due_feeds(p_limit integer)
returns setof public.feeds language sql security definer set search_path = '' as $$
  update public.feeds f set next_fetch_at = now() + interval '10 minutes'
  where f.id in (
    select id from public.feeds
    where next_fetch_at <= now() and exists (select 1 from public.subscriptions s where s.feed_id = feeds.id)
    order by next_fetch_at
    limit p_limit
    for update skip locked
  )
  returning f.*;
$$;

-- Record the outcome of a fetch and schedule the next one: every 15 minutes while healthy,
-- backing off to a day after repeated errors, never sooner than the site asked.
create function public.nova_feed_fetched(
  p_feed_id uuid, p_ok boolean, p_error text, p_etag text, p_last_modified text,
  p_title text, p_site_url text, p_retry_after_seconds integer
) returns void language plpgsql security definer set search_path = '' as $$
declare v_errors integer; v_wait interval;
begin
  update public.feeds set
    last_fetched_at = now(),
    last_success_at = case when p_ok then now() else last_success_at end,
    error_count = case when p_ok then 0 else error_count + 1 end,
    last_error = case when p_ok then null else left(p_error, 300) end,
    etag = case when p_ok then coalesce(p_etag, etag) else etag end,
    last_modified = case when p_ok then coalesce(p_last_modified, last_modified) else last_modified end,
    title = case when p_ok and coalesce(p_title, '') <> '' then p_title else title end,
    site_url = case when p_ok then coalesce(p_site_url, site_url) else site_url end
  where id = p_feed_id
  returning error_count into v_errors;

  v_wait := least(interval '15 minutes' * power(2, least(v_errors, 7)), interval '24 hours');
  if p_retry_after_seconds is not null then
    v_wait := greatest(v_wait, make_interval(secs => least(p_retry_after_seconds, 86400)));
  end if;
  update public.feeds set next_fetch_at = now() + v_wait where id = p_feed_id;
end $$;

-- Store a feed's items and merge each new one into a story: an earlier item from the last
-- seven days with the same link, or with exactly the same words, joins it; otherwise the
-- item starts a story of its own. Returns how many items were new.
create function public.nova_ingest_items(p_feed_id uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  v_existing uuid;
  v_story uuid;
  v_by text;
  v_published timestamptz;
  v_link text;
  v_hash text;
  v_key bigint;
  v_new integer := 0;
begin
  -- Serialise merges on the same link or text, so two feeds arriving together share one
  -- story. Every lock the batch needs is taken up front, in one global order, so two
  -- refreshes can never each hold a lock the other is waiting for.
  for v_key in
    select k from (
      select hashtextextended(e ->> 'linkKey', 0) as k from jsonb_array_elements(p_items) e where nullif(e ->> 'linkKey', '') is not null
      union
      select hashtextextended(e ->> 'contentHash', 1) from jsonb_array_elements(p_items) e where nullif(e ->> 'contentHash', '') is not null
    ) keys
    order by k
  loop
    perform pg_advisory_xact_lock(v_key);
  end loop;

  for it in select * from jsonb_array_elements(p_items) loop
    v_published := (it ->> 'publishedAt')::timestamptz;
    v_link := nullif(it ->> 'linkKey', '');
    v_hash := nullif(it ->> 'contentHash', '');

    select id into v_existing from public.items where feed_id = p_feed_id and guid = it ->> 'guid';
    if v_existing is not null then
      -- A feed corrected an item: replace its text, address and fingerprints together, so the
      -- Reader opens the current address and later items are compared with what is actually
      -- stored. The row is written only when something changed. Its story stays as it is.
      update public.items set
        title = it ->> 'title', excerpt = it ->> 'excerpt', content_html = it ->> 'contentHtml', content_hash = v_hash,
        url = coalesce(it ->> 'url', url), link_key = coalesce(v_link, link_key),
        image_url = coalesce(it ->> 'imageUrl', image_url), author = coalesce(it ->> 'author', author)
      where id = v_existing
        and (title, excerpt, content_html, content_hash, url, link_key, image_url, author)
        is distinct from (it ->> 'title', it ->> 'excerpt', it ->> 'contentHtml', v_hash,
                          coalesce(it ->> 'url', url), coalesce(v_link, link_key),
                          coalesce(it ->> 'imageUrl', image_url), coalesce(it ->> 'author', author));
      continue;
    end if;

    v_story := null; v_by := null;
    if v_link is not null then
      select story_id into v_story from public.items
      where link_key = v_link and story_id is not null and feed_id <> p_feed_id
        and published_at between v_published - interval '7 days' and v_published + interval '7 days'
      order by published_at limit 1;
      if v_story is not null then v_by := 'link'; end if;
    end if;
    if v_story is null and v_hash is not null then
      select story_id into v_story from public.items
      where content_hash = v_hash and story_id is not null and feed_id <> p_feed_id
        and published_at between v_published - interval '7 days' and v_published + interval '7 days'
      order by published_at limit 1;
      if v_story is not null then v_by := 'copy'; end if;
    end if;

    if v_story is null then
      insert into public.stories (title, link_key, first_item_at, last_item_at, item_count)
      values (it ->> 'title', v_link, v_published, v_published, 0)
      returning id into v_story;
    end if;

    insert into public.items (feed_id, story_id, guid, url, link_key, title, excerpt, content_html, author, image_url, published_at, content_hash, merged_by)
    values (p_feed_id, v_story, it ->> 'guid', it ->> 'url', v_link, it ->> 'title', it ->> 'excerpt', it ->> 'contentHtml',
            it ->> 'author', it ->> 'imageUrl', v_published, v_hash, v_by)
    on conflict (feed_id, guid) do nothing;
    if found then
      update public.stories set
        item_count = item_count + 1,
        first_item_at = least(first_item_at, v_published),
        last_item_at = greatest(last_item_at, v_published)
      where id = v_story;
      v_new := v_new + 1;
    end if;
  end loop;
  return v_new;
end $$;

revoke execute on function public.nova_upsert_feed, public.nova_claim_due_feeds, public.nova_feed_fetched, public.nova_ingest_items from public, anon, authenticated;
grant execute on function public.nova_upsert_feed, public.nova_claim_due_feeds, public.nova_feed_fetched, public.nova_ingest_items to service_role;

-- ---------------------------------------------------------------- Reading (as the signed-in person)

-- How many of your own sources covered a story. Stories are shared, so their stored item
-- count includes feeds you do not follow; this counts only what you can see.
create function public.nova_story_sources(p_story uuid)
returns integer language sql stable security invoker set search_path = '' as $$
  select greatest(count(distinct i.feed_id), 1)::integer from public.items i
  join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
  where i.story_id = p_story;
$$;

-- Today: stories from the last two days, the ones covered by the most of your sources first.
create function public.nova_today(p_limit integer default 30, p_folder uuid default null)
returns table (
  story_id uuid, title text, last_item_at timestamptz, source_count integer, unread_count integer,
  lead_item_id uuid, lead_url text, lead_excerpt text, lead_image_url text, lead_feed_title text,
  folder_name text, sources text[]
) language sql stable security invoker set search_path = '' as $$
  with visible as (
    select i.*, coalesce(s.title, f.title) as feed_title, fo.name as folder_name,
           (st.item_id is not null) as is_read
    from public.items i
    join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
    join public.feeds f on f.id = i.feed_id
    left join public.folders fo on fo.id = s.folder_id
    left join public.item_states st on st.item_id = i.id and st.user_id = (select auth.uid())
    where i.published_at > now() - interval '48 hours'
      and (p_folder is null or s.folder_id = p_folder)
  ),
  grouped as (
    select story_id, max(published_at) as last_item_at, count(distinct feed_id)::integer as source_count,
           count(*) filter (where not is_read)::integer as unread_count,
           array_agg(distinct feed_title) as sources
    from visible group by story_id
  )
  select g.story_id, lead.title, g.last_item_at, g.source_count, g.unread_count,
         lead.id, lead.url, lead.excerpt, lead.image_url, lead.feed_title, lead.folder_name, g.sources
  from grouped g
  cross join lateral (
    select v.* from visible v where v.story_id = g.story_id
    -- Lead with the fullest original: never a copy, a picture if there is one, then the most text.
    order by coalesce(v.merged_by = 'copy', false), (v.image_url is null), length(coalesce(v.content_html, '')) desc, v.published_at, v.id
    limit 1
  ) lead
  where g.unread_count > 0 or g.last_item_at > now() - interval '6 hours'
  order by (g.unread_count > 0) desc, g.source_count desc, g.last_item_at desc
  limit p_limit;
$$;

-- Latest: every item, newest first, with how many of your sources covered its story and your
-- read state. Pages continue after (p_before, p_before_id), so items sharing a timestamp are
-- never skipped.
create function public.nova_latest(p_limit integer default 60, p_before timestamptz default null, p_before_id uuid default null, p_folder uuid default null, p_feed uuid default null, p_unread_only boolean default false)
returns table (
  item_id uuid, story_id uuid, title text, url text, excerpt text, image_url text, published_at timestamptz,
  feed_id uuid, feed_title text, folder_name text, is_read boolean, story_size integer, merged_by text
) language sql stable security invoker set search_path = '' as $$
  select i.id, i.story_id, i.title, i.url, i.excerpt, i.image_url, i.published_at,
         i.feed_id, coalesce(s.title, f.title), fo.name, (st.item_id is not null),
         public.nova_story_sources(i.story_id), i.merged_by
  from public.items i
  join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
  join public.feeds f on f.id = i.feed_id
  left join public.folders fo on fo.id = s.folder_id
  left join public.item_states st on st.item_id = i.id and st.user_id = (select auth.uid())
  where (p_before is null or (i.published_at, i.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    and (p_folder is null or s.folder_id = p_folder)
    and (p_feed is null or i.feed_id = p_feed)
    and (not p_unread_only or st.item_id is null)
  order by i.published_at desc, i.id desc
  limit p_limit;
$$;

-- One story and every item in it you can see, oldest first, with why each was merged.
-- Its heading is the current headline of the item Today leads with, chosen only from your
-- own sources, so a corrected headline shows everywhere and a feed you do not follow never
-- names the story.
create function public.nova_story(p_story uuid)
returns table (
  story_id uuid, story_title text, item_id uuid, title text, url text, excerpt text, image_url text,
  published_at timestamptz, feed_id uuid, feed_title text, folder_name text, merged_by text, is_read boolean, content_length integer
) language sql stable security invoker set search_path = '' as $$
  select i.story_id,
         first_value(i.title) over (
           order by coalesce(i.merged_by = 'copy', false), (i.image_url is null), length(coalesce(i.content_html, '')) desc, i.published_at, i.id
         ),
         i.id, i.title, i.url, i.excerpt, i.image_url, i.published_at,
         i.feed_id, coalesce(s.title, f.title), fo.name, i.merged_by, (st.item_id is not null),
         length(coalesce(i.content_html, ''))
  from public.items i
  join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
  join public.feeds f on f.id = i.feed_id
  left join public.folders fo on fo.id = s.folder_id
  left join public.item_states st on st.item_id = i.id and st.user_id = (select auth.uid())
  where i.story_id = p_story
  order by i.published_at, i.id;
$$;

-- One item to read, with how many of your sources covered its story.
create function public.nova_item(p_item uuid)
returns table (
  item_id uuid, story_id uuid, title text, url text, author text, content_html text, excerpt text, image_url text,
  published_at timestamptz, feed_id uuid, feed_title text, site_url text, folder_name text, is_read boolean, story_size integer
) language sql stable security invoker set search_path = '' as $$
  select i.id, i.story_id, i.title, i.url, i.author, i.content_html, i.excerpt, i.image_url, i.published_at,
         i.feed_id, coalesce(s.title, f.title), f.site_url, fo.name, (st.item_id is not null), public.nova_story_sources(i.story_id)
  from public.items i
  join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
  join public.feeds f on f.id = i.feed_id
  left join public.folders fo on fo.id = s.folder_id
  left join public.item_states st on st.item_id = i.id and st.user_id = (select auth.uid())
  where i.id = p_item;
$$;

-- Sources you follow with their health and recent volume.
create function public.nova_sources()
returns table (
  subscription_id uuid, feed_id uuid, title text, url text, site_url text, folder_id uuid, folder_name text,
  last_success_at timestamptz, error_count integer, last_error text, items_this_week integer, unread integer
) language sql stable security invoker set search_path = '' as $$
  select s.id, f.id, coalesce(s.title, nullif(f.title, ''), f.url), f.url, f.site_url, s.folder_id, fo.name,
         f.last_success_at, f.error_count, f.last_error,
         (select count(*)::integer from public.items i where i.feed_id = f.id and i.published_at > now() - interval '7 days'),
         (select count(*)::integer from public.items i
            where i.feed_id = f.id and i.published_at > now() - interval '30 days'
              and not exists (select 1 from public.item_states st where st.item_id = i.id and st.user_id = (select auth.uid())))
  from public.subscriptions s
  join public.feeds f on f.id = s.feed_id
  left join public.folders fo on fo.id = s.folder_id
  where s.user_id = (select auth.uid())
  order by fo.position nulls last, fo.name nulls last, lower(coalesce(s.title, f.title));
$$;

-- Folders with their unread counts, for the sidebar. Unread counts look back 30 days.
create function public.nova_folders()
returns table (folder_id uuid, name text, unread integer, sources integer)
language sql stable security invoker set search_path = '' as $$
  select fo.id, fo.name,
         (select count(*)::integer from public.items i join public.subscriptions s on s.feed_id = i.feed_id
            where s.folder_id = fo.id and s.user_id = (select auth.uid()) and i.published_at > now() - interval '30 days'
              and not exists (select 1 from public.item_states st where st.item_id = i.id and st.user_id = (select auth.uid()))),
         (select count(*)::integer from public.subscriptions s where s.folder_id = fo.id)
  from public.folders fo
  where fo.user_id = (select auth.uid())
  order by fo.position, fo.name;
$$;

create function public.nova_unread_total()
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::integer from public.items i
  join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
  where i.published_at > now() - interval '30 days'
    and not exists (select 1 from public.item_states st where st.item_id = i.id and st.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------- Changing your library

-- Follow a feed (already registered by the fetcher), optionally into a folder by name and
-- under your own name for it (an OPML import keeps the names you gave your sources).
create function public.nova_follow(p_feed uuid, p_folder_name text default null, p_title text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_folder uuid; v_sub uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if nullif(btrim(p_folder_name), '') is not null then
    insert into public.folders (name, position)
    values (btrim(p_folder_name), coalesce((select max(position) + 1 from public.folders where user_id = (select auth.uid())), 0))
    on conflict (user_id, name) do nothing;
    select id into v_folder from public.folders where user_id = (select auth.uid()) and name = btrim(p_folder_name);
  end if;
  insert into public.subscriptions (feed_id, folder_id, title) values (p_feed, v_folder, left(nullif(btrim(p_title), ''), 120))
  on conflict (user_id, feed_id) do update set
    folder_id = coalesce(excluded.folder_id, public.subscriptions.folder_id),
    title = coalesce(excluded.title, public.subscriptions.title)
  returning id into v_sub;
  return v_sub;
end $$;

create function public.nova_mark_read(p_items uuid[])
returns void language sql security invoker set search_path = '' as $$
  insert into public.item_states (item_id)
  select i.id from public.items i where i.id = any (p_items)
  on conflict do nothing;
$$;

create function public.nova_mark_unread(p_items uuid[])
returns void language sql security invoker set search_path = '' as $$
  delete from public.item_states where user_id = (select auth.uid()) and item_id = any (p_items);
$$;

-- Mark everything you can see as read: a story, a folder, a feed or the whole library.
create function public.nova_mark_all_read(p_story uuid default null, p_folder uuid default null, p_feed uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  insert into public.item_states (item_id)
  select i.id from public.items i
  join public.subscriptions s on s.feed_id = i.feed_id and s.user_id = (select auth.uid())
  where (p_story is null or i.story_id = p_story)
    and (p_folder is null or s.folder_id = p_folder)
    and (p_feed is null or i.feed_id = p_feed)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Stop following a feed. Read state for its items is kept in case you follow it again.
create function public.nova_unfollow(p_subscription uuid)
returns void language sql security invoker set search_path = '' as $$
  delete from public.subscriptions where id = p_subscription and user_id = (select auth.uid());
$$;

-- Move a source into a folder by name (created if new), or out of folders with null.
-- Folders left empty are removed.
create function public.nova_move_source(p_subscription uuid, p_folder_name text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_folder uuid;
begin
  if nullif(btrim(p_folder_name), '') is not null then
    insert into public.folders (name, position)
    values (btrim(p_folder_name), coalesce((select max(position) + 1 from public.folders where user_id = (select auth.uid())), 0))
    on conflict (user_id, name) do nothing;
    select id into v_folder from public.folders where user_id = (select auth.uid()) and name = btrim(p_folder_name);
  end if;
  update public.subscriptions set folder_id = v_folder where id = p_subscription and user_id = (select auth.uid());
  delete from public.folders fo where fo.user_id = (select auth.uid())
    and not exists (select 1 from public.subscriptions s where s.folder_id = fo.id);
end $$;

revoke execute on function public.nova_story_sources, public.nova_today, public.nova_latest, public.nova_story, public.nova_item, public.nova_sources,
  public.nova_folders, public.nova_unread_total, public.nova_follow, public.nova_mark_read, public.nova_mark_unread,
  public.nova_mark_all_read, public.nova_unfollow, public.nova_move_source from public, anon;
grant execute on function public.nova_story_sources, public.nova_today, public.nova_latest, public.nova_story, public.nova_item, public.nova_sources,
  public.nova_folders, public.nova_unread_total, public.nova_follow, public.nova_mark_read, public.nova_mark_unread,
  public.nova_mark_all_read, public.nova_unfollow, public.nova_move_source to authenticated, service_role;
