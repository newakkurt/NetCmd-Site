-- NetCmd: topluluk komutları + premium talebi tekrarını engelleme. Supabase SQL Editor'de çalıştır.
create table if not exists public.community_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  vendor text not null check (vendor in ('cisco','huawei','aruba','juniper','mikrotik')),
  commands text not null check (char_length(commands) between 2 and 2000),
  description text not null default '' check (char_length(description) <= 600),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.community_commands enable row level security;

drop policy if exists cc_read_approved on public.community_commands;
create policy cc_read_approved on public.community_commands for select using (status = 'approved' or user_id = auth.uid());

drop policy if exists cc_insert_own on public.community_commands;
create policy cc_insert_own on public.community_commands for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Günlük gönderim sınırı (kötüye kullanım): kullanıcı başına 10/gün
create or replace function public.cc_rate_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.community_commands where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists cc_rate on public.community_commands;
create trigger cc_rate before insert on public.community_commands for each row execute function public.cc_rate_limit();

-- Aynı kullanıcı için tek bekleyen premium talebi (spam önleme)
create unique index if not exists premium_requests_one_pending on public.premium_requests(user_id) where status = 'pending';
