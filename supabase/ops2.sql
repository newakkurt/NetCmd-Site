-- NetCmd ops2: Telegram tek tuş onay + arama kaydı. community.sql'den SONRA çalıştır (idempotent).

-- ===== Telegram tek tuş onay =====
grant execute on function public.approve_premium(uuid, int) to service_role;

create or replace function public.approve_premium_request(p_id bigint, p_days int default 365) returns text
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.premium_requests where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pending' then return r.status; end if;
  insert into public.profiles (id) values (r.user_id) on conflict (id) do nothing;
  update public.profiles
     set is_premium = true,
         premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days)
   where id = r.user_id;
  update public.premium_requests set status = 'approved' where id = p_id;
  return 'approved';
end $$;

create or replace function public.reject_premium_request(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.premium_requests where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pending' then return r.status; end if;
  update public.premium_requests set status = 'rejected' where id = p_id;
  return 'rejected';
end $$;

revoke all on function public.approve_premium_request(bigint, int) from public, anon, authenticated;
revoke all on function public.reject_premium_request(bigint) from public, anon, authenticated;
grant execute on function public.approve_premium_request(bigint, int) to service_role;
grant execute on function public.reject_premium_request(bigint) to service_role;

-- ===== Çerezsiz arama kaydı (kimlik/IP yok; sadece sorgu, dil, sonuç sayısı) =====
create table if not exists public.search_log (
  id bigint generated always as identity primary key,
  q text not null check (char_length(q) between 2 and 80),
  lang text not null check (lang in ('tr','en','ar')),
  hits int not null default 0 check (hits >= 0),
  created_at timestamptz not null default now()
);
create index if not exists search_log_created_idx on public.search_log (created_at);
alter table public.search_log enable row level security;
revoke all on public.search_log from anon, authenticated;
grant insert (q, lang, hits) on public.search_log to anon, authenticated;
drop policy if exists sl_insert on public.search_log;
create policy sl_insert on public.search_log for insert to anon, authenticated with check (true);

-- Taşma koruması: dakikada 300'den fazla kayıt gelirse reddet
create or replace function public.search_log_guard() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.search_log where created_at > now() - interval '1 minute') >= 300 then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists search_log_g on public.search_log;
create trigger search_log_g before insert on public.search_log for each row execute function public.search_log_guard();

-- Rapor görünümleri (yalnızca SQL Editor / service role görür)
create or replace view public.search_misses with (security_invoker = true) as
  select lower(q) as q, lang, count(*) as n, max(created_at) as last_seen
  from public.search_log where hits = 0 group by 1, 2 order by n desc;
create or replace view public.search_top with (security_invoker = true) as
  select lower(q) as q, lang, count(*) as n, round(avg(hits)) as avg_hits
  from public.search_log group by 1, 2 order by n desc;
