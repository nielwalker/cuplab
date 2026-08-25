begin;

create type public.staff_role as enum ('OWNER','STAFF');
alter table public.profiles add column role public.staff_role not null default 'STAFF';

-- Accounts that existed before staff management are the shop owners.
update public.profiles set role='OWNER';

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name,role)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),
    case when new.raw_user_meta_data->>'role'='OWNER' then 'OWNER'::public.staff_role else 'STAFF'::public.staff_role end
  );
  return new;
end$$;

create or replace function public.current_user_is_owner() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and is_active and role='OWNER')
$$;
revoke all on function public.current_user_is_owner() from public;
grant execute on function public.current_user_is_owner() to authenticated;

create policy profiles_owner_read on public.profiles for select to authenticated
using(public.current_user_is_owner());

create table public.face_credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  embedding jsonb not null,
  model text not null default 'uniface-arcface',
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.face_credentials enable row level security;
-- Deliberately no client policies: only the trusted face service may read embeddings.

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete restrict,
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  login_method text not null default 'FACE' check(login_method in ('FACE','ADMIN_RECOVERY')),
  constraint attendance_time_order check(clocked_out_at is null or clocked_out_at>=clocked_in_at)
);
create unique index one_open_attendance_per_staff on public.attendance_sessions(staff_id) where clocked_out_at is null;
create index attendance_staff_clocked_in_idx on public.attendance_sessions(staff_id,clocked_in_at desc);
alter table public.attendance_sessions enable row level security;
create policy attendance_self_read on public.attendance_sessions for select to authenticated using(staff_id=auth.uid());
create policy attendance_owner_read on public.attendance_sessions for select to authenticated using(public.current_user_is_owner());

create or replace function public.start_attendance(p_login_method text default 'FACE') returns public.attendance_sessions
language plpgsql security definer set search_path='' as $$
declare result public.attendance_sessions%rowtype;
begin
  if not public.current_cashier_active() or p_login_method not in ('FACE','ADMIN_RECOVERY') then raise exception 'Not authorized'; end if;
  select * into result from public.attendance_sessions where staff_id=auth.uid() and clocked_out_at is null;
  if not found then
    insert into public.attendance_sessions(staff_id,login_method) values(auth.uid(),p_login_method) returning * into result;
  end if;
  return result;
end$$;

create or replace function public.end_attendance() returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.attendance_sessions set clocked_out_at=now() where staff_id=auth.uid() and clocked_out_at is null;
end$$;

revoke all on function public.start_attendance(text) from public;
revoke all on function public.end_attendance() from public;
grant execute on function public.start_attendance(text) to authenticated;
grant execute on function public.end_attendance() to authenticated;

commit;
