alter table public.products add column list_checked_at timestamptz;

create or replace function public.check_item(p_id uuid)
returns public.products language sql security invoker set search_path = public as $$
  update products
     set qty = qty + coalesce(list_qty, greatest(min_qty - qty, 1)),
         list_qty = coalesce(list_qty, greatest(min_qty - qty, 1)),
         list_checked = true,
         list_checked_at = now()
   where id = p_id and not list_checked
  returning *;
$$;

create or replace function public.uncheck_item(p_id uuid)
returns public.products language sql security invoker set search_path = public as $$
  update products
     set qty = greatest(qty - coalesce(list_qty, 0), 0),
         list_checked = false,
         list_checked_at = null
   where id = p_id and list_checked
  returning *;
$$;

create or replace function public.finish_shopping(p_household uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_member(p_household) then raise exception 'Geen toegang'; end if;
  update products
     set list_checked = false, list_checked_at = null, on_list = false, list_qty = null
   where household_id = p_household and list_checked;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.check_item(uuid) from anon, public;
revoke execute on function public.uncheck_item(uuid) from anon, public;
grant execute on function public.check_item(uuid) to authenticated;
grant execute on function public.uncheck_item(uuid) to authenticated;
