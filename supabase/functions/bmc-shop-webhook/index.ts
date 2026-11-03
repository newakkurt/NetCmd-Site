import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = new Set([
  "config-auditor-pro",
  "topology-discovery-pro",
  "troubleshooting-pro",
  "bulk-automation-pro",
  "network-intelligence-reports-pro",
]);

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verify(raw: string, secret: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return safeEqual(hex(new Uint8Array(digest)), signature.trim().toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const secret = Deno.env.get("BMC_SHOP_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const rawMap = Deno.env.get("BMC_SHOP_PRODUCT_MAP") ?? "";
  if (!secret || !supabaseUrl || !serviceKey || !rawMap) {
    return new Response("shop_webhook_not_configured", { status: 503 });
  }

  let productMap: Record<string, string>;
  try { productMap = JSON.parse(rawMap); } catch { return new Response("invalid_product_map", { status: 503 }); }
  if (!productMap || typeof productMap !== "object" || Array.isArray(productMap)) {
    return new Response("invalid_product_map", { status: 503 });
  }

  const raw = await req.text();
  if (!await verify(raw, secret, req.headers.get("x-signature-sha256") ?? "")) {
    return new Response("invalid_signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad_json", { status: 400 }); }
  if (event?.live_mode === false) return new Response("test_event_ignored", { status: 200 });

  const type = String(event?.type ?? "");
  if (!["extra_purchase.created", "extra_purchase.updated", "extra_purchase.refunded"].includes(type)) {
    return new Response("ignored", { status: 200 });
  }

  const d = event?.data ?? {};
  const orderId = Number(d.id);
  const eventId = String(event?.event_id ?? "");
  const eventCreated = Number(event?.created);
  const email = String(d.supporter_email ?? "").trim().toLowerCase();
  if (!eventId || !Number.isSafeInteger(orderId) || orderId <= 0 ||
      !Number.isSafeInteger(eventCreated) || !email || !email.includes("@") ||
      !Array.isArray(d.extras) || d.extras.length === 0) {
    return new Response("invalid_shop_event", { status: 400 });
  }

  const active = type !== "extra_purchase.refunded" &&
    String(d.status ?? "").toLowerCase() === "succeeded" &&
    String(d.refunded ?? "false") !== "true";

  for (const item of d.extras) {
    const slug = productMap[String(item?.id ?? "")];
    if (!slug || !ALLOWED.has(slug)) continue;
    if (String(item?.currency ?? d.currency ?? "").toUpperCase() !== "USD" ||
        Number(item?.amount) !== 30) {
      console.warn("BMC Shop item did not match expected USD 30 price", item?.id);
      continue;
    }

    const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_bmc_shop_entitlement`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_event_id: eventId,
        p_event_created: eventCreated,
        p_order_id: orderId,
        p_product_slug: slug,
        p_supporter_email: email,
        p_active: active,
      }),
    });
    if (!rpc.ok) {
      console.error("BMC Shop entitlement processing failed", rpc.status, await rpc.text());
      return new Response("processing_failed", { status: 500 });
    }

    // PostgREST returns the scalar text result as JSON. HTTP 200 alone does
    // not mean an entitlement was granted: the RPC can report a missing account.
    let outcome: unknown;
    try {
      outcome = await rpc.json();
    } catch {
      console.error("BMC Shop entitlement RPC returned invalid JSON");
      return new Response("invalid_processing_response", { status: 502 });
    }
    if (outcome === "netcmd_account_email_not_found") {
      console.warn("BMC Shop buyer must register with the same email before access can be granted");
      return new Response("buyer_account_not_found", { status: 409 });
    }
    if (outcome !== "processed" && outcome !== "duplicate") {
      console.error("BMC Shop entitlement RPC returned unexpected result", outcome);
      return new Response("entitlement_not_applied", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
});
