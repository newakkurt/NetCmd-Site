import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(";").map((part) => {
    const [k, ...v] = part.trim().split("=");
    return [k, v.join("=")];
  }));
  const ts = parts.ts;
  const signatures = header.split(";").map((part) => part.trim()).filter((p) => p.startsWith("h1=")).map((p) => p.slice(3));
  if (!ts || !signatures.length || !/^\d+$/.test(ts)) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}:${raw}`));
  const expected = hex(new Uint8Array(digest));
  return signatures.some((signature) => safeEqual(signature, expected));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const secret = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret || !supabaseUrl || !serviceKey) return new Response("webhook_not_configured", { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get("Paddle-Signature") ?? "";
  if (!await verify(raw, signature, secret)) return new Response("invalid_signature", { status: 401 });

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad_json", { status: 400 }); }
  const eventType = String(event?.event_type ?? "");
  const data = event?.data ?? {};
  const relevant = new Set([
    "subscription.created", "subscription.updated", "subscription.canceled",
    "subscription.paused", "subscription.resumed", "subscription.trialing",
    "subscription.past_due",
  ]);
  if (!relevant.has(eventType)) return new Response("ignored", { status: 200 });

  const eventId = String(event?.event_id ?? "");
  const occurredAt = String(event?.occurred_at ?? "");
  const subscriptionId = String(data?.id ?? "");
  const customerId = String(data?.customer_id ?? "");
  const status = String(data?.status ?? "");
  if (!eventId || !occurredAt || !subscriptionId.startsWith("sub_") || !customerId.startsWith("ctm_") || !status) {
    return new Response("invalid_event", { status: 400 });
  }

  const userId = data?.custom_data?.netcmd_user_id ?? null;
  const periodEnd = data?.current_billing_period?.ends_at ?? null;
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_paddle_subscription_event`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_event_id: eventId,
      p_event_type: eventType,
      p_occurred_at: occurredAt,
      p_user_id: userId,
      p_subscription_id: subscriptionId,
      p_customer_id: customerId,
      p_status: status,
      p_period_ends_at: periodEnd,
      p_scheduled_change: data?.scheduled_change ?? null,
    }),
  });
  if (!rpcRes.ok) {
    console.error("Subscription webhook RPC failed", rpcRes.status, await rpcRes.text());
    return new Response("processing_failed", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
