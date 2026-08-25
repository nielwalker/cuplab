begin;

drop trigger if exists product_audit on public.products;
drop trigger if exists tier_audit on public.ice_price_tiers;
drop function if exists public.audit_product_change();
drop function if exists public.audit_tier_change();

-- Existing checkout/auth functions may still call this helper. Keep its
-- signature but make it a no-op so no audit rows or storage are created.
create or replace function public.write_audit(
  p_action text,
  p_type text,
  p_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  return;
end;
$$;

drop table if exists public.audit_logs;

commit;
