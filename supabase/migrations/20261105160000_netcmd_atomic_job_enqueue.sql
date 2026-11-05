create or replace function public.netcmd_enqueue_job(
  p_user_id uuid,
  p_job_kind text,
  p_product_slug text,
  p_payload jsonb,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expected_product text;
  v_recent_count integer;
  v_job public.netcmd_automation_jobs;
begin
  v_expected_product := case p_job_kind
    when 'config_audit' then 'config-auditor-pro'
    when 'topology_discovery' then 'topology-discovery-pro'
    when 'troubleshooting' then 'troubleshooting-pro'
    when 'bulk_automation' then 'bulk-automation-pro'
    when 'network_report' then 'network-intelligence-reports-pro'
    when 'snmp_poll' then 'network-intelligence-reports-pro'
    else null
  end;

  if v_expected_product is null or p_product_slug <> v_expected_product then
    return jsonb_build_object('error', 'unsupported_job_kind');
  end if;
  if p_user_id is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 28000
     or (p_request_id is not null and char_length(p_request_id) > 80) then
    return jsonb_build_object('error', 'invalid_job_payload');
  end if;

  -- Serialize enqueue attempts for this user to prevent quota race conditions.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*)::integer into v_recent_count
    from public.netcmd_automation_jobs
   where user_id = p_user_id
     and created_at >= now() - interval '1 hour';
  if v_recent_count >= 5 then
    return jsonb_build_object('error', 'hourly_job_limit_reached');
  end if;

  begin
    insert into public.netcmd_automation_jobs (
      user_id, job_kind, product_slug, payload, request_id, status
    ) values (
      p_user_id, p_job_kind, p_product_slug, p_payload, p_request_id, 'queued'
    )
    returning * into v_job;
  exception when unique_violation then
    return jsonb_build_object('error', 'duplicate_request_id');
  end;

  insert into public.netcmd_api_usage(user_id, route, status_code)
  values (p_user_id, '/jobs', 202);

  return jsonb_build_object('id', v_job.id, 'status', v_job.status);
end;
$$;

revoke all on function public.netcmd_enqueue_job(uuid,text,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.netcmd_enqueue_job(uuid,text,text,jsonb,text)
  to service_role;