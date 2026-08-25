begin;
create or replace function public.delete_product_permanently(p_product_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare deleted_image_path text;
begin
  if not public.current_user_is_owner() then raise exception 'Owner access required'; end if;
  delete from public.products where id=p_product_id returning image_path into deleted_image_path;
  if not found then raise exception 'Product not found'; end if;
  return deleted_image_path;
end$$;
revoke all on function public.delete_product_permanently(uuid) from public;
grant execute on function public.delete_product_permanently(uuid) to authenticated;
commit;
