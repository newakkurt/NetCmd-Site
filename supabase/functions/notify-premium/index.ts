// Yeni premium talebi (premium_requests INSERT) -> Telegram bildirimi.
// Kurulum: README-ops.md. Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, WEBHOOK_SECRET
Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const r = body?.record;
  if (body?.type !== "INSERT" || !r) return new Response("ignored");
  const esc = (s: string) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  const text = `💳 <b>Yeni Premium talebi</b>\nKullanıcı: <code>${esc(r.user_id)}</code>\nReferans: <b>${esc(String(r.reference).slice(0, 200))}</b>\nTalep #${esc(r.id)}\n\nOnay için SQL:\n<code>select approve_premium('${esc(r.user_id)}', 365);</code>`;
  const res = await fetch(`https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: Deno.env.get("TELEGRAM_CHAT_ID"), text, parse_mode: "HTML" }),
  });
  return new Response(res.ok ? "ok" : "telegram error", { status: res.ok ? 200 : 502 });
});
