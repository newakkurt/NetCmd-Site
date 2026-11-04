-- NetCmd: bekleme listesi / yeni ürün duyuruları. Idempotent.
-- Yalnızca e-posta + ilgilenilen ürün + dil saklanır. Okuma yalnızca service role / SQL Editor.

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) between 5 and 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  product text not null default 'all' check (product ~ '^[a-z0-9-]{1,60}$'),
  lang text not null default 'tr' check (lang in ('tr','en','ar')),
  created_at timestamptz not null default now(),
  unique (email, product)
);
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant insert (email, product, lang) on public.waitlist to anon, authenticated;
drop policy if exists wl_insert on public.waitlist;
create policy wl_insert on public.waitlist for insert to anon, authenticated with check (true);

-- Taşma koruması: dakikada 60'tan fazla kayıt gelirse reddet
create or replace function public.waitlist_guard() returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  if (select count(*) from public.waitlist where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists waitlist_g on public.waitlist;
create trigger waitlist_g before insert on public.waitlist for each row execute function public.waitlist_guard();
