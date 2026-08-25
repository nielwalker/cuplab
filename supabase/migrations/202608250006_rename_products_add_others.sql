begin;

do $$
declare
  products_category_id uuid;
  ice_category_id uuid;
begin
  select id into products_category_id
  from public.categories
  where slug='products';

  select id into ice_category_id
  from public.categories
  where slug='ice';

  if products_category_id is not null and ice_category_id is null then
    update public.categories
    set name='Ice',slug='ice',sort_order=40,is_active=true,updated_at=now()
    where id=products_category_id;
  elsif products_category_id is not null and ice_category_id is not null then
    update public.products
    set category_id=ice_category_id,updated_at=now()
    where category_id=products_category_id;

    delete from public.categories where id=products_category_id;
  elsif ice_category_id is null then
    insert into public.categories(name,slug,sort_order,is_active)
    values('Ice','ice',40,true);
  else
    update public.categories
    set name='Ice',sort_order=40,is_active=true,updated_at=now()
    where id=ice_category_id;
  end if;
end$$;

insert into public.categories(name,slug,sort_order,is_active)
values('Others','others',60,true)
on conflict(slug) do update
set name=excluded.name,
    sort_order=excluded.sort_order,
    is_active=true,
    updated_at=now();

commit;
