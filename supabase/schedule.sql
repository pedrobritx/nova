-- Fetch due feeds every 15 minutes: Supabase Cron calls Nova's /api/refresh.
--
-- Run once in the Supabase SQL editor after the app is deployed, replacing the two values.
-- The secret must equal CRON_SECRET in Vercel. Both live in Supabase Vault, not in the job.
-- Vercel's Hobby plan runs its own cron jobs only once a day, which is too slow for feeds.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-NOVA-DOMAIN/api/refresh', 'nova_refresh_url');
select vault.create_secret('THE-SAME-VALUE-AS-CRON_SECRET', 'nova_cron_secret');

select cron.schedule(
  'nova-refresh',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'nova_refresh_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'nova_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Check recent runs:
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select status_code, content, created from net._http_response order by created desc limit 10;
-- Stop: select cron.unschedule('nova-refresh');
