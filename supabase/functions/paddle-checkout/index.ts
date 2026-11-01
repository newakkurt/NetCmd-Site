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
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paddleKey = Deno.env.get("PADDLE_API_KEY") ?? "";
  const priceId = Deno.env.get("PADDLE_PRICE_ID") ?? "";
  const env = Deno.env.get("PADDLE_ENV") ?? "sandbox";
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://netcmd-site.onrender.com";

  if (!auth.startsWith("Bearer ") || !supabaseUrl || !publicKey || !serviceKey) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!paddleKey || !priceId) return json({ error: "billing_not_configured" }, 503);
  if (!/^pri_[a-z0-9]{26}$/i.test(priceId)) return json({ error: "invalid_price_configuration" }, 503);

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publicKey, Authorization: auth },
  });
  if (!userRes.ok) return json({ error: "unauthorized" }, 401);
  const user = await userRes.json();
  if (!user?.id || !user?.email) return json({ error: "verified_email_required" }, 403);

  const activeRes = await fetch(
    `${supabaseUrl}/rest/v1/paddle_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&status=in.(active,trialing)&select=paddle_subscription_id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!activeRes.ok) return json({ error: "subscription_lookup_failed" }, 500);
  const active = await activeRes.json();
  if (Array.isArray(active) && active.length) return json({ error: "subscription_already_active" }, 409);

  const apiBase = env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const checkoutUrl = `${siteUrl.replace(/\/$/, "")}/en/premium/`;
  const paddleRes = await fetch(`${apiBase}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paddleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: "automatic",
      custom_data: { netcmd_user_id: user.id, netcmd_plan: "pro_monthly" },
      checkout: { url: checkoutUrl },
    }),
  });

  const result = await paddleRes.json().catch(() => ({}));
  if (!paddleRes.ok) {
    console.error("Paddle transaction creation failed", paddleRes.status, result?.error?.code);
    return json({ error: "checkout_creation_failed" }, 502);
  }
  const url = result?.data?.checkout?.url;
  if (!url || !/^https:\/\//.test(url)) return json({ error: "checkout_url_missing" }, 502);
  return json({ url, transaction_id: result.data.id });
});
