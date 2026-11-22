-- Van het lijstje gehaald bij deze voorraad; komt terug zodra de voorraad daaronder zakt.
alter table public.products add column list_dismissed_qty int;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.expiry_date is distinct from old.expiry_date then
    new.expiry_notified_at = null;
  end if;
  -- Weer genoeg in huis, of gekocht: het 'van het lijstje gehaald' vervalt.
  if new.qty >= new.min_qty or new.list_checked then
    new.list_dismissed_qty = null;
  end if;
  return new;
end $$;

-- Verpakkingsgrootte bij een actie (AH levert die mee) voor de prijs per kg/liter.
alter table public.deals add column size_text text;
