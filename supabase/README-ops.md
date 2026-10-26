# Operasyon kurulumu (Supabase) — sırayla

## 1) SQL (SQL Editor, `supabase/community.sql` dosyasını çalıştır)
Topluluk tablosu, günlük gönderim sınırı, tek bekleyen premium talebi, `approve_premium()` ve AI kota tablosu/fonksiyonu.

## 2) Telegram bildirimi (yeni Premium talebi)
1. Telegram'da @BotFather ile bot oluştur → token. Botla konuş, `https://api.telegram.org/bot<TOKEN>/getUpdates` ile chat_id'ni bul.
2. Dashboard → Edge Functions → `notify-premium` oluştur, `supabase/functions/notify-premium/index.ts` içeriğini yapıştır, **Verify JWT = kapalı**.
3. Edge Functions → Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WEBHOOK_SECRET` (rastgele uzun metin).
4. Database → Webhooks → yeni: tablo `premium_requests`, olay **Insert**, tür Supabase Edge Function → `notify-premium`, HTTP header `x-webhook-secret: <WEBHOOK_SECRET>`.
5. Bildirimdeki komutla onay: `select approve_premium('<user_id>', 365);`

## 3) AI asistanı
1. Groq'ta (console.groq.com) API anahtarı al.
2. Edge Functions → `ai-assistant` oluştur, `supabase/functions/ai-assistant/index.ts` içeriğini yapıştır, **Verify JWT = açık**.
3. Secrets: `GROQ_API_KEY`; isteğe bağlı `ALLOWED_ORIGIN` (site adresin), `AI_MODEL`, `FREE_LIMIT` (5), `PREMIUM_LIMIT` (100).
4. Site `Asistan` sayfasındaki "AI ile sor" düğmesi bu fonksiyonu çağırır; çalışmazsa yerel asistana düşer.
