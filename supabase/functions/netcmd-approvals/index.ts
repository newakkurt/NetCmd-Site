// Admin-only Premium request review API.
// Configure NETCMD_ADMIN_EMAILS as a comma-separated secret in Supabase Edge Function secrets.
const allowedOrigins = new Set(["https://netcmd-site.onrender.com"]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://netcmd-site.onrender.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (origin && !allowedOrigins.has(origin)) return json({ error: "origin_not_allowed" }, 403, headers);
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const admins = (Deno.env.get("NETCMD_ADMIN_EMAILS") ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!url || !service || !publicKey || admins.length === 0) return json({ error: "function_not_configured" }, 503, headers);

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "missing_bearer_token" }, 401, headers);
  const userResponse = await fetch(url + "/auth/v1/user", { headers: { apikey: publicKey, Authorization: auth } });
  if (!userResponse.ok) return json({ error: "invalid_access_token" }, 401, headers);
  const user = await userResponse.json();
  const email = String(user?.email ?? "").toLowerCase();
  if (!user?.id || !admins.includes(email)) return json({ error: "not_authorized" }, 403, headers);

  const adminHeaders = { apikey: service, Authorization: "Bearer " + service, "Content-Type": "application/json" };
  if (req.method === "GET") {
    const q = new URLSearchParams({ select: "id,user_id,reference,status,created_at", status: "eq.pending", order: "created_at.asc", limit: "100" });
    const response = await fetch(url + "/rest/v1/premium_requests?" + q, { headers: adminHeaders });
    if (!response.ok) return json({ error: "database_operation_failed" }, 502, headers);
    return json({ requests: await response.json() }, 200, headers);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, headers); }
  const action = body?.action;
  const id = Number(body?.request_id);
  const days = Number(body?.days ?? 30);
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;
  if (!Number.isSafeInteger(id) || id < 1 || !["approve", "reject"].includes(action)) return json({ error: "invalid_request" }, 400, headers);
  if (action === "approve" && (!Number.isInteger(days) || days < 1 || days > 1095)) return json({ error: "invalid_duration" }, 400, headers);

  const fn = action === "approve" ? "approve_premium_request" : "reject_premium_request";
  const args = action === "approve"
    ? { p_id: id, p_days: days, p_actor: user.id, p_note: note }
    : { p_id: id, p_actor: user.id, p_note: note };
  const result = await fetch(url + "/rest/v1/rpc/" + fn, { method: "POST", headers: adminHeaders, body: JSON.stringify(args) });
  if (!result.ok) return json({ error: "decision_failed" }, 502, headers);
  const status = await result.json();
  if (status === "not_found") return json({ error: "request_not_found" }, 404, headers);
  if (status !== (action === "approve" ? "approved" : "rejected")) return json({ error: "request_already_reviewed", status }, 409, headers);
  return json({ success: true, status }, 200, headers);
});