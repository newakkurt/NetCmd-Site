# NetCmd – Cisco / Huawei / Aruba komut karşılıkları

Bağımlılıksız Python static site generator. Diller: TR / EN / AR (RTL).
Render static site: build `python3 build.py`, publish `dist`, env `BASE_URL`.

## Düzenlenecek dosyalar (data/)
- `commands.json`  komutlar (TR ana metin)
- `i18n.json`      arayüz + EN/AR çevirileri (yeni komut eklerken `items` altına en/ar ekle, yoksa build hata verir)
- `site.json`      `iban`, `holder`, `bank` (Destek ol sayfası); Supabase url + publishable key
- `projects.json`  Projeler sayfası (status: live | soon)

## Üyelik
Supabase Auth (e-posta + şifre). Supabase → Authentication → URL Configuration:
Site URL = `https://netcmd-site.onrender.com`, Redirect URLs'e `https://netcmd-site.onrender.com/**` ekle.

## Yerel test
```bash
BASE_URL=http://localhost:8000 python3 build.py && cd dist && python3 -m http.server 8000
```

## Premium ve destek
- `data/site.json`: `iban` (mod-97 doğrulanır), `holder`, `bank`, `bmc_url` (Buy Me a Coffee, https://...), `premium_price`.
- Premium araçlar: `assets/plib.js` (saf mantık, Node'da test edilir) + `assets/premium.js` (arayüz). Üyelik `profiles.is_premium` alanından okunur; kapı istemci tarafındadır.
- Premium vermek için Supabase SQL: `update public.profiles set is_premium = true where id = '<user uuid>';` Talepler `premium_requests` tablosunda.

### Premium modülü (sunucu tarafı)
- Herkese açık: `assets/plib.js` (temel kurallar, sorun giderme). Premium kodu: `private/plib-premium.js` (**gitignore'da**, repoya girmez).
- Yayınlamak için: `python3 tools/make_bundle_sql.py` → `private/premium_bundle.sql` üretir; Supabase SQL Editor'de çalıştırın. Modül `premium_assets` tablosunda, RLS ile yalnızca Premium üyeye okunur.
- Premium kodunu değiştirirseniz SQL'i yeniden üretip çalıştırın.
- Not: repo herkese açık olduğu sürece geçmiş commit'lerdeki eski (tam) Premium kodu görülebilir; tam koruma için repoyu özel (private) yapın.
