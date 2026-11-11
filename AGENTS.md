# Nova: agent guide

Nova is a feed reader built on Next.js 16, Supabase and Meridian 1.0. Read README.md first.

- Write code, comments and documentation in English, with British spelling.
- The database is reached only through the `nova_*` functions in `supabase/migrations`. Add or change a function there, with a test in `tests/db.test.ts`, instead of querying tables from the app.
- Never edit a migration that has been applied to a Supabase project; add a new one.
- Feed content is untrusted. It is stored only after `sanitizeContent()`, and every outbound request goes through `safeFetch()`.
- The service client (`serviceDb()`) bypasses row-level security. Only the fetcher and the follow and import flows use it, and only with feeds Nova has fetched and parsed itself.
- Server actions and route handlers start with `context()`, which checks the session.
- Look and spacing come from Meridian tokens and the `.t-*` type scale (`src/styles`). Change Meridian itself in its own repository; Nova only pins a commit.
- Text must stay readable: 4.5:1 for body text, 3:1 for large text and icons, in Dawn and Dusk.
- Run `npm run check` and `npm run build` before committing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
