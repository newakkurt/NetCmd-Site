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
  const secret = Deno.env.get("BMC_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const expectedLevelId = Number(Deno.env.get("BMC_PRO_MEMBERSHIP_LEVEL_ID") ?? "");
  if (!secret || !supabaseUrl || !serviceKey || !Number.isSafeInteger(expectedLevelId) || expectedLevelId <= 0) {
    return new Response("webhook_not_configured", { status: 503 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-signature-sha256") ?? "";
  if (!await verify(raw, secret, signature)) return new Response("invalid_signature", { status: 401 });

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad_json", { status: 400 }); }
  if (event?.live_mode === false) return new Response("test_event_ignored", { status: 200 });

  const type = String(event?.type ?? "");
  const supported = new Set(["membership.started", "membership.updated", "membership.cancelled", "membership.paused"]);
  if (!supported.has(type)) return new Response("ignored", { status: 200 });

  const d = event?.data ?? {};
  const required = [event?.event_id, event?.created, d?.id, d?.membership_level_id, d?.supporter_email];
  if (required.some((v) => v === undefined || v === null || v === "")) {
    return new Response("invalid_membership_event", { status: 400 });
  }

  const currentPeriodEnd = Number(d?.current_period_end ?? 0) || null;
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_bmc_membership_event`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_event_id: String(event.event_id),
      p_event_type: type,
      p_event_created: Number(event.created),
      p_membership_id: Number(d.id),
      p_supporter_id: Number(d.supporter_id ?? 0) || null,
      p_supporter_email: String(d.supporter_email).trim().toLowerCase(),
      p_membership_level_id: Number(d.membership_level_id),
      p_membership_level_name: String(d.membership_level_name ?? ""),
      p_status: String(d.status ?? (type === "membership.cancelled" ? "canceled" : type === "membership.paused" ? "paused" : "active")),
      p_current_period_end: currentPeriodEnd,
      p_cancel_at_period_end: String(d.cancel_at_period_end ?? "false") === "true",
      p_paused: String(d.paused ?? "false") === "true" || type === "membership.paused",
      p_expected_level_id: expectedLevelId,
    }),
  });
  if (!rpc.ok) {
    console.error("BMC membership event processing failed", rpc.status, await rpc.text());
    return new Response("processing_failed", { status: 500 });
  }
  const result = await rpc.text();
  if (result.includes("netcmd_account_email_not_found")) {
    console.warn("BMC supporter email does not match a NetCmd account");
  }
  return new Response("ok", { status: 200 });
});
