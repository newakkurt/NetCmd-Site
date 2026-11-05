import os
import unittest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "unit-test-key")

from worker import (
    audit_config, discover_topology, troubleshoot, bulk_plan,
    network_report, analyze_snmp,
)


class ConfigAuditTests(unittest.TestCase):
    def test_detects_telnet_and_community_snmp(self):
        result = audit_config({
            "config_text": "line vty 0 4\n transport input telnet\nsnmp-server community public RO"
        })
        rules = {item["rule"] for item in result["findings"]}
        self.assertIn("telnet", rules)
        self.assertIn("snmp-server community", rules)

    def test_detects_portfast_without_crashing(self):
        result = audit_config({"config_text": "spanning-tree portfast"})
        self.assertEqual(result["finding_count"], 1)
        self.assertEqual(result["findings"][0]["rule"], "spanning-tree portfast")

    def test_rejects_missing_or_oversized_config(self):
        with self.assertRaisesRegex(ValueError, "config_text_required"):
            audit_config({})
        with self.assertRaisesRegex(ValueError, "config_text_too_large"):
            audit_config({"config_text": "x" * 200_001})


class SafeProHandlerTests(unittest.TestCase):
    def test_topology_summary_and_invalid_link(self):
        result = discover_topology({
            "nodes": [{"id": "sw1"}, {"id": "sw2"}, {"id": "ap1"}],
            "links": [{"source": "sw1", "target": "sw2"}],
        })
        self.assertEqual(result["connected_components"], 2)
        self.assertEqual(result["isolated_nodes"], ["ap1"])
        with self.assertRaisesRegex(ValueError, "link_endpoint_invalid"):
            discover_topology({"nodes": [{"id": "sw1"}], "links": [{"source": "sw1", "target": "missing"}]})

    def test_troubleshooting_uses_supplied_evidence_only(self):
        result = troubleshoot({
            "symptom": "Users report no DHCP address",
            "evidence": [{"output": "DHCP timeout on access VLAN"}],
        })
        self.assertEqual(result["match_count"], 1)
        self.assertIn("DHCP address assignment failure", result["matches"][0]["diagnosis"])

    def test_bulk_plan_is_dry_run_and_shutdown_needs_reference(self):
        with self.assertRaisesRegex(ValueError, "dry_run_must_be_true"):
            bulk_plan({"vendor": "cisco", "operation": "set_description", "targets": [], "dry_run": False})
        with self.assertRaisesRegex(ValueError, "approval_reference_required"):
            bulk_plan({"vendor": "huawei", "operation": "shutdown_unused_ports", "targets": [{"interface": "GE0/0/1"}], "dry_run": True})
        result = bulk_plan({
            "vendor": "cisco", "operation": "set_description", "dry_run": True,
            "targets": [{"interface": "Gi1/0/1", "description": "User access"}],
        })
        self.assertTrue(result["approval_required_before_execution"])
        self.assertIn("description User access", result["commands"])

    def test_network_report_and_snmp_oid_classification(self):
        report = network_report({"devices": [{
            "name": "sw1", "status": "up",
            "interfaces": [{"name": "Gi1/0/1", "status": "down", "expected_up": True}],
        }]})
        self.assertEqual(report["alert_count"], 1)
        snmp = analyze_snmp({"varbinds": [
            {"oid": ".1.3.6.1.2.1.1.5.0", "value": "SW-01"},
            {"oid": ".1.3.6.1.4.1.99999.1", "value": "42"},
        ]})
        self.assertEqual(snmp["recognized_count"], 1)
        self.assertEqual(snmp["unknown_oid_count"], 1)


if __name__ == "__main__":
    unittest.main()
