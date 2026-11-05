import os
import unittest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "unit-test-key")

from worker import (\n    audit_config, discover_topology, troubleshoot, bulk_plan,\n    network_report, analyze_snmp,\n)


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


if __name__ == "__main__":
    unittest.main()
