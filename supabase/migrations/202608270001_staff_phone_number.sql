begin;

drop index if exists public.profiles_contact_email_unique;
alter table public.profiles drop constraint if exists profiles_contact_email_format;
alter table public.profiles drop column if exists contact_email;

alter table public.profiles add column if not exists phone_number text;
alter table public.profiles drop constraint if exists profiles_phone_number_format;
alter table public.profiles add constraint profiles_phone_number_format
  check(phone_number is null or phone_number ~ '^[0-9]{1,11}$');
create unique index if not exists profiles_phone_number_unique
  on public.profiles(phone_number) where phone_number is not null;

commit;
