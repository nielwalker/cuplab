begin;

alter table public.order_items
  add column if not exists category_name_snapshot text;

update public.order_items i
set category_name_snapshot=coalesce(c.name,'Uncategorized')
from public.products p
left join public.categories c on c.id=p.category_id
where i.product_id=p.id
  and i.category_name_snapshot is null;

update public.order_items
set category_name_snapshot='Uncategorized'
where category_name_snapshot is null;

alter table public.order_items
  alter column category_name_snapshot set not null;

create or replace function public.snapshot_order_item_category()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.product_id is not null then
    select c.name into new.category_name_snapshot
    from public.products p
    join public.categories c on c.id=p.category_id
    where p.id=new.product_id;
  end if;
  new.category_name_snapshot=coalesce(new.category_name_snapshot,'Uncategorized');
  return new;
end;
$$;

drop trigger if exists snapshot_order_item_category on public.order_items;
create trigger snapshot_order_item_category
before insert or update of product_id
on public.order_items
for each row execute function public.snapshot_order_item_category();

commit;
