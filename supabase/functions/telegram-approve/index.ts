// Telegram inline buton (Onayla / Reddet) -> premium talebini onaylar.
// Kurulum: README-ops.md. Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
// (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik verilir.)
const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT = String(Deno.env.get("TELEGRAM_CHAT_ID") ?? "");
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";

async function tg(method: string, payload: Record<string, unknown>) {
  return fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req) => {
  // Telegram setWebhook secret_token başlığı; tanımsız/yanlışsa reddet
  if (!SECRET || !TOKEN || !CHAT || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const cq = update?.callback_query;
  if (!cq) return new Response("ignored");

  // Yalnızca yönetici sohbetinden gelen tıklamalar
  if (String(cq.from?.id) !== CHAT || String(cq.message?.chat?.id) !== CHAT) {
    await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Yetkisiz", show_alert: true });
    return new Response("unauthorized");
  }

  const m = /^(a|r):(\d{1,12})(?::(\d{1,4}))?$/.exec(String(cq.data ?? ""));
  if (!m) {
    await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Geçersiz işlem" });
    return new Response("bad data");
  }
  const [, action, idStr, daysStr] = m;
  const id = Number(idStr);
  const days = Math.min(Math.max(Number(daysStr ?? 365), 1), 1095);

  // PostgREST RPC (service role); dış bağımlılık yok
  const fn = action === "a" ? "approve_premium_request" : "reject_premium_request";
  const args = action === "a" ? { p_id: id, p_days: days } : { p_id: id };
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const rpc = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = rpc.ok ? await rpc.json() : null;
  const error = rpc.ok ? null : { message: `${rpc.status} ${await rpc.text()}` };

  if (error) {
    console.error("rpc error", error.message);
    await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Hata: işlem yapılamadı", show_alert: true });
    return new Response("rpc error", { status: 500 });
  }

  const label: Record<string, string> = {
    approved: `✅ Onaylandı (${days} gün)`,
    rejected: "❌ Reddedildi",
    not_found: "⚠️ Talep bulunamadı",
  };
  // Zaten işlenmişse mevcut durumu göster (çift tıklama güvenli)
  const status = label[String(data)] ?? `ℹ️ Talep zaten: ${data}`;
  await tg("answerCallbackQuery", { callback_query_id: cq.id, text: status });
  await tg("editMessageText", {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    text: `${cq.message.text ?? ""}\n\n${status}`,
    reply_markup: { inline_keyboard: [] },
  });
  return new Response("ok");
});
