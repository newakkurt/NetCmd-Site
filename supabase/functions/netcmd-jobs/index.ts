// NetCmd job ingress for the zero-extra-Render-cost architecture.
// Supabase Edge Function verifies the caller with Supabase Auth and writes jobs
// with a server-only service key. No service key is returned to the browser.

const allowedOrigins = new Set(["https://netcmd-site.onrender.com"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://netcmd-site.onrender.com",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});

const productForKind: Record<string, string> = {
  config_audit: "config-auditor-pro",
  topology_discovery: "topology-discovery-pro",
  troubleshooting: "troubleshooting-pro",
  bulk_automation: "bulk-automation-pro",
  network_report: "network-intelligence-reports-pro",
  snmp_poll: "network-intelligence-reports-pro",
};

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "origin_not_allowed" }, 403, cors);
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !publicKey) {
    return json({ error: "function_not_configured" }, 503, cors);
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "missing_bearer_token" }, 401, cors);
  }
  const accessToken = authorization.slice(7).trim();

  // Verify token with Auth rather than trusting decoded client-side claims.
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!authResponse.ok) return json({ error: "invalid_access_token" }, 401, cors);
  const authUser = await authResponse.json();
  const userId = authUser?.id;
  if (typeof userId !== "string") return json({ error: "invalid_access_token" }, 401, cors);

  const adminHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (req.method === "GET") {
    const jobId = new URL(req.url).searchParams.get("job_id") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      return json({ error: "invalid_job_id" }, 400, cors);
    }
    const url = new URL(`${supabaseUrl}/rest/v1/netcmd_automation_jobs`);
    url.search = new URLSearchParams({
      select: "id,job_kind,status,result,error,created_at,started_at,finished_at",
      id: `eq.${jobId}`,
      user_id: `eq.${userId}`,
      limit: "1",
    }).toString();
    const response = await fetch(url, { headers: adminHeaders });
    if (!response.ok) return json({ error: "database_operation_failed" }, 502, cors);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "job_not_found" }, 404, cors);
    return json(rows[0], 200, cors);
  }

  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 28_000) {
      return json({ error: "payload_too_large" }, 413, cors);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "request_body_must_be_object" }, 400, cors);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400, cors);
  }

  const kind = input.kind;
  const payload = input.payload;
  const requestId = input.request_id;
  if (typeof kind !== "string" || !productForKind[kind]) {
    return json({ error: "unsupported_job_kind" }, 400, cors);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ error: "payload_must_be_object" }, 400, cors);
  }
  if (requestId !== undefined && requestId !== null &&
      (typeof requestId !== "string" || requestId.length > 80)) {
    return json({ error: "invalid_request_id" }, 400, cors);
  }

  const productSlug = productForKind[kind];
  // Existing NetCmd PRO monthly membership grants the full PRO suite.
  // A separately purchased product entitlement also grants access.
  const profileUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
  profileUrl.search = new URLSearchParams({
    select: "is_premium,premium_until",
    id: `eq.${userId}`,
    limit: "1",
  }).toString();
  const profileResponse = await fetch(profileUrl, { headers: adminHeaders });
  if (!profileResponse.ok) return json({ error: "database_operation_failed" }, 502, cors);
  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const premiumExpiry = profile?.premium_until ? Date.parse(profile.premium_until) : null;
  const membershipActive = profile?.is_premium === true &&
    (premiumExpiry === null || (Number.isFinite(premiumExpiry) && premiumExpiry > Date.now()));

  if (!membershipActive) {
    const entitlementUrl = new URL(`${supabaseUrl}/rest/v1/netcmd_product_entitlements`);
    entitlementUrl.search = new URLSearchParams({
      select: "id",
      user_id: `eq.${userId}`,
      product_slug: `eq.${productSlug}`,
      active: "eq.true",
      limit: "1",
    }).toString();
    const entitlementResponse = await fetch(entitlementUrl, { headers: adminHeaders });
    if (!entitlementResponse.ok) return json({ error: "database_operation_failed" }, 502, cors);
    const entitlements = await entitlementResponse.json();
    if (!Array.isArray(entitlements) || entitlements.length === 0) {
      return json({ error: "active_product_entitlement_required" }, 403, cors);
    }
  }

  // Simple per-user safety cap: at most five jobs in a rolling hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const quotaUrl = new URL(`${supabaseUrl}/rest/v1/netcmd_automation_jobs`);
  quotaUrl.search = new URLSearchParams({
    select: "id",
    user_id: `eq.${userId}`,
    created_at: `gte.${since}`,
    limit: "5",
  }).toString();
  const quotaResponse = await fetch(quotaUrl, { headers: adminHeaders });
  if (!quotaResponse.ok) return json({ error: "database_operation_failed" }, 502, cors);
  const recentJobs = await quotaResponse.json();
  if (Array.isArray(recentJobs) && recentJobs.length >= 5) {
    return json({ error: "hourly_job_limit_reached" }, 429, cors);
  }

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/netcmd_automation_jobs?select=id,status`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      job_kind: kind,
      product_slug: productSlug,
      payload,
      request_id: requestId ?? null,
      status: "queued",
    }),
  });
  if (!insertResponse.ok) {
    // Do not disclose database details; a duplicate request_id is a conflict.
    return json({ error: insertResponse.status === 409 ? "duplicate_request_id" : "job_submission_failed" },
      insertResponse.status === 409 ? 409 : 502, cors);
  }
  const inserted = await insertResponse.json();
  if (!Array.isArray(inserted) || inserted.length === 0) {
    return json({ error: "job_submission_failed" }, 502, cors);
  }
  return json({ job_id: inserted[0].id, status: inserted[0].status }, 202, cors);
});
