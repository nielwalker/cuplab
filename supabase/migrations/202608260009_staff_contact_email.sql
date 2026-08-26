begin;

alter table public.profiles add column if not exists contact_email text;

alter table public.profiles drop constraint if exists profiles_contact_email_format;
alter table public.profiles add constraint profiles_contact_email_format
  check(contact_email is null or contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

create unique index if not exists profiles_contact_email_unique
  on public.profiles(lower(contact_email)) where contact_email is not null;

commit;
