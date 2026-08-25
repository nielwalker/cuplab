begin;

create policy orders_owner_read on public.orders for select to authenticated
using(public.current_user_is_owner());

create policy order_items_owner_read on public.order_items for select to authenticated
using(public.current_user_is_owner());

commit;
