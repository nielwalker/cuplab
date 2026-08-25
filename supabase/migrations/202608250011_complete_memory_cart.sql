begin;

alter table public.orders add column if not exists checkout_key uuid;
create unique index if not exists orders_checkout_key_unique
  on public.orders(cashier_id,checkout_key)
  where checkout_key is not null;

-- Remove legacy persisted drafts. Completed sales are untouched.
delete from public.display_sessions
where order_id in (select id from public.orders where status='OPEN');
delete from public.order_items
where order_id in (select id from public.orders where status='OPEN');
delete from public.orders where status='OPEN';

create or replace function public.complete_cart(
  p_checkout_key uuid,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path=''
as $$
declare
  order_id uuid;
  existing_order public.orders%rowtype;
  item jsonb;
  product_id uuid;
  quantity integer;
  weight_kg numeric;
  result public.orders%rowtype;
begin
  if not public.current_cashier_active() then
    raise exception 'Not authorized';
  end if;
  if p_checkout_key is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Cart is empty or invalid';
  end if;

  select * into existing_order
  from public.orders
  where cashier_id=auth.uid() and checkout_key=p_checkout_key
  for update;

  if found then
    if existing_order.status='COMPLETED' then return existing_order; end if;
    raise exception 'Checkout is already being processed';
  end if;

  insert into public.orders(order_number,cashier_id,checkout_key)
  values(public.make_order_number(),auth.uid(),p_checkout_key)
  returning id into order_id;

  for item in select value from jsonb_array_elements(p_items) loop
    product_id=(item->>'product_id')::uuid;
    quantity=nullif(item->>'quantity','')::integer;
    weight_kg=nullif(item->>'weight_kg','')::numeric;
    perform public.set_order_item(order_id,product_id,quantity,weight_kg);
  end loop;

  result:=public.complete_order(order_id);
  return result;
end;
$$;

revoke all on function public.complete_cart(uuid,jsonb) from public;
grant execute on function public.complete_cart(uuid,jsonb) to authenticated;

commit;
