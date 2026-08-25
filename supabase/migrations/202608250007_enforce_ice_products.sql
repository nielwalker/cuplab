begin;

create or replace function public.enforce_ice_product_pricing()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if exists(
    select 1 from public.categories
    where id=new.category_id and slug='ice'
  ) then
    new.unit_type='kilogram';
    new.price_centavos=null;
  elsif new.unit_type='kilogram' then
    raise exception 'Kilogram tier pricing is restricted to the Ice category';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_ice_product_pricing on public.products;
create trigger enforce_ice_product_pricing
before insert or update of category_id,unit_type,price_centavos
on public.products
for each row execute function public.enforce_ice_product_pricing();

update public.products p
set unit_type='kilogram',price_centavos=null,updated_at=now()
from public.categories c
where p.category_id=c.id and c.slug='ice';

commit;
