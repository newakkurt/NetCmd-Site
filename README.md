# NetCmd – Cisco / Huawei / Aruba komut karşılıkları

Bağımlılıksız Python static site generator. Diller: TR / EN / AR (RTL).
Render static site: build `python3 build.py`, publish `dist`, env `BASE_URL`.

## Düzenlenecek dosyalar (data/)
- `commands.json`  komutlar (TR ana metin)
- `i18n.json`      arayüz + EN/AR çevirileri (yeni komut eklerken `items` altına en/ar ekle, yoksa build hata verir)
- `site.json`      public site config, BMC link, display pricing, Supabase URL + publishable key; never store payment secrets or bank details here
- `projects.json`  Projeler sayfası (status: live | soon)

## Üyelik
Supabase Auth (e-posta + şifre). Supabase → Authentication → URL Configuration:
Site URL = `https://netcmd-site.onrender.com`, Redirect URLs'e `https://netcmd-site.onrender.com/**` ekle.

## Yerel test
```bash
BASE_URL=http://localhost:8000 python3 build.py && cd dist && python3 -m http.server 8000
```

## Premium ve destek
- `data/site.json`: `bmc_url` (optional support link) and display-only `premium_price`. Payment provider secrets and private billing data must stay in Supabase Edge Function secrets/database.
- Premium araçlar: `assets/plib.js` (saf mantık, Node'da test edilir) + `assets/premium.js` (arayüz). Üyelik `profiles.is_premium` alanından okunur; kapı istemci tarafındadır.
- Premium üyelik BMC'nin imzalı webhook bildirimiyle otomatik yönetilir; manuel yetki verme yalnızca yönetici kurtarma işlemi olarak kullanılmalıdır.

### Premium modülü (sunucu tarafı)
- Herkese açık: `assets/plib.js` (temel kurallar, sorun giderme). Premium kodu: `private/plib-premium.js` (**gitignore'da**, repoya girmez).
- Yayınlamak için: `python3 tools/make_bundle_sql.py` → `private/premium_bundle.sql` üretir; Supabase SQL Editor'de çalıştırın. Modül `premium_assets` tablosunda, RLS ile yalnızca Premium üyeye okunur.
- Premium varlıkları: `private/plib-premium.js` (ana, Storage `premium` bucket'ı + tablo yedeği) ve `private/plib-premium-intel.js` (Network Intelligence Reports; yalnızca `premium_assets` tablosu, `name='plib-premium-intel'`). Bundle ikisini de üretir.
- Premium kodunu değiştirirseniz SQL'i yeniden üretip çalıştırın.
- Not: repo herkese açık olduğu sürece geçmiş commit'lerdeki eski (tam) Premium kodu görülebilir; tam koruma için repoyu özel (private) yapın.


## Buy Me a Coffee PRO membership

NetCmd PRO membership is sold through the Buy Me a Coffee page configured as `bmc_url` in `data/site.json`. The configured launch price is USD $22/month. The supporter must use the same email address as their NetCmd account; the signed membership webhook matches that email to `auth.users`.

1. Create a monthly membership tier named **NetCmd PRO** for **$22/month** in Buy Me a Coffee.
2. Copy its numeric membership level ID from the creator dashboard.
3. Apply `supabase/bmc_membership.sql` to the Supabase project.
4. Deploy `supabase/functions/bmc-webhook` as an Edge Function with JWT verification disabled (BMC sends no Supabase JWT; the function verifies `x-signature-sha256` itself).
5. Add these Edge Function secrets: `BMC_WEBHOOK_SECRET`, `BMC_PRO_MEMBERSHIP_LEVEL_ID`. Supabase supplies its standard URL and service-role key.
6. In Buy Me a Coffee → Integrations → New webhook, use:
   `https://olbyrzqjdbxxsfaonsew.supabase.co/functions/v1/bmc-webhook`
   Subscribe to `membership.started`, `membership.updated`, `membership.cancelled`, and `membership.paused`.
7. Send a test event, then test a real Sandbox/test membership if available before promoting the tier.

Only the configured PRO membership level grants Premium. One-time coffee donations do not grant Premium. Refunds, cancellation, and pause behavior must be verified against real event deliveries before public launch.
