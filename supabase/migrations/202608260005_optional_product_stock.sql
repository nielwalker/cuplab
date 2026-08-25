begin;

alter table public.products add column track_stock boolean not null default false;
alter table public.products add column stock_quantity integer;
alter table public.products add constraint products_optional_stock_check check(
  (track_stock and unit_type='piece' and stock_quantity is not null and stock_quantity>=0)
  or (not track_stock and stock_quantity is null)
);

create or replace function public.complete_cart(
  p_checkout_key uuid,
  p_items jsonb,
  p_payment_method text,
  p_cash_tendered_centavos bigint default null
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
  stock_product public.products%rowtype;
  result public.orders%rowtype;
begin
  if not public.current_cashier_active() then raise exception 'Not authorized'; end if;
  if p_checkout_key is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty or invalid'; end if;
  if p_payment_method not in ('CASH','GCASH') then raise exception 'Invalid payment method'; end if;

  select * into existing_order from public.orders
  where cashier_id=auth.uid() and checkout_key=p_checkout_key for update;
  if found then
    if existing_order.status='COMPLETED' then return existing_order; end if;
    raise exception 'Checkout is already being processed';
  end if;

  insert into public.orders(order_number,cashier_id,checkout_key,payment_method)
  values(public.make_order_number(),auth.uid(),p_checkout_key,p_payment_method)
  returning id into order_id;

  for item in select value from jsonb_array_elements(p_items) loop
    product_id=(item->>'product_id')::uuid;
    quantity=nullif(item->>'quantity','')::integer;
    weight_kg=nullif(item->>'weight_kg','')::numeric;

    select * into stock_product from public.products where id=product_id for update;
    if not found then raise exception 'Product unavailable'; end if;
    if stock_product.track_stock then
      if quantity is null or quantity<=0 or stock_product.stock_quantity<quantity then
        raise exception 'Insufficient stock for %',stock_product.name;
      end if;
      update public.products
      set stock_quantity=stock_quantity-quantity,updated_at=now()
      where id=product_id;
    end if;

    perform public.set_order_item(order_id,product_id,quantity,weight_kg);
  end loop;

  if p_payment_method='CASH' then
    perform public.retotal_open_order(order_id);
    select * into result from public.orders where id=order_id for update;
    if p_cash_tendered_centavos is null or p_cash_tendered_centavos<result.total_centavos then raise exception 'Cash received is less than the total'; end if;
    update public.orders set cash_tendered_centavos=p_cash_tendered_centavos,change_centavos=p_cash_tendered_centavos-total_centavos where id=order_id;
  else
    update public.orders set cash_tendered_centavos=null,change_centavos=null where id=order_id;
  end if;
  result:=public.complete_order(order_id);
  return result;
end;
$$;

revoke all on function public.complete_cart(uuid,jsonb,text,bigint) from public;
grant execute on function public.complete_cart(uuid,jsonb,text,bigint) to authenticated;

commit;
