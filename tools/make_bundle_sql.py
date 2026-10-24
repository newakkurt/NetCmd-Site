#!/usr/bin/env python3
"""private/plib-premium.js dosyasını Supabase'e yüklemek için SQL üretir (private/premium_bundle.sql).
Çıktı Premium kodunu içerir: GitHub'a push ETMEYİN (private/ .gitignore'dadır).
Her kod değişikliğinden sonra yeniden üretip Supabase SQL Editor'de çalıştırın."""
import hashlib
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
code = (root / "private" / "plib-premium.js").read_text(encoding="utf-8")
tag = "$netcmd" + hashlib.sha1(code.encode()).hexdigest()[:8] + "$"
assert tag not in code
sql = f"""-- NetCmd Premium modülü (yalnızca Premium üyelere okunabilir). Supabase SQL Editor'de çalıştırın.
create table if not exists public.premium_assets (
  name text primary key,
  code text not null,
  updated_at timestamptz not null default now()
);
alter table public.premium_assets enable row level security;
revoke all on public.premium_assets from anon, authenticated;
grant select on public.premium_assets to authenticated;
drop policy if exists premium_assets_read on public.premium_assets;
create policy premium_assets_read on public.premium_assets for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_premium
          and (p.premium_until is null or p.premium_until > now()))
);
insert into public.premium_assets (name, code) values ('plib-premium', {tag}{code}{tag})
on conflict (name) do update set code = excluded.code, updated_at = now();
select name, length(code) as bytes, updated_at from public.premium_assets;
"""
out = root / "private" / "premium_bundle.sql"
out.write_text(sql, encoding="utf-8")
print("yazıldı:", out, len(sql), "bayt")
