import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://netcmd-site.onrender.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paddleKey = Deno.env.get("PADDLE_API_KEY") ?? "";
  const env = Deno.env.get("PADDLE_ENV") ?? "sandbox";
  if (!auth.startsWith("Bearer ") || !url || !publicKey || !serviceKey) return json({ error: "unauthorized" }, 401);
  if (!paddleKey) return json({ error: "billing_not_configured" }, 503);

  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: auth } });
  if (!userRes.ok) return json({ error: "unauthorized" }, 401);
  const user = await userRes.json();

  const subRes = await fetch(
    `${url}/rest/v1/paddle_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=paddle_subscription_id,paddle_customer_id&order=updated_at.desc&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!subRes.ok) return json({ error: "subscription_lookup_failed" }, 500);
  const rows = await subRes.json();
  const sub = Array.isArray(rows) ? rows[0] : null;
  if (!sub?.paddle_customer_id || !sub?.paddle_subscription_id) return json({ error: "subscription_not_found" }, 404);

  const apiBase = env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const portalRes = await fetch(`${apiBase}/customers/${encodeURIComponent(sub.paddle_customer_id)}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${paddleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subscription_ids: [sub.paddle_subscription_id] }),
  });
  const data = await portalRes.json().catch(() => ({}));
  if (!portalRes.ok) {
    console.error("Paddle portal session failed", portalRes.status, data?.error?.code);
    return json({ error: "portal_creation_failed" }, 502);
  }
  const link = data?.data?.urls?.subscriptions?.[0]?.view_subscription ?? data?.data?.urls?.general?.overview;
  if (!link || !/^https:\/\//.test(link)) return json({ error: "portal_url_missing" }, 502);
  return json({ url: link });
});
