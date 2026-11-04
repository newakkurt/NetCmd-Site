#!/usr/bin/env python3
"""private/*.js premium modüllerini Supabase'e yüklemek için SQL üretir (private/premium_bundle.sql).
Varlıklar: plib-premium (ana), plib-premium-intel (Network Intelligence Reports). Mevcut olanlar yüklenir.
Çıktı Premium kodunu içerir: GitHub'a push ETMEYİN (private/ .gitignore'dadır).
Her kod değişikliğinden sonra yeniden üretip Supabase SQL Editor'de çalıştırın."""
import hashlib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
ASSETS = ["plib-premium", "plib-premium-intel"]
head = """-- NetCmd Premium modülleri (yalnızca Premium üyelere okunabilir). Supabase SQL Editor'de çalıştırın.
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
"""
body = ""
for name in ASSETS:
    f = root / "private" / (name + ".js")
    if not f.exists():
        print("atlandı (yok):", f.name)
        continue
    code = f.read_text(encoding="utf-8")
    tag = "$netcmd" + hashlib.sha1(code.encode()).hexdigest()[:8] + "$"
    assert tag not in code
    body += f"insert into public.premium_assets (name, code) values ('{name}', {tag}{code}{tag})\non conflict (name) do update set code = excluded.code, updated_at = now();\n"
sql = head + body + "select name, length(code) as bytes, md5(code) as md5, updated_at from public.premium_assets;\n"
out = root / "private" / "premium_bundle.sql"
out.write_text(sql, encoding="utf-8")
print("yazıldı:", out, len(sql), "bayt")
