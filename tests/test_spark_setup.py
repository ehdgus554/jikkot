import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("spark_setup", Path(__file__).resolve().parents[1] / "scripts/setup-spark-cloudshell.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class SparkSetupTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        (self.root / "firestore.rules").write_text("rules_version = '2';")
        self.old_umask = os.umask(0o077)

    def tearDown(self):
        os.umask(self.old_umask)
        self.directory.cleanup()

    def key(self, project=setup.PROJECT):
        return {"type": "service_account", "project_id": project, "client_email": setup.ACCOUNT,
                "private_key": "-----BEGIN PRIVATE KEY-----\nfixture-key-material\n-----END PRIVATE KEY-----\n"}

    def test_missing_auth_stops_before_remote_mutations(self):
        with patch.object(setup, "gcloud", return_value="") as cli:
            with self.assertRaisesRegex(setup.SetupError, "계정 인증"):
                setup.apply_setup(self.root)
        self.assertEqual(cli.call_count, 1)
        self.assertFalse((self.root / "outputs").exists())

    def test_wrong_project_key_is_not_overwritten_or_used(self):
        output = self.root / "outputs"
        output.mkdir()
        key = output / "firebase-worker-service-account.json"
        original = json.dumps(self.key("another-project"))
        key.write_text(original)
        with patch.object(setup, "gcloud") as cli:
            with self.assertRaisesRegex(setup.SetupError, "일치하지"):
                setup.apply_setup(self.root)
        cli.assert_not_called()
        self.assertEqual(key.read_text(), original)

    def test_key_symlink_is_rejected_before_account_access(self):
        output = self.root / "outputs"
        output.mkdir()
        (output / "firebase-worker-service-account.json").symlink_to(self.root / "other-key")
        with patch.object(setup, "gcloud") as cli:
            with self.assertRaisesRegex(setup.SetupError, "심볼릭"):
                setup.apply_setup(self.root)
        cli.assert_not_called()

    def test_existing_database_rules_and_key_are_reused_without_secret_output(self):
        output = self.root / "outputs"
        output.mkdir()
        key = output / "firebase-worker-service-account.json"
        key.write_text(json.dumps(self.key()))
        def cli(*args, **_kwargs):
            if args[:2] == ("auth", "list"):
                return "owner@example.invalid"
            if args[:2] == ("projects", "describe"):
                return json.dumps({"projectId": setup.PROJECT, "projectNumber": setup.PROJECT_NUMBER})
            if args[:3] == ("firestore", "databases", "describe"):
                return json.dumps({"type": "FIRESTORE_NATIVE", "locationId": "existing-region"})
            if args[:2] == ("auth", "print-access-token"):
                return "fixture-OAuth-token"
            return "{}"
        def rules(_token, path, *args, **_kwargs):
            if "releases" in path:
                return {"rulesetName": f"projects/{setup.PROJECT}/rulesets/existing"}
            return {"source": {"files": [{"name": "firestore.rules", "content": "rules_version = '2';"}]}}
        stdout = io.StringIO()
        with patch.object(setup, "gcloud", side_effect=cli) as calls, patch.object(setup, "rules_api", side_effect=rules) as rule_calls, contextlib.redirect_stdout(stdout):
            setup.apply_setup(self.root)
        commands = [c.args for c in calls.call_args_list]
        self.assertFalse(any("keys" in c or "create" in c for c in commands))
        self.assertTrue(any("roles/datastore.user" in c for c in commands))
        self.assertFalse(any("billing" in c or "functions" in c or "ttl" in c for c in commands))
        self.assertEqual(rule_calls.call_count, 2)
        self.assertNotIn("fixture-key-material", stdout.getvalue())
        self.assertNotIn("fixture-OAuth-token", stdout.getvalue())
        self.assertEqual(key.stat().st_mode & 0o777, 0o600)
        receipt = json.loads((output / "firebase-server-setup-receipt.json").read_text())
        self.assertFalse(receipt["billingChanged"])
        self.assertFalse(receipt["ttlEnabled"])

    def test_first_setup_creates_only_the_scoped_account_default_database_rules_and_private_key_file(self):
        def cli(*args, **_kwargs):
            if args[:2] == ("auth", "list"):
                return "owner@example.invalid"
            if args[:2] == ("projects", "describe"):
                return json.dumps({"projectId": setup.PROJECT, "projectNumber": setup.PROJECT_NUMBER})
            if args[:3] in [("iam", "service-accounts", "describe"), ("firestore", "databases", "describe")]:
                return None
            if args[:2] == ("auth", "print-access-token"):
                return "fixture-OAuth-token"
            if args[:4] == ("iam", "service-accounts", "keys", "create"):
                Path(args[4]).write_text(json.dumps(self.key()))
            return "{}"
        def rules(_token, path, method="GET", body=None, **_kwargs):
            if method == "GET":
                return None
            if path.endswith("rulesets"):
                return {"name": f"projects/{setup.PROJECT}/rulesets/new"}
            return body
        stdout = io.StringIO()
        with patch.object(setup, "gcloud", side_effect=cli) as calls, patch.object(setup, "rules_api", side_effect=rules) as rule_calls, contextlib.redirect_stdout(stdout):
            setup.apply_setup(self.root)
        commands = [call.args for call in calls.call_args_list]
        self.assertTrue(any(command[:3] == ("iam", "service-accounts", "create") for command in commands))
        database = next(command for command in commands if command[:3] == ("firestore", "databases", "create"))
        self.assertIn("--database=(default)", database)
        self.assertIn("--location=asia-northeast3", database)
        self.assertTrue(any("roles/datastore.user" in command for command in commands))
        self.assertFalse(any("billing" in command or "functions" in command or "ttl" in command for command in commands))
        self.assertEqual(rule_calls.call_count, 3)
        key = self.root / "outputs/firebase-worker-service-account.json"
        self.assertEqual(key.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads(key.read_text())["client_email"], setup.ACCOUNT)
        self.assertEqual(list((self.root / "outputs").glob(".firebase-worker-key-*")), [])
        self.assertNotIn("fixture-key-material", stdout.getvalue())
        self.assertNotIn("fixture-OAuth-token", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
