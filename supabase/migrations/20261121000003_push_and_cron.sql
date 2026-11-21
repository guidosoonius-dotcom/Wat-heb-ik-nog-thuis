-- De echte geheimen staan alleen in de database (private.app_config), niet in git.
create schema if not exists private;
revoke all on schema private from anon, authenticated, public;

create table private.app_config (key text primary key, value text not null);
-- insert into private.app_config(key, value) values
--   ('vapid_public', '<public key>'), ('vapid_private', '<private key>'),
--   ('vapid_subject', 'mailto:...'), ('cron_secret', '<random>');

create or replace function public.get_push_config()
returns json language sql stable security definer set search_path = private as $$
  select json_object_agg(key, value) from private.app_config;
$$;
revoke execute on function public.get_push_config() from anon, authenticated, public;
grant execute on function public.get_push_config() to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function private.call_notify_expiry()
returns void language plpgsql security definer set search_path = private, public as $$
begin
  perform net.http_post(
    url := 'https://qskaepckyhgysnweqzrf.supabase.co/functions/v1/notify-expiry',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from private.app_config where key = 'cron_secret')),
    body := '{}'::jsonb
  );
end $$;

select cron.schedule('notify-expiry-daily', '0 17 * * *', $$select private.call_notify_expiry()$$);
