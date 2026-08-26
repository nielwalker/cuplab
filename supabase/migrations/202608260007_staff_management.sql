begin;

alter table public.profiles add column if not exists username text;
update public.profiles p set username=split_part(u.email,'@',1) from auth.users u where u.id=p.id and p.username is null;
alter table public.profiles alter column username set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='profiles_username_format' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_format check(username ~ '^[a-z0-9._-]{3,32}$');
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_username_unique' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_unique unique(username);
  end if;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name,username,role)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),
    split_part(new.email,'@',1),
    case when new.raw_user_meta_data->>'role'='OWNER' then 'OWNER'::public.staff_role else 'STAFF'::public.staff_role end
  );
  return new;
end$$;

commit;
