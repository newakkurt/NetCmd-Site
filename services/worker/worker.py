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




def _bounded_list(value: Any, field: str, limit: int) -> list:
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError(f"{field}_must_be_list_max_{limit}")
    return value


def discover_topology(payload: dict[str, Any]) -> dict[str, Any]:
    """Analyze a supplied topology export; does not scan or discover live devices."""
    nodes = _bounded_list(payload.get("nodes"), "nodes", 500)
    links = _bounded_list(payload.get("links"), "links", 2000)
    node_ids = []
    for node in nodes:
        if not isinstance(node, dict) or not isinstance(node.get("id"), str) or not node["id"].strip():
            raise ValueError("each_node_requires_id")
        node_ids.append(node["id"])
    if len(set(node_ids)) != len(node_ids):
        raise ValueError("duplicate_node_id")
    known = set(node_ids)
    parent = {node_id: node_id for node_id in node_ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    normalized_links = []
    for link in links:
        if not isinstance(link, dict):
            raise ValueError("each_link_must_be_object")
        source, target = link.get("source"), link.get("target")
        if source not in known or target not in known or source == target:
            raise ValueError("link_endpoint_invalid")
        normalized_links.append({"source": source, "target": target, "label": str(link.get("label", ""))[:80]})
        a, b = find(source), find(target)
        if a != b:
            parent[a] = b
    degree = {node_id: 0 for node_id in node_ids}
    for link in normalized_links:
        degree[link["source"]] += 1
        degree[link["target"]] += 1
    components = len({find(node_id) for node_id in node_ids})
    return {
        "engine": "netcmd-topology-analysis-v1",
        "source": "user_supplied_topology",
        "node_count": len(nodes),
        "link_count": len(normalized_links),
        "connected_components": components,
        "isolated_nodes": [node_id for node_id, count in degree.items() if count == 0],
        "nodes": nodes,
        "links": normalized_links,
        "note": "This analyzes supplied topology data; it does not perform live network discovery.",
    }


def troubleshoot(payload: dict[str, Any]) -> dict[str, Any]:
    symptom = payload.get("symptom", "")
    evidence = _bounded_list(payload.get("evidence", []), "evidence", 30)
    if not isinstance(symptom, str) or not symptom.strip() or len(symptom) > 3000:
        raise ValueError("symptom_required_max_3000_chars")
    chunks = [symptom]
    for item in evidence:
        if not isinstance(item, dict) or not isinstance(item.get("output", ""), str):
            raise ValueError("evidence_items_require_text_output")
        if len(item.get("output", "")) > 10000:
            raise ValueError("evidence_output_too_large")
        chunks.append(item.get("output", ""))
    text_blob = "\n".join(chunks).lower()
    rules = [
        (("administratively down", "shutdown", "disabled port"), "interface administratively disabled", "Check whether the shutdown state is intentional and verify the interface configuration."),
        (("line protocol is down", "down/down", "link down"), "physical link or peer-side issue", "Check cable/fiber, transceiver, speed/duplex, peer port state and interface errors."),
        (("crc", "input error", "fcs error"), "physical-layer errors", "Inspect optics/cabling, connector cleanliness, signal levels and both ends of the link."),
        (("err-disabled", "errdisable"), "port placed in error-disabled state", "Identify the triggering protection event before restoring the port; do not blindly re-enable it."),
        (("dhcp timeout", "no dhcp offer", "dhcp discover"), "DHCP address assignment failure", "Verify VLAN, DHCP relay/helper, scope availability and reachability to the DHCP server."),
        (("name resolution", "dns timeout", "servfail"), "DNS resolution failure", "Verify client DNS settings, resolver reachability and the queried record."),
        (("bgp idle", "bgp active", "neighbor down"), "BGP neighbor not established", "Verify peer IP reachability, ASN, source interface, TCP/179 filtering and authentication."),
        (("ospf down", "neighbor down", "exstart"), "OSPF adjacency issue", "Compare area, timers, MTU, network type, authentication and interface subnet."),
        (("native vlan", "pvid", "vlan mismatch"), "possible VLAN mismatch", "Compare access/native VLAN and allowed VLAN lists at both link ends."),
    ]
    matches = []
    for needles, diagnosis, next_step in rules:
        if any(needle in text_blob for needle in needles):
            matches.append({"diagnosis": diagnosis, "evidence_terms": [n for n in needles if n in text_blob], "next_step": next_step})
    return {
        "engine": "netcmd-troubleshooting-v1",
        "matches": matches,
        "match_count": len(matches),
        "assessment": "evidence_based_candidates" if matches else "insufficient_matching_evidence",
        "note": "Suggestions are hypotheses for human verification; no commands were run and no device was changed.",
    }


def bulk_plan(payload: dict[str, Any]) -> dict[str, Any]:
    vendor = str(payload.get("vendor", "")).lower()
    operation = payload.get("operation")
    targets = _bounded_list(payload.get("targets"), "targets", 200)
    if vendor not in {"cisco", "huawei", "aruba"}:
        raise ValueError("vendor_must_be_cisco_huawei_or_aruba")
    if operation not in {"set_description", "shutdown_unused_ports"}:
        raise ValueError("operation_not_allowlisted")
    if payload.get("dry_run") is not True:
        raise ValueError("dry_run_must_be_true_no_device_changes_supported")
    if operation == "shutdown_unused_ports" and not str(payload.get("approval_reference", "")).strip():
        raise ValueError("approval_reference_required_for_shutdown_plan")
    commands = []
    for target in targets:
        if not isinstance(target, dict):
            raise ValueError("each_target_must_be_object")
        interface = target.get("interface")
        if not isinstance(interface, str) or not __import__("re").fullmatch(r"[A-Za-z0-9./:_-]{1,40}", interface):
            raise ValueError("invalid_interface_name")
        if vendor == "cisco":
            prefix, shutdown = f"interface {interface}", " shutdown"
            desc = f" description {str(target.get('description','')).replace(chr(10),' ')[:80]}"
        elif vendor == "huawei":
            prefix, shutdown = f"interface {interface}", " shutdown"
            desc = f" description {str(target.get('description','')).replace(chr(10),' ')[:80]}"
        else:
            prefix, shutdown = f"interface {interface}", " disable"
            desc = f" name {str(target.get('description','')).replace(chr(10),' ')[:80]}"
        if operation == "set_description":
            if not str(target.get("description", "")).strip():
                raise ValueError("description_required")
            commands.extend([prefix, desc.strip()])
        else:
            commands.extend([prefix, shutdown.strip()])
    return {
        "engine": "netcmd-bulk-plan-v1",
        "vendor": vendor,
        "operation": operation,
        "target_count": len(targets),
        "dry_run": True,
        "approval_required_before_execution": True,
        "commands": commands,
        "note": "Configuration plan only. This worker never connects to devices or executes commands.",
    }


def network_report(payload: dict[str, Any]) -> dict[str, Any]:
    devices = _bounded_list(payload.get("devices"), "devices", 1000)
    counts = {"up": 0, "down": 0, "unknown": 0}
    interface_totals = {"total": 0, "up": 0, "down": 0, "unknown": 0}
    alerts = []
    for device in devices:
        if not isinstance(device, dict):
            raise ValueError("each_device_must_be_object")
        name = str(device.get("name", "unnamed"))[:100]
        status = str(device.get("status", "unknown")).lower()
        if status not in counts:
            status = "unknown"
        counts[status] += 1
        ports = _bounded_list(device.get("interfaces", []), "interfaces", 5000)
        for port in ports:
            if not isinstance(port, dict):
                raise ValueError("interface_entries_must_be_objects")
            pstatus = str(port.get("status", "unknown")).lower()
            if pstatus not in interface_totals:
                pstatus = "unknown"
            interface_totals["total"] += 1
            interface_totals[pstatus] += 1
            if pstatus == "down" and port.get("expected_up") is True:
                alerts.append({"device": name, "interface": str(port.get("name", "unknown"))[:80], "severity": "warning", "message": "Expected-up interface is down"})
    return {
        "engine": "netcmd-network-report-v1",
        "device_count": len(devices),
        "devices": counts,
        "interfaces": interface_totals,
        "alert_count": len(alerts),
        "alerts": alerts[:500],
        "source": "user_supplied_inventory",
        "note": "Report summarizes supplied inventory only; no live polling was performed.",
    }


def analyze_snmp(payload: dict[str, Any]) -> dict[str, Any]:
    varbinds = _bounded_list(payload.get("varbinds"), "varbinds", 5000)
    known = {
        ".1.3.6.1.2.1.1.1.0": "sysDescr",
        ".1.3.6.1.2.1.1.3.0": "sysUpTime",
        ".1.3.6.1.2.1.1.5.0": "sysName",
        ".1.3.6.1.2.1.2.1.0": "ifNumber",
    }
    unknown, recognized = [], []
    for item in varbinds:
        if not isinstance(item, dict) or not isinstance(item.get("oid"), str):
            raise ValueError("each_varbind_requires_oid")
        oid = item["oid"]
        entry = {"oid": oid[:160], "value": str(item.get("value", ""))[:500]}
        if oid in known:
            entry["name"] = known[oid]
            recognized.append(entry)
        else:
            unknown.append(entry)
    return {
        "engine": "netcmd-snmp-analysis-v1",
        "varbind_count": len(varbinds),
        "recognized_count": len(recognized),
        "unknown_oid_count": len(unknown),
        "recognized": recognized,
        "unknown_oids": unknown[:500],
        "note": "Analyzes supplied SNMP varbinds only; no SNMP polling or device connection was performed.",
    }


async def run_job(client: httpx.AsyncClient, job: dict[str, Any]) -> None:
    job_id = job["id"]
    try:
        kind = job["job_kind"]
        payload = job.get("payload") or {}
        handlers = {
            "config_audit": audit_config,
            "topology_discovery": discover_topology,
            "troubleshooting": troubleshoot,
            "bulk_automation": bulk_plan,
            "network_report": network_report,
            "snmp_poll": analyze_snmp,
        }
        handler = handlers.get(kind)
        if handler is None:
            raise ValueError(f"handler_not_available_yet:{kind}")
        result = handler(payload)
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
