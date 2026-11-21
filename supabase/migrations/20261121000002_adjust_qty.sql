create or replace function public.adjust_qty(p_id uuid, p_delta int)
returns public.products language sql security invoker set search_path = public as $$
  update products set qty = greatest(qty + p_delta, 0) where id = p_id returning *;
$$;
revoke execute on function public.adjust_qty(uuid, int) from anon, public;
grant execute on function public.adjust_qty(uuid, int) to authenticated;
