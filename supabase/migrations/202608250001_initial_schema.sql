begin;
create extension if not exists pgcrypto;

create type public.product_unit_type as enum ('piece','kilogram');
create type public.order_status as enum ('OPEN','COMPLETED','CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), sort_order integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id),
  name text not null check (char_length(name) between 1 and 100), description text check (char_length(description)<=1000),
  price_centavos integer check (price_centavos>=0), image_path text, unit_type public.product_unit_type not null default 'piece',
  is_active boolean not null default true, is_available boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint products_price_by_unit check ((unit_type='piece' and price_centavos is not null) or (unit_type='kilogram' and price_centavos is null))
);
create table public.ice_price_tiers (
  id uuid primary key default gen_random_uuid(), min_kg numeric(10,2) not null check(min_kg>0),
  max_kg numeric(10,2) not null check(max_kg>=min_kg), price_per_kg_centavos integer not null check(price_per_kg_centavos>=0),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  cashier_id uuid not null references public.profiles(id), status public.order_status not null default 'OPEN',
  subtotal_centavos bigint not null default 0 check(subtotal_centavos>=0), total_centavos bigint not null default 0 check(total_centavos>=0),
  created_at timestamptz not null default now(), completed_at timestamptz, cancelled_at timestamptz,
  constraint order_status_timestamps check ((status='OPEN' and completed_at is null and cancelled_at is null) or (status='COMPLETED' and completed_at is not null and cancelled_at is null) or (status='CANCELLED' and cancelled_at is not null and completed_at is null))
);
create unique index one_open_order_per_cashier on public.orders(cashier_id) where status='OPEN';
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null, product_name_snapshot text not null,
  unit_price_centavos_snapshot integer not null check(unit_price_centavos_snapshot>=0), quantity integer check(quantity>0),
  weight_kg numeric(10,2) check(weight_kg>0), line_total_centavos bigint not null check(line_total_centavos>=0), created_at timestamptz not null default now(),
  constraint item_quantity_or_weight check ((quantity is not null and weight_kg is null) or (quantity is null and weight_kg is not null))
);
create index order_items_order_id_idx on public.order_items(order_id);
create table public.display_sessions (
  id uuid primary key default gen_random_uuid(), token_hash text not null unique, order_id uuid not null references public.orders(id) on delete cascade,
  is_active boolean not null default true, created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '12 hours')
);
create index active_display_sessions_idx on public.display_sessions(token_hash) where is_active;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger tiers_touch before update on public.ice_price_tiers for each row execute function public.touch_updated_at();

create or replace function public.prevent_overlapping_ice_tiers() returns trigger language plpgsql set search_path='' as $$
begin if new.is_active and exists(select 1 from public.ice_price_tiers t where t.is_active and t.id<>new.id and numrange(t.min_kg,t.max_kg,'[]') && numrange(new.min_kg,new.max_kg,'[]')) then raise exception using errcode='23514',message='Active ICE price tiers cannot overlap';end if;return new;end$$;
create trigger prevent_tier_overlap before insert or update on public.ice_price_tiers for each row execute function public.prevent_overlapping_ice_tiers();

create or replace function public.current_cashier_active() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and is_active)$$;
revoke all on function public.current_cashier_active() from public; grant execute on function public.current_cashier_active() to authenticated;

