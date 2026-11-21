# Guest mode

Nova can be used without an account at `/guest`. From `/sign-in`, choose **Continue as guest**.

## Storage and privacy

- Feeds, folders, articles, read/unread and read-later flags, and the unread-only preference stay in **IndexedDB in this browser profile**. Nothing in guest mode is written to Supabase.
- Closing or restarting the browser preserves this data. Clearing site storage, using private browsing or removing a browser profile may erase it. Deleting cached images/files alone does not necessarily erase IndexedDB.
- Guest libraries do not sync between devices. No automatic migration into a signed-in account currently exists. Export OPML under Sources or Settings, sign in, then import the file; OPML preserves subscriptions and folders, not read history.
- The guest reader reuses Nova's SSRF-guarded `safeFetch()`, feed discovery and sanitised RSS/Atom/JSON parser. Previously downloaded items remain visible while offline after the site has loaded, but the application is not an offline PWA.
- Authenticated routes and account-backed data are unchanged. Production sign-in and Supabase RLS continue to apply to those routes.

## Security and deployment

The public `POST /api/guest/feeds` endpoint has URL, body-size, origin and best-effort per-instance request checks. Feed requests are bounded and can only reach public HTTP(S) addresses, including after redirects. It never calls the service-role Supabase client.

**Before production release, add and verify a durable per-IP rate limit at the hosting edge/WAF for `/api/guest/feeds`.** The in-process limit is not durable across Vercel functions or regions. Keep the route out of production until the platform rule has been confirmed.

## Acceptance checklist

1. Signed-out users can open `/guest` and add RSS, Atom and JSON sources without a redirect to sign-in.
2. Read flags, saved articles, folders and subscriptions survive reloads and browser restarts in the same browser profile.
3. A private window or another device has a different guest library.
4. OPML export and import preserve feed URLs, titles and folders.
5. `npm run check` and `npm run build` succeed in a clean Node 22 environment.
6. URLs resolving to internal/loopback networks or redirecting there are rejected.
7. Cross-origin browser posts, oversize requests and high-rate bursts are rejected.
8. Edge/WAF rate limiting is configured and tested before merge/deployment.
9. Signed-in source management and Supabase account settings still work.

Note: guest mode currently has a dedicated reader, not Nova's full authenticated story-clustering UI.