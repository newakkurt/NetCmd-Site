-- 1) Premium alanları
alter table public.profiles add column if not exists is_premium boolean not null default false;
alter table public.profiles add column if not exists premium_until timestamptz;

-- 2) profiles yetkileri: kullanıcı kendi satırını okur, is_premium'u değiştiremez
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, lang) on public.profiles to authenticated;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 3) Premium talepleri
create table if not exists public.premium_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference text not null check (char_length(reference) between 3 and 200),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.premium_requests enable row level security;
revoke all on public.premium_requests from anon, authenticated;
grant select on public.premium_requests to authenticated;
grant insert (reference) on public.premium_requests to authenticated;
drop policy if exists pr_select_own on public.premium_requests;
create policy pr_select_own on public.premium_requests for select to authenticated using (auth.uid() = user_id);
drop policy if exists pr_insert_own on public.premium_requests;
create policy pr_insert_own on public.premium_requests for insert to authenticated with check (auth.uid() = user_id);

-- 4) Kendi hesabını Premium yap (profil satırı yoksa oluşturur)
insert into public.profiles (id)
select id from auth.users where email = 'newakkurt@gmail.com'
on conflict (id) do nothing;

update public.profiles
set is_premium = true
where id = (select id from auth.users where email = 'newakkurt@gmail.com');

-- 5) Kontrol: user_found = 1 ve premium = true olmalı
select
  (select count(*) from auth.users where email = 'newakkurt@gmail.com') as user_found,
  (select is_premium from public.profiles
    where id = (select id from auth.users where email = 'newakkurt@gmail.com')) as premium;
