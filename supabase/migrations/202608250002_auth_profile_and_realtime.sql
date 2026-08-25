begin;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,full_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)));return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.log_auth_event(p_action text) returns void language plpgsql security definer set search_path='' as $$begin if p_action not in ('LOGIN','LOGOUT') or not public.current_cashier_active() then raise exception 'Invalid authentication event';end if;return;end$$;
revoke all on function public.log_auth_event(text) from public;grant execute on function public.log_auth_event(text) to authenticated;

-- Broadcast only a content-free invalidation signal. Display data still requires the hashed token RPC.
create or replace function public.broadcast_order_change() returns trigger language plpgsql security definer set search_path='' as $$begin perform realtime.send(jsonb_build_object('changed',true),'order_changed','display:orders',false);return coalesce(new,old);end$$;
create trigger order_item_display_change after insert or update or delete on public.order_items for each row execute function public.broadcast_order_change();
create or replace function public.broadcast_order_row_change() returns trigger language plpgsql security definer set search_path='' as $$begin perform realtime.send(jsonb_build_object('changed',true),'order_changed','display:orders',false);return new;end$$;
create trigger order_display_change after update on public.orders for each row execute function public.broadcast_order_row_change();
commit;
