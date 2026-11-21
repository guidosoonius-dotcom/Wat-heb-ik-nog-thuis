create table public.deals (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  store text not null check (store in ('ah', 'jumbo')),
  title text not null,
  deal_text text not null,
  price numeric,
  old_price numeric,
  image_url text,
  url text,
  online_only boolean not null default false,
  valid_until date,
  fetched_at timestamptz not null default now()
);
create index on public.deals(household_id);
create index on public.deals(product_id);
alter table public.deals enable row level security;
create policy "members read deals" on public.deals for select to authenticated using (public.is_member(household_id));

alter table public.households add column deals_checked_at timestamptz;

create or replace function private.call_fetch_deals()
returns void language plpgsql security definer set search_path = private, public as $$
begin
  perform net.http_post(
    url := 'https://qskaepckyhgysnweqzrf.supabase.co/functions/v1/fetch-deals',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from private.app_config where key = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;

select cron.schedule('fetch-deals-daily', '30 5 * * *', $$select private.call_fetch_deals()$$);
