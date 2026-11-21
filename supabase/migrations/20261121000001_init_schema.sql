-- Zie Supabase-project wat-heb-ik-nog-thuis. Toegepast via MCP op 2026-11-21.
create extension if not exists pgcrypto;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ons huis',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members(user_id);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text not null default '#E3EEDF',
  icon text not null default 'box',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.places(household_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  name text not null,
  qty int not null default 0 check (qty >= 0),
  min_qty int not null default 1 check (min_qty >= 0),
  expiry_date date,
  expiry_notified_at timestamptz,
  barcode text,
  on_list boolean not null default false,
  list_qty int check (list_qty is null or list_qty > 0),
  list_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(household_id);
create index on public.products(place_id);
create index on public.products(household_id, barcode);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions(household_id);
create index on public.push_subscriptions(user_id);

create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hh and user_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.expiry_date is distinct from old.expiry_date then
    new.expiry_notified_at = null;
  end if;
  return new;
end $$;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.places enable row level security;
alter table public.products enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "members read household" on public.households for select to authenticated using (public.is_member(id));
create policy "members update household" on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy "members read members" on public.household_members for select to authenticated using (public.is_member(household_id));
create policy "leave household" on public.household_members for delete to authenticated using (user_id = (select auth.uid()));
create policy "members all places" on public.places for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members all products" on public.products for all to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(household_id));

create or replace function public.create_household(p_name text default 'Ons huis')
returns uuid language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  insert into households(name) values (coalesce(nullif(trim(p_name), ''), 'Ons huis')) returning id into hh;
  insert into household_members(household_id, user_id) values (hh, auth.uid());
  insert into places(household_id, name, color, icon, sort) values
    (hh, 'Keuken', '#F6E7D3', 'kitchen', 1),
    (hh, 'Bijkeuken', '#ECE4F1', 'washer', 2),
    (hh, 'Voorraadkast (Marvat)', '#E3EEDF', 'cabinet', 3),
    (hh, 'Badkamer', '#DCEBF3', 'bath', 4);
  return hh;
end $$;

create or replace function public.join_household(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  select id into hh from households where invite_code = upper(trim(p_code));
  if hh is null then raise exception 'Onbekende code'; end if;
  insert into household_members(household_id, user_id) values (hh, auth.uid()) on conflict do nothing;
  return hh;
end $$;

create or replace function public.finish_shopping(p_household uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_member(p_household) then raise exception 'Geen toegang'; end if;
  update products
     set qty = qty + coalesce(list_qty, greatest(min_qty - qty, 1)),
         list_checked = false, on_list = false, list_qty = null
   where household_id = p_household and list_checked;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.create_household(text) from anon, public;
revoke execute on function public.join_household(text) from anon, public;
revoke execute on function public.finish_shopping(uuid) from anon, public;
revoke execute on function public.is_member(uuid) from anon, public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.finish_shopping(uuid) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

alter publication supabase_realtime add table public.products, public.places;
