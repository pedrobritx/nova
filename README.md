# Nova

Nova is a feed reader that shows stories rather than items. It follows the websites you choose, fetches their RSS, Atom and JSON feeds, and merges the same news from several sources into one story, so you read it once and see who covered it.

> **Status: in active development since 11 November 2026.** The first slice is the core reading loop. It was paused on 9 November and resumed in Glassfolio's slot in the portfolio plan.

## What works

- **Following sources:** paste a website or feed address and Nova finds the feed. You can also import an OPML file (folders included) and export your library as OPML.
- **Today:** stories from the last two days, the ones your sources covered most first.
- **Latest:** every item, newest first, grouped by day, with an unread filter.
- **Folders, Story and Reader:** a Story page shows every source's coverage and why the items were merged. The Reader shows the full article when the feed sends it, and marks the item read once you have opened it.
- **Merging:** items from different feeds join one story when they link to the same article or carry the same words, within a week. Tracking parameters, `www.`, trailing slashes and parameter order don't count as differences.
- **Fetching:** each feed is fetched once however many people follow it. Nova sends `ETag` and `Last-Modified`, backs off after errors and respects `Retry-After`.
- **Look:** Meridian 1.0, Ocean environment, Dawn and Dusk; a sidebar on desks and a tab bar on phones.

Not yet built: summaries, the spoken briefing, monitors and alerts, boards, highlights, search, the command menu, page change tracking and offline reading. These follow the wireframes in the Nova design canvas.

## Stack

Next.js 16 (App Router, Cache Components) with TypeScript, Supabase (Postgres, Auth, Cron) and Vercel. The look comes from Meridian 1.0 ([pedrobritx/meridian](https://github.com/pedrobritx/meridian)), pinned to a commit in `package.json`.

The app talks to its database only through the `nova_*` SQL functions in `supabase/migrations`. Row-level security limits every person to the feeds they follow. The same functions also run on PGlite, an in-process Postgres, for the tests and for demo mode.

## Run it

Requires Node 22 or later.

```sh
npm install
npm run dev:demo
```

Demo mode needs no accounts. It starts an in-memory database with sample feeds on reserved `.example` addresses, runs them through the real parser and merge rules, and signs you in as a demo reader. Nothing is saved when the server stops.

```sh
npm run check      # types, lint and tests
npm run build
```

## Set up Supabase and Vercel

1. Create a Supabase project. Apply the migration with `npx supabase db push`, or paste `supabase/migrations/*.sql` into the SQL editor.
2. In **Authentication → URL configuration**, add `https://YOUR-DOMAIN/auth/confirm` to the redirect URLs. Sign-in is by emailed link.
3. Copy `.env.example` to `.env.local` and fill in the URL, publishable key, secret key and a `CRON_SECRET` of at least 32 characters (`openssl rand -hex 32`). Add the same variables to the Vercel project.
4. Deploy, then run `supabase/schedule.sql` in the SQL editor with your domain and secret. Supabase Cron then calls `/api/refresh` every 15 minutes. Vercel's Hobby plan only runs its own cron jobs once a day.

The secret key bypasses row-level security. It is used only by the fetcher, on the server.

## Layout

```
src/app/            routes: (app) pages, sign-in, auth callback, api/refresh, api/opml
src/components/     interface parts on Meridian's materials
src/lib/feeds/      fetching (with network guards), parsing, discovery, OPML, sanitising
src/lib/db/         Supabase and PGlite connections to the nova_* functions
src/lib/demo/       sample feeds for demo mode
supabase/           migrations and the refresh schedule
tests/              Vitest: feeds, network guards, database rules, refresh, demo library
```
