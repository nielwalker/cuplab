begin;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.assert_owned_open_order(p_order_id);
  delete from public.display_sessions where order_id=p_order_id;
  delete from public.order_items where order_id=p_order_id;
  delete from public.orders
  where id=p_order_id
    and cashier_id=auth.uid()
    and status='OPEN';
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;

-- Remove previously retained cancelled orders and their dependent rows.
delete from public.display_sessions
where order_id in (select id from public.orders where status='CANCELLED');

delete from public.order_items
where order_id in (select id from public.orders where status='CANCELLED');

delete from public.orders where status='CANCELLED';

commit;
