import os
import unittest

os.environ.setdefault("NETCMD_API_KEY_PEPPER", "unit-test-only-pepper")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")

from fastapi.testclient import TestClient
from pydantic import ValidationError
import main


class SaaSApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_is_public_and_reports_service(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "netcmd-cloud-api")

    def test_api_key_digest_is_stable_and_not_plaintext(self):
        raw = "nc_live_example-secret"
        digest = main.key_digest(raw)
        self.assertEqual(len(digest), 64)
        self.assertNotEqual(digest, raw)
        self.assertEqual(digest, main.key_digest(raw))

    def test_api_key_scopes_are_allow_listed(self):
        key = main.ApiKeyCreate(name="automation key", scopes=["jobs:read"])
        self.assertEqual(key.scopes, ["jobs:read"])
        with self.assertRaises(ValidationError):
            main.ApiKeyCreate(name="automation key", scopes=["admin:*"])

    def test_job_kind_is_allow_listed(self):
        job = main.JobCreate(kind="config_audit", payload={"vendor": "huawei"})
        self.assertEqual(job.kind, "config_audit")
        with self.assertRaises(ValidationError):
            main.JobCreate(kind="run_shell", payload={"command": "whoami"})

    def test_scope_check_denies_missing_permission(self):
        with self.assertRaises(Exception):
            main.require_scope({"scopes": ["jobs:read"]}, "jobs:write")


if __name__ == "__main__":
    unittest.main()
