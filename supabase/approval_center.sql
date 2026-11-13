-- NetCmd Approval Center audit trail and atomic review RPCs.
alter table public.premium_requests
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text;

create table if not exists public.premium_request_audit (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.premium_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved','rejected')),
  premium_days integer,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists premium_request_audit_request_idx
  on public.premium_request_audit(request_id, created_at desc);
alter table public.premium_request_audit enable row level security;
revoke all on public.premium_request_audit from anon, authenticated;
grant all on public.premium_request_audit to service_role;

create or replace function public.approve_premium_request_admin(
  p_id bigint, p_days int, p_actor uuid, p_note text returns text language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_days < 1 or p_days > 1095 then raise exception 'invalid premium duration'; end if;
  select * into r from public.premium_requests where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pending' then return r.status; end if;
  insert into public.profiles (id) values (r.user_id) on conflict (id) do nothing;
  update public.profiles
     set is_premium = true,
         premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days)
   where id = r.user_id;
  update public.premium_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = p_actor, review_note = left(p_note, 500)
   where id = p_id;
  insert into public.premium_request_audit(request_id, actor_id, decision, premium_days, note)
    values (p_id, p_actor, 'approved', p_days, left(p_note, 500));
  return 'approved';
end $$;

create or replace function public.reject_premium_request_admin(
  p_id bigint, p_actor uuid, p_note text returns text language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.premium_requests where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.status <> 'pending' then return r.status; end if;
  update public.premium_requests
     set status = 'rejected', reviewed_at = now(), reviewed_by = p_actor, review_note = left(p_note, 500)
   where id = p_id;
  insert into public.premium_request_audit(request_id, actor_id, decision, premium_days, note)
    values (p_id, p_actor, 'rejected', null, left(p_note, 500));
  return 'rejected';
end $$;

revoke all on function public.approve_premium_request_admin(bigint, int, uuid, text) from public, anon, authenticated;
revoke all on function public.reject_premium_request_admin(bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_premium_request(bigint, int, uuid, text) to service_role;
grant execute on function public.reject_premium_request(bigint, uuid, text) to service_role;
