alter table public.products
  add column image_url text,
  add column size_label text,
  add column pao_months int check (pao_months is null or pao_months between 1 and 120),
  add column opened_at date,
  add column store text,
  add column use_rate numeric;

create table public.product_events (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  delta int not null,
  created_at timestamptz not null default now()
);
create index on public.product_events(product_id, created_at);
create index on public.product_events(household_id);
alter table public.product_events enable row level security;
create policy "members read events" on public.product_events for select to authenticated using (public.is_member(household_id));

create or replace function public.track_usage()
returns trigger language plpgsql security definer set search_path = public as $$
declare total numeric; n int; first_at timestamptz; span numeric;
begin
  if new.qty < old.qty and not (old.list_checked and not new.list_checked) then
    insert into product_events(product_id, household_id, delta) values (new.id, new.household_id, new.qty - old.qty);
    select sum(-delta), count(*), min(created_at) into total, n, first_at
      from product_events where product_id = new.id and delta < 0 and created_at > now() - interval '90 days';
    if n >= 3 then
      span := greatest(extract(epoch from now() - least(first_at, new.created_at)) / 86400, 14);
      new.use_rate := round(total / span, 4);
    end if;
  end if;
  return new;
end $$;
create trigger products_track_usage before update of qty on public.products
for each row execute function public.track_usage();

alter table public.households add column shortcut_token text not null default encode(gen_random_bytes(16), 'hex');

create or replace function private.call_notify_weekly()
returns void language plpgsql security definer set search_path = private, public as $$
begin
  perform net.http_post(
    url := 'https://qskaepckyhgysnweqzrf.supabase.co/functions/v1/notify-expiry',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from private.app_config where key = 'cron_secret')),
    body := '{"mode":"weekly"}'::jsonb
  );
end $$;
select cron.schedule('notify-weekly', '0 8 * * 6', $$select private.call_notify_weekly()$$);
