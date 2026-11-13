# Operasyon kurulumu (Supabase) — sırayla

## 1) SQL (SQL Editor, `supabase/community.sql` dosyasını çalıştır)
Topluluk tablosu, günlük gönderim sınırı, tek bekleyen premium talebi, `approve_premium()` ve AI kota tablosu/fonksiyonu.

## 2) Telegram bildirimi (yeni Premium talebi)
1. Telegram'da @BotFather ile bot oluştur → token. Botla konuş, `https://api.telegram.org/bot<TOKEN>/getUpdates` ile chat_id'ni bul.
2. Dashboard → Edge Functions → `notify-premium` oluştur, `supabase/functions/notify-premium/index.ts` içeriğini yapıştır, **Verify JWT = kapalı**.
3. Edge Functions → Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WEBHOOK_SECRET` (rastgele uzun metin).
4. Database → Webhooks → yeni: tablo `premium_requests`, olay **Insert**, tür Supabase Edge Function → `notify-premium`, HTTP header `x-webhook-secret: <WEBHOOK_SECRET>`.
5. Bildirimdeki komutla onay: `select approve_premium('<user_id>', 365);`

### 2b) Telegram'da tek tuşla onay (Onayla / Reddet butonları)
1. SQL Editor'de `supabase/ops2.sql` dosyasını çalıştır (`community.sql`'den sonra).
2. Edge Functions → `telegram-approve` oluştur (`supabase/functions/telegram-approve/index.ts`), **Verify JWT = kapalı**.
3. Secrets: `TELEGRAM_WEBHOOK_SECRET` (rastgele uzun metin; yalnızca A-Z a-z 0-9 _ -), `TELEGRAM_APPROVE=1`. (`TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` 2. adımdaki gibi.)
4. Botun webhook'unu bir kez bağla (tarayıcı/curl):
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://<PROJE_REF>.supabase.co/functions/v1/telegram-approve" -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" -d 'allowed_updates=["callback_query"]'`
5. `notify-premium` fonksiyonunu güncel kodla yeniden yayınla. `TELEGRAM_APPROVE=1` iken mesajda ✅ 1 yıl onayla / ❌ Reddet butonları çıkar; yalnızca `TELEGRAM_CHAT_ID` sohbetinden gelen tıklamalar işlenir.

## 3) AI asistanı
1. Groq'ta (console.groq.com) API anahtarı al.
2. Edge Functions → `ai-assistant` oluştur, `supabase/functions/ai-assistant/index.ts` içeriğini yapıştır, **Verify JWT = açık**.
3. Secrets: `GROQ_API_KEY`; isteğe bağlı `ALLOWED_ORIGIN` (site adresin), `AI_MODEL`, `FREE_LIMIT` (5), `PREMIUM_LIMIT` (100).
4. Site `Asistan` sayfasındaki "AI ile sor" düğmesi bu fonksiyonu çağırır; çalışmazsa yerel asistana düşer.

## 4) Arama kaydı ve analitik
- `ops2.sql` → `search_log` tablosu (kimlik/IP yok; yalnızca sorgu, dil, sonuç sayısı; DNT/GPC'ye saygılı). Raporlar (SQL Editor):
  `select * from search_misses limit 50;` (bulunamayan aramalar) · `select * from search_top limit 50;` (en çok aranan).
- Çerezsiz sayfa analitiği (isteğe bağlı): `data/site.json` içine
  `"analytics": {"provider": "plausible", "domain": "netcmd-site.onrender.com"}` veya
  `"analytics": {"provider": "umami", "website_id": "<ID>"}` ekle (self-host için `"src": "https://.../script.js"`). Boşsa hiçbir betik yüklenmez; CSP otomatik güncellenir.
- Gizlilik sayfasındaki "Arama istatistikleri ve analitik" bölümü bunu zaten kapsar.

## 5) SEO
- `data/seo.json`: `pair_policy` = `index` (hepsi indekslenir) | `auto` (varsayılan: komutları aynı olan veya `pair_min_score`'un altındaki çeviri sayfaları `noindex,follow` + sitemap dışı) | `noindex` (tüm çeviri sayfaları). İstisnalar: `force_index` / `force_noindex` (`"huawei-cisco/vlan-listeleme"`), `noindex_slugs`.
- Karar için Search Console → Sayfalar raporunda "Taranmış - dizine eklenmemiş" sayısını izle; çok yüksekse `pair_min_score`'u artır veya `noindex` yap.
- OG görseli: `python3 tools/make_og.py` → `assets/og.png`.


## 2c) Web Onay Merkezi (NetCmd Hesabım)
1. Supabase SQL Editor'de `supabase/approval_center.sql` dosyasını çalıştır. Bu migration, talep kararlarını ve yönetici denetim kaydını ekler.
2. Edge Functions → `netcmd-approvals` oluştur; `supabase/functions/netcmd-approvals/index.ts` içeriğini yayınla. **Verify JWT = kapalı** bırak (fonksiyon Supabase Auth token'ını kendi doğrular).
3. Edge Functions → Secrets bölümüne `NETCMD_ADMIN_EMAILS` ekle. Değer, Onay Merkezi'ne erişecek yönetici NetCmd hesabının e-posta adresi olmalı. Birden fazla yönetici için virgülle ayır. Bu değer tarayıcıya gönderilmez.
4. Fonksiyonun standart `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` secret'larına erişebildiğini doğrula; `SUPABASE_PUBLISHABLE_KEY` veya `SUPABASE_ANON_KEY` de Auth doğrulaması için kullanılabilir.
5. Render deploy tamamlandıktan sonra NetCmd'de aynı yönetici hesabıyla giriş yapıp **Hesabım** sayfasını aç. Yetkili hesapta Onay Merkezi görünür; diğer kullanıcılarda bölüm gizli kalır ve API 403 döndürür.
6. SQL migration ve Edge Function deploy edilmeden önce onay arayüzü karar işlemi yapamaz. Her karar `premium_requests.reviewed_by/reviewed_at/review_note` alanlarına ve `premium_request_audit` tablosuna kaydedilir.

Not: Bu panel mevcut `premium_requests` (IBAN/Premium talepleri) kayıtlarını yönetir. Otomasyon işlerini (network jobs) otomatik çalıştırmaz; sadece Premium üyelik taleplerini onaylar/reddeder.
