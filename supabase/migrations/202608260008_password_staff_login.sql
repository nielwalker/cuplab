begin;

alter table public.attendance_sessions drop constraint if exists attendance_sessions_login_method_check;
alter table public.attendance_sessions add constraint attendance_sessions_login_method_check
  check(login_method in ('FACE','ADMIN_RECOVERY','PASSWORD'));

create or replace function public.start_attendance(p_login_method text default 'PASSWORD') returns public.attendance_sessions
language plpgsql security definer set search_path='' as $$
declare result public.attendance_sessions%rowtype;
begin
  if not public.current_cashier_active()
    or p_login_method<>'PASSWORD'
    or not exists(select 1 from public.profiles where id=auth.uid() and role='STAFF')
  then raise exception 'Staff access required'; end if;
  select * into result from public.attendance_sessions where staff_id=auth.uid() and clocked_out_at is null;
  if not found then
    insert into public.attendance_sessions(staff_id,login_method) values(auth.uid(),'PASSWORD') returning * into result;
  end if;
  return result;
end$$;

revoke all on function public.start_attendance(text) from public;
grant execute on function public.start_attendance(text) to authenticated;
drop table if exists public.face_credentials;

commit;
