create table public.flyer_deals (
  id bigint generated always as identity primary key,
  store text not null check (store in ('aldi', 'dirk', 'hoogvliet', 'lidl', 'action')),
  title text not null,
  deal_text text not null,
  price numeric,
  old_price numeric,
  valid_from date,
  valid_until date,
  fetched_at timestamptz not null default now()
);
create index on public.flyer_deals(store);
alter table public.flyer_deals enable row level security;
create policy "signed-in read flyer deals" on public.flyer_deals for select to authenticated using (true);

alter table public.deals drop constraint deals_store_check;
alter table public.deals add constraint deals_store_check check (store in ('ah', 'jumbo', 'aldi', 'dirk', 'hoogvliet', 'lidl', 'action'));

create or replace function private.call_fetch_flyers()
returns void language plpgsql security definer set search_path = private, public as $$
begin
  perform net.http_post(
    url := 'https://qskaepckyhgysnweqzrf.supabase.co/functions/v1/fetch-flyers',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from private.app_config where key = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
end $$;

select cron.schedule('fetch-flyers-weekly', '15 4 * * 3', $$select private.call_fetch_flyers()$$);
