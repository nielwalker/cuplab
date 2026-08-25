begin;

create or replace function public.delete_order_permanently(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_order public.orders%rowtype;
begin
  if not public.current_cashier_active() then
    raise exception 'Not authorized';
  end if;

  select * into target_order
  from public.orders
  where id=p_order_id
    and cashier_id=auth.uid()
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if target_order.status not in ('COMPLETED','CANCELLED') then
    raise exception 'Open orders cannot be permanently deleted';
  end if;

  delete from public.display_sessions where order_id=target_order.id;
  delete from public.order_items where order_id=target_order.id;
  delete from public.orders where id=target_order.id;
end;
$$;

revoke all on function public.delete_order_permanently(uuid) from public;
grant execute on function public.delete_order_permanently(uuid) to authenticated;

drop function if exists public.archive_order(uuid);

commit;