alter table public.profiles enable row level security; alter table public.categories enable row level security;
alter table public.products enable row level security; alter table public.ice_price_tiers enable row level security;
alter table public.orders enable row level security; alter table public.order_items enable row level security;
alter table public.display_sessions enable row level security;
create policy profiles_self_read on public.profiles for select to authenticated using(id=auth.uid() and public.current_cashier_active());
create policy cashier_categories_all on public.categories for all to authenticated using(public.current_cashier_active()) with check(public.current_cashier_active());
create policy cashier_products_all on public.products for all to authenticated using(public.current_cashier_active()) with check(public.current_cashier_active());
create policy cashier_tiers_all on public.ice_price_tiers for all to authenticated using(public.current_cashier_active()) with check(public.current_cashier_active());
create policy cashier_orders_read on public.orders for select to authenticated using(cashier_id=auth.uid() and public.current_cashier_active());
create policy cashier_items_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.cashier_id=auth.uid()) and public.current_cashier_active());
create policy cashier_sessions_read on public.display_sessions for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.cashier_id=auth.uid()) and public.current_cashier_active());
-- Compatibility helper retained for RPC signatures; audit storage is disabled.
create or replace function public.write_audit(p_action text,p_type text,p_id uuid,p_metadata jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path='' as $$begin return;end$$;
revoke all on function public.write_audit(text,text,uuid,jsonb) from public;

create or replace function public.make_order_number() returns text language plpgsql security definer set search_path='' as $$declare n int; d text:=to_char(current_date,'YYYYMMDD');begin perform pg_advisory_xact_lock(hashtext('order-number-'||d));select count(*)+1 into n from public.orders where created_at>=current_date and created_at<current_date+1;return 'ORD-'||d||'-'||lpad(n::text,4,'0');end$$;
create or replace function public.get_or_create_open_order() returns uuid language plpgsql security definer set search_path='' as $$declare oid uuid;begin if not public.current_cashier_active() then raise exception 'Not authorized';end if;select id into oid from public.orders where cashier_id=auth.uid() and status='OPEN';if oid is null then insert into public.orders(order_number,cashier_id) values(public.make_order_number(),auth.uid()) returning id into oid;end if;return oid;end$$;
revoke all on function public.get_or_create_open_order() from public;grant execute on function public.get_or_create_open_order() to authenticated;

create or replace function public.retotal_open_order(p_order_id uuid) returns void language plpgsql security definer set search_path='' as $$begin update public.orders set subtotal_centavos=coalesce((select sum(line_total_centavos) from public.order_items where order_id=p_order_id),0),total_centavos=coalesce((select sum(line_total_centavos) from public.order_items where order_id=p_order_id),0) where id=p_order_id and status='OPEN';end$$;
create or replace function public.assert_owned_open_order(p_order_id uuid) returns void language plpgsql security definer set search_path='' as $$begin if not exists(select 1 from public.orders where id=p_order_id and cashier_id=auth.uid() and status='OPEN') or not public.current_cashier_active() then raise exception 'Order is not editable';end if;end$$;

create or replace function public.set_order_item(p_order_id uuid,p_product_id uuid,p_quantity integer default null,p_weight_kg numeric default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype;t public.ice_price_tiers%rowtype;iid uuid;price int;total bigint;begin perform public.assert_owned_open_order(p_order_id);select * into p from public.products where id=p_product_id and is_active and is_available for share;if not found then raise exception 'Product unavailable';end if;
if p.unit_type='piece' then if p_quantity is null or p_quantity<=0 or p_weight_kg is not null then raise exception 'Invalid quantity';end if;price=p.price_centavos;total=price*p_quantity;select id into iid from public.order_items where order_id=p_order_id and product_id=p_product_id and weight_kg is null limit 1;if iid is null then insert into public.order_items(order_id,product_id,product_name_snapshot,unit_price_centavos_snapshot,quantity,line_total_centavos) values(p_order_id,p.id,p.name,price,p_quantity,total) returning id into iid;else update public.order_items set quantity=quantity+p_quantity,unit_price_centavos_snapshot=price,product_name_snapshot=p.name,line_total_centavos=(quantity+p_quantity)*price where id=iid;end if;
else if p_weight_kg is null or p_weight_kg<=0 or p_quantity is not null then raise exception 'Invalid weight';end if;select * into t from public.ice_price_tiers where is_active and p_weight_kg between min_kg and max_kg;if not found then raise exception 'No ICE pricing tier is configured for this weight';end if;price=t.price_per_kg_centavos;total=round(p_weight_kg*price);insert into public.order_items(order_id,product_id,product_name_snapshot,unit_price_centavos_snapshot,weight_kg,line_total_centavos) values(p_order_id,p.id,p.name,price,p_weight_kg,total) returning id into iid;end if;perform public.retotal_open_order(p_order_id);return iid;end$$;
revoke all on function public.set_order_item(uuid,uuid,integer,numeric) from public;grant execute on function public.set_order_item(uuid,uuid,integer,numeric) to authenticated;

create or replace function public.update_order_item(p_item_id uuid,p_quantity integer default null,p_weight_kg numeric default null) returns void language plpgsql security definer set search_path='' as $$declare i public.order_items%rowtype;p public.products%rowtype;t public.ice_price_tiers%rowtype;begin select * into i from public.order_items where id=p_item_id;if not found then raise exception 'Item not found';end if;perform public.assert_owned_open_order(i.order_id);select * into p from public.products where id=i.product_id and is_active and is_available;if not found then raise exception 'Product unavailable';end if;if p.unit_type='piece' then if p_quantity is null or p_quantity<=0 then raise exception 'Invalid quantity';end if;update public.order_items set quantity=p_quantity,unit_price_centavos_snapshot=p.price_centavos,product_name_snapshot=p.name,line_total_centavos=p.price_centavos*p_quantity where id=p_item_id;else if p_weight_kg is null or p_weight_kg<=0 then raise exception 'Invalid weight';end if;select * into t from public.ice_price_tiers where is_active and p_weight_kg between min_kg and max_kg;if not found then raise exception 'No ICE pricing tier is configured for this weight';end if;update public.order_items set weight_kg=p_weight_kg,unit_price_centavos_snapshot=t.price_per_kg_centavos,product_name_snapshot=p.name,line_total_centavos=round(p_weight_kg*t.price_per_kg_centavos) where id=p_item_id;end if;perform public.retotal_open_order(i.order_id);end$$;
revoke all on function public.update_order_item(uuid,integer,numeric) from public;grant execute on function public.update_order_item(uuid,integer,numeric) to authenticated;
create or replace function public.remove_order_item(p_item_id uuid) returns void language plpgsql security definer set search_path='' as $$declare oid uuid;begin select order_id into oid from public.order_items where id=p_item_id;perform public.assert_owned_open_order(oid);delete from public.order_items where id=p_item_id;perform public.retotal_open_order(oid);end$$;
revoke all on function public.remove_order_item(uuid) from public;grant execute on function public.remove_order_item(uuid) to authenticated;

create or replace function public.complete_order(p_order_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$declare o public.orders%rowtype;i record;p public.products%rowtype;t public.ice_price_tiers%rowtype;sum_total bigint:=0;begin select * into o from public.orders where id=p_order_id and cashier_id=auth.uid() for update;if not found or not public.current_cashier_active() then raise exception 'Not authorized';end if;if o.status='COMPLETED' then return o;end if;if o.status<>'OPEN' then raise exception 'Order cannot be completed';end if;if not exists(select 1 from public.order_items where order_id=p_order_id) then raise exception 'Order is empty';end if;for i in select * from public.order_items where order_id=p_order_id for update loop select * into p from public.products where id=i.product_id and is_active and is_available for share;if not found then raise exception 'A product is unavailable';end if;if p.unit_type='piece' then update public.order_items set product_name_snapshot=p.name,unit_price_centavos_snapshot=p.price_centavos,line_total_centavos=p.price_centavos*i.quantity where id=i.id;sum_total=sum_total+p.price_centavos*i.quantity;else select * into t from public.ice_price_tiers where is_active and i.weight_kg between min_kg and max_kg;if not found then raise exception 'No ICE pricing tier is configured for this weight';end if;update public.order_items set product_name_snapshot=p.name,unit_price_centavos_snapshot=t.price_per_kg_centavos,line_total_centavos=round(i.weight_kg*t.price_per_kg_centavos) where id=i.id;sum_total=sum_total+round(i.weight_kg*t.price_per_kg_centavos);end if;end loop;update public.orders set subtotal_centavos=sum_total,total_centavos=sum_total,status='COMPLETED',completed_at=now() where id=p_order_id returning * into o;update public.display_sessions set expires_at=least(expires_at,now()+interval '15 minutes') where order_id=p_order_id and is_active;perform public.write_audit('ORDER_COMPLETED','order',p_order_id,jsonb_build_object('total_centavos',sum_total));return o;end$$;
revoke all on function public.complete_order(uuid) from public;grant execute on function public.complete_order(uuid) to authenticated;
create or replace function public.cancel_order(p_order_id uuid) returns void language plpgsql security definer set search_path='' as $$begin perform public.assert_owned_open_order(p_order_id);delete from public.display_sessions where order_id=p_order_id;delete from public.order_items where order_id=p_order_id;delete from public.orders where id=p_order_id and cashier_id=auth.uid() and status='OPEN';end$$;
revoke all on function public.cancel_order(uuid) from public;grant execute on function public.cancel_order(uuid) to authenticated;

create or replace function public.create_display_session(p_order_id uuid) returns text language plpgsql security definer set search_path='' as $$declare raw text:=encode(gen_random_bytes(32),'hex');begin perform public.assert_owned_open_order(p_order_id);update public.display_sessions set is_active=false where order_id=p_order_id;insert into public.display_sessions(token_hash,order_id) values(encode(digest(raw,'sha256'),'hex'),p_order_id);return raw;end$$;
revoke all on function public.create_display_session(uuid) from public;grant execute on function public.create_display_session(uuid) to authenticated;
create or replace function public.get_display_order(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$declare oid uuid;result jsonb;begin if p_token is null or length(p_token)<>64 then raise exception 'Invalid display';end if;select order_id into oid from public.display_sessions where token_hash=encode(digest(p_token,'sha256'),'hex') and is_active and expires_at>now();if oid is null then raise exception 'Invalid display';end if;select jsonb_build_object('order_number',o.order_number,'status',o.status,'total_centavos',o.total_centavos,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.product_name_snapshot,'quantity',i.quantity,'weight_kg',i.weight_kg,'unit_price_centavos',i.unit_price_centavos_snapshot,'line_total_centavos',i.line_total_centavos) order by i.created_at) from public.order_items i where i.order_id=o.id),'[]'::jsonb)) into result from public.orders o where o.id=oid;return result;end$$;
revoke all on function public.get_display_order(text) from public;grant execute on function public.get_display_order(text) to anon,authenticated;

insert into public.categories(name,slug,sort_order) values ('Coffee','coffee',10),('Soda','soda',20),('Foods','foods',30),('Ice','ice',40),('Beverage','beverage',50),('Others','others',60);
insert into public.ice_price_tiers(min_kg,max_kg,price_per_kg_centavos) values(1,9,1500),(20,29,1300);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy product_images_public_read on storage.objects for select to public using(bucket_id='product-images');
create policy product_images_cashier_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.current_cashier_active());
create policy product_images_cashier_update on storage.objects for update to authenticated using(bucket_id='product-images' and public.current_cashier_active()) with check(bucket_id='product-images' and public.current_cashier_active());
create policy product_images_cashier_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and public.current_cashier_active());

commit;
