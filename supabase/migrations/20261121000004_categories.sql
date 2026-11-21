create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.categories(household_id);
create index on public.categories(place_id);

alter table public.products add column category_id uuid references public.categories(id) on delete set null;
create index on public.products(category_id);

alter table public.categories enable row level security;
create policy "members all categories" on public.categories for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

alter publication supabase_realtime add table public.categories;

create or replace function private.seed_categories(hh uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; i int;
begin
  for r in
    select p.id, c.names from places p
    join (values
      ('keuken', array['Broodbeleg','Ontbijt','Afwas','Keukenspullen']),
      ('bijkeuken', array['Schoonmaak','Was','Papier','Huishouden','Baby']),
      ('voorraadkast', array['Pasta & rijst','Conserven','Sauzen & kruiden','Bakken','Koffie & thee','Snacks','Dranken']),
      ('badkamer', array['Tandverzorging','Haar & douche','Huid & lichaam','Hygiëne','Medicijnen'])
    ) as c(prefix, names) on lower(p.name) like c.prefix || '%'
    where p.household_id = hh
  loop
    for i in 1 .. array_length(r.names, 1) loop
      insert into categories(household_id, place_id, name, sort)
      select hh, r.id, r.names[i], i
      where not exists (select 1 from categories where place_id = r.id and lower(name) = lower(r.names[i]));
    end loop;
  end loop;
end $$;

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
  perform private.seed_categories(hh);
  return hh;
end $$;

select private.seed_categories(id) from public.households;
