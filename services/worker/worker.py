"""NetCmd queue worker.

Runs as a short-lived GitHub Actions job or a long-running worker.
Only deterministic, local config text analysis is enabled in this release.
No shell commands, arbitrary Python, SSH, or device writes are executed.
"""
from __future__ import annotations

import asyncio
import os
import signal
from typing import Any

import httpx

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "5"))
RUN_ONCE = os.getenv("NETCMD_WORKER_ONCE", "0") == "1"
MAX_JOBS_PER_RUN = max(1, min(int(os.getenv("NETCMD_MAX_JOBS_PER_RUN", "20")), 100))
stopping = False

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def audit_config(payload: dict[str, Any]) -> dict[str, Any]:
    config = payload.get("config_text")
    if not isinstance(config, str) or not config.strip():
        raise ValueError("config_text_required")
    if len(config.encode("utf-8")) > 200_000:
        raise ValueError("config_text_too_large")

    lines = [line.strip() for line in config.splitlines() if line.strip()]
    lowered = "\n".join(lines).lower()
    checks = [
        (( "telnet",), "warning", "Telnet configuration found; prefer SSH."),
        (("snmp-server community", "snmp community"), "warning",
         "SNMP community string detected; review SNMPv3 migration."),
        (("no service password-encryption",), "critical",
         "Password encryption appears disabled."),
        (("spanning-tree portfast",), "info",
         "PortFast configuration found; verify access-port scope."),
        (("snmp-server host", "snmp-agent target-host"), "info",
         "SNMP trap destination configured; verify receiver and security settings."),
        (("undo telnet server enable", "no ip http server"), "info",
         "A legacy management service is explicitly disabled."),
    ]
    findings = []
    for needles, severity, message in checks:
        if any(needle in lowered for needle in needles):
            findings.append({
                "severity": severity,
                "rule": needles[0],
                "message": message,
            })
    return {
        "engine": "netcmd-config-audit-v1",
        "line_count": len(lines),
        "finding_count": len(findings),
        "findings": findings,
        "note": "Initial safe text-only checks; vendor-specific rule packs are being added.",
    }


async def rpc(client: httpx.AsyncClient, name: str, body: dict[str, Any] | None = None):
    response = await client.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        headers=HEADERS,
        json=body or {},
    )
    response.raise_for_status()
    return response.json()


async def run_job(client: httpx.AsyncClient, job: dict[str, Any]) -> None:
    job_id = job["id"]
    try:
        kind = job["job_kind"]
        payload = job.get("payload") or {}
        if kind != "config_audit":
            raise ValueError(f"handler_not_available_yet:{kind}")
        result = audit_config(payload)
        await rpc(client, "netcmd_finish_job", {
            "p_job_id": job_id,
            "p_status": "succeeded",
            "p_result": result,
            "p_error": None,
        })
    except Exception as exc:
        await rpc(client, "netcmd_finish_job", {
            "p_job_id": job_id,
            "p_status": "failed",
            "p_result": None,
            "p_error": str(exc)[:1000],
        })


async def main() -> None:
    global stopping
    processed = 0
    async with httpx.AsyncClient(timeout=20.0) as client:
        while not stopping:
            try:
                job = await rpc(client, "netcmd_claim_job")
                if isinstance(job, list) and job:
                    await run_job(client, job[0])
                    processed += 1
                    if RUN_ONCE and processed >= MAX_JOBS_PER_RUN:
                        return
                    continue
                if RUN_ONCE:
                    return
                await asyncio.sleep(POLL_SECONDS)
            except httpx.HTTPError:
                if RUN_ONCE:
                    raise
                await asyncio.sleep(max(POLL_SECONDS, 10))


def stop(*_: Any) -> None:
    global stopping
    stopping = True


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    asyncio.run(main())
