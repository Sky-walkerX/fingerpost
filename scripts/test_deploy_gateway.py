"""Exercise deployment orchestration with local command stubs; no cloud calls."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "infra" / "deploy-gateway.sh"
DIGEST = "ab" * 32


class DeployGatewayTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.log = self.directory / "commands.jsonl"
        stub = "#!" + sys.executable + "\n" + '''
import json, os, sys
from pathlib import Path
if Path(sys.argv[0]).name == "git":
    if "status" in sys.argv:
        print(os.environ.get("FP_TEST_DIRTY", ""), end="")
    elif "rev-parse" in sys.argv:
        print("abc1234")
    else:
        sys.exit(91)
else:
    with open(os.environ["FP_TEST_COMMAND_LOG"], "a") as out:
        out.write(json.dumps(sys.argv[1:]) + "\\n")
    if sys.argv[1:3] == ["builds", "submit"]:
        sys.exit(int(os.environ.get("FP_TEST_BUILD_EXIT", "0")))
    if sys.argv[1:3] == ["run", "deploy"]:
        sys.exit(int(os.environ.get("FP_TEST_DEPLOY_EXIT", "0")))
    sys.exit(92)
'''
        for name in ("git", "gcloud"):
            command = self.directory / name
            command.write_text(stub)
            command.chmod(0o700)
        self.environment = {**os.environ, "PATH": str(self.directory) + os.pathsep + os.environ["PATH"],
                            "FP_TEST_COMMAND_LOG": str(self.log)}

    def run_script(self, *arguments):
        return subprocess.run(["bash", str(SCRIPT), *arguments], env=self.environment,
                              cwd=self.directory, capture_output=True, text=True, timeout=5)

    def commands(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_invalid_arguments_never_contact_cloud(self):
        for arguments in [(), ("synthetic-project",), ("synthetic-project", "asia-south1"),
                          ("bad;command", "asia-south1", DIGEST),
                          ("synthetic-project", "unknown-region", DIGEST),
                          ("synthetic-project", "asia-south1", "AB" * 32),
                          ("synthetic-project", "asia-south1", DIGEST + ";rm"),
                          ("synthetic-project", "asia-south1", DIGEST, "extra")]:
            with self.subTest(arguments=arguments):
                self.assertEqual(self.run_script(*arguments).returncode, 2)
                self.assertEqual(self.commands(), [])

    def test_dirty_checkout_is_not_deployed_under_a_clean_commit_tag(self):
        self.environment["FP_TEST_DIRTY"] = " M synthetic-file\n"
        result = self.run_script("synthetic-project", "asia-south1", DIGEST)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.commands(), [])

    def test_build_failure_prevents_deployment(self):
        self.environment["FP_TEST_BUILD_EXIT"] = "18"
        result = self.run_script("synthetic-project", "asia-south1", DIGEST)
        self.assertEqual(result.returncode, 18)
        self.assertEqual(len(self.commands()), 1)
        self.assertEqual(self.commands()[0][:2], ["builds", "submit"])

    def test_builds_the_gateway_dockerfile_and_deploys_the_same_revision(self):
        for region in ("asia-south1", "us-central1"):
            with self.subTest(region=region):
                self.log.unlink(missing_ok=True)
                result = self.run_script("synthetic-project", region, DIGEST)
                self.assertEqual(result.returncode, 0, result.stderr)
                build, deploy = self.commands()
                image = region + "-docker.pkg.dev/synthetic-project/fp/gateway:abc1234"
                self.assertEqual(build[:2], ["builds", "submit"])
                self.assertEqual(build[build.index("--config") + 1], "infra/cloudbuild.yaml")
                self.assertEqual(build[build.index("--ignore-file") + 1], ".gcloudignore")
                self.assertEqual(build[build.index("--substitutions") + 1], "_IMAGE=" + image)
                self.assertEqual(deploy[:3], ["run", "deploy", "fingerpost-gateway"])
                self.assertEqual(deploy[deploy.index("--image") + 1], image)
                self.assertIn("META_API_KEY=meta-api-key:latest,DEBUG_TOKEN=debug-token:latest,"
                              "SESSION_SECRET=session-secret:latest", deploy)
                self.assertIn("^;^MODEL_MODE=live;GIT_SHA=abc1234;AUTH_REQUIRED=true;SIGNING_DIGESTS=" + DIGEST
                              + ";FIREBASE_PROJECT_ID=synthetic-project;DAILY_CAP_USD=12", deploy)
                self.assertNotIn("ALLOW_UNAUTHENTICATED_LIVE", " ".join(deploy))
                self.assertNotIn("SIM_TOKEN", " ".join(deploy))

    def test_simulator_opt_in_uses_secret_manager_and_keeps_auth_enabled(self):
        result = self.run_script("synthetic-project", "asia-south1", DIGEST, "--with-sim")
        self.assertEqual(result.returncode, 0, result.stderr)
        _, deploy = self.commands()
        secrets = deploy[deploy.index("--set-secrets") + 1]
        self.assertIn("SIM_TOKEN=sim-token:latest", secrets.split(","))
        self.assertIn("SESSION_SECRET=session-secret:latest", secrets.split(","))
        self.assertIn("AUTH_REQUIRED=true", " ".join(deploy))
        self.assertNotIn("ALLOW_UNAUTHENTICATED_LIVE", " ".join(deploy))

    def test_simulator_opt_in_still_rejects_an_uncommitted_revision(self):
        self.environment["FP_TEST_DIRTY"] = " M synthetic-file\n"
        result = self.run_script("synthetic-project", "asia-south1", DIGEST, "--with-sim")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Commit and verify", result.stderr)
        self.assertEqual(self.commands(), [])

    def test_deploy_failure_propagates(self):
        self.environment["FP_TEST_DEPLOY_EXIT"] = "19"
        result = self.run_script("synthetic-project", "asia-south1", DIGEST)
        self.assertEqual(result.returncode, 19)
        self.assertEqual(len(self.commands()), 2)


if __name__ == "__main__":
    unittest.main()
