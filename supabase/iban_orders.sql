-- NetCmd: IBAN/EFT siparişleri. community.sql ve ops2.sql'den SONRA çalıştır (idempotent).
-- Akış: kullanıcı sipariş kodu alır -> havale açıklamasına yazar -> "Ödedim" der (premium_requests satırı açılır,
-- Telegram bildirimi gider) -> yönetici Telegram'da Onayla'ya basar -> Premium açılır, sipariş 'paid' olur.

create table if not exists public.iban_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  days int not null default 30 check (days between 1 and 1095),
  status text not null default 'created' check (status in ('created','reported','paid','rejected','expired')),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  reported_at timestamptz,
  paid_at timestamptz
);
create index if not exists iban_orders_user_idx on public.iban_orders(user_id, created_at desc);

alter table public.iban_orders enable row level security;
revoke all on public.iban_orders from anon, authenticated;
grant select on public.iban_orders to authenticated;
drop policy if exists io_select_own on public.iban_orders;
create policy io_select_own on public.iban_orders for select to authenticated using (auth.uid() = user_id);

-- Sipariş kodu üret (açık siparişi varsa aynısını döndür). Kullanıcı başına günde en fazla 5 yeni sipariş.
create or replace function public.iban_order_create(p_days int default 30) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_days not in (30, 365) then raise exception 'invalid plan'; end if;

  update public.iban_orders set status = 'expired'
   where user_id = v_uid and status = 'created' and expires_at < now();

  select code into v_code from public.iban_orders
   where user_id = v_uid and status in ('created','reported') and expires_at > now() and days = p_days
   order by created_at desc limit 1;
  if v_code is not null then return v_code; end if;

  if (select count(*) from public.iban_orders where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate limit';
  end if;

  loop
    v_code := 'NC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.iban_orders(user_id, code, days) values (v_uid, v_code, p_days);
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.iban_order_create(int) from public, anon;
grant execute on function public.iban_order_create(int) to authenticated;

-- "Ödedim" bildirimi: premium_requests satırını açar (mevcut Telegram bildirimi tetiklenir).
create or replace function public.iban_order_report(p_code text, p_note text default '') returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  o record;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into o from public.iban_orders where code = p_code and user_id = v_uid for update;
  if not found then return 'not_found'; end if;
  if o.status = 'paid' then return 'paid'; end if;
  if o.status not in ('created','reported') or o.expires_at < now() then return 'expired'; end if;
  if exists (select 1 from public.premium_requests where user_id = v_uid and status = 'pending') then
    return 'already_pending';
  end if;
  insert into public.premium_requests(user_id, reference)
    values (v_uid, left(o.code || ' | ' || o.days || ' gün | ' || coalesce(trim(p_note), ''), 200));
  update public.iban_orders
     set status = 'reported', reported_at = now(), note = left(coalesce(trim(p_note), ''), 200)
   where id = o.id;
  return 'reported';
end $$;
revoke all on function public.iban_order_report(text, text) from public, anon;
grant execute on function public.iban_order_report(text, text) to authenticated;

-- Onay / red: siparişi de günceller (ops2.sql sürümünün yerine geçer).
create or replace function public.approve_premium_request(p_id bigint, p_days int default 365) returns text
language plpgsql security definer set search_path = public as $$
declare r record; v_code text;
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
  v_code := split_part(r.reference, ' | ', 1);
  update public.iban_orders set status = 'paid', paid_at = now()
   where user_id = r.user_id and code = v_code and status in ('created','reported');
  return 'approved';
end $$;

create or replace function public.reject_premium_request(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare r record; v_code text;
begin
  select * into r from public.premium_requests where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pending' then return r.status; end if;
  update public.premium_requests set status = 'rejected' where id = p_id;
  v_code := split_part(r.reference, ' | ', 1);
  update public.iban_orders set status = 'rejected'
   where user_id = r.user_id and code = v_code and status in ('created','reported');
  return 'rejected';
end $$;

revoke all on function public.approve_premium_request(bigint, int) from public, anon, authenticated;
revoke all on function public.reject_premium_request(bigint) from public, anon, authenticated;
grant execute on function public.approve_premium_request(bigint, int) to service_role;
grant execute on function public.reject_premium_request(bigint) to service_role;
