// Yeni premium talebi (premium_requests INSERT) -> Telegram bildirimi.
// Kurulum: README-ops.md. Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, WEBHOOK_SECRET
// İsteğe bağlı: TELEGRAM_APPROVE=1 -> mesajda "Onayla / Reddet" butonları (telegram-approve fonksiyonu + setWebhook gerekir).
Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const r = body?.record;
  if (body?.type !== "INSERT" || !r) return new Response("ignored");
  const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  const buttons = Deno.env.get("TELEGRAM_APPROVE") === "1";
  let text = `💳 <b>Yeni Premium talebi</b>\nKullanıcı: <code>${esc(r.user_id)}</code>\nReferans: <b>${esc(String(r.reference).slice(0, 200))}</b>\nTalep #${esc(r.id)}`;
  const payload: Record<string, unknown> = { chat_id: Deno.env.get("TELEGRAM_CHAT_ID"), parse_mode: "HTML" };
  if (buttons) {
    payload.reply_markup = {
      inline_keyboard: [[
        { text: "✅ 1 yıl onayla", callback_data: `a:${Number(r.id)}:365` },
        { text: "❌ Reddet", callback_data: `r:${Number(r.id)}` },
      ]],
    };
  } else {
    text += `\n\nOnay için SQL:\n<code>select approve_premium('${esc(r.user_id)}', 365);</code>`;
  }
  payload.text = text;
  const res = await fetch(`https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return new Response(res.ok ? "ok" : "telegram error", { status: res.ok ? 200 : 502 });
});
