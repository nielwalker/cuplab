insert into public.categories(name,slug,sort_order,is_active)
values('Non-Coffee','non-coffee',15,true)
on conflict(slug) do update
set name=excluded.name,
    sort_order=excluded.sort_order,
    is_active=true,
    updated_at=now();
