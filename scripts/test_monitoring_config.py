"""Generate disabled policies using synthetic settings; never contact Google Cloud."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "infra/monitoring/generate.py"
PROJECT = "synthetic-project"
CHANNEL = f"projects/{PROJECT}/notificationChannels/12345"


class MonitoringConfigTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name).resolve()
        self.output = self.directory / "policies"

    def run_script(self, project=PROJECT, cap="12", channel=CHANNEL, output=None):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--project", project, "--daily-cap-usd", cap,
             "--notification-channel", channel, "--output-dir", str(output or self.output)],
            capture_output=True, text=True, timeout=5,
        )

    def test_policies_are_disabled_and_preserve_strict_thresholds(self):
        result = self.run_script(cap="12.125")
        self.assertEqual(result.returncode, 0, result.stderr)
        policies = [json.loads(path.read_text()) for path in sorted(self.output.glob("*.json"))]
        self.assertEqual(len(policies), 3)
        thresholds = {}
        for policy in policies:
            self.assertIs(policy["enabled"], False)
            self.assertEqual(policy["notificationChannels"], [CHANNEL])
            self.assertEqual(policy["combiner"], "OR")
            condition = policy["conditions"][0]["conditionThreshold"]
            self.assertEqual(condition["comparison"], "COMPARISON_GT")
            self.assertEqual(condition["evaluationMissingData"], "EVALUATION_MISSING_DATA_NO_OP")
            self.assertIn('resource.labels.project_id = "synthetic-project"', condition["filter"])
            self.assertIn('resource.type = "global"', condition["filter"])
            self.assertNotIn("denominatorFilter", condition)
            metric = condition["filter"].split('metric.type = "')[1].split('"')[0]
            thresholds[metric.rsplit("/", 1)[1]] = condition["thresholdValue"]
        self.assertEqual(thresholds, {"task_error_ratio": 0.05, "parse_p95_seconds": 5,
                                      "daily_spend_micros": 9700000})
        self.assertIn("disabled", result.stdout)

    def test_invalid_inputs_leave_no_output(self):
        for field, values in {
            "project": ["", "abc", "-synthetic", "Synthetic-project", "synthetic-project-", 'bad"project'],
            "cap": ["0", "-1", "NaN", "Infinity", "1e20", "0.0000001", "12;command"],
            "channel": ["", "person@example.invalid", "projects/other-project/notificationChannels/1",
                        f"projects/{PROJECT}/notificationChannels/bad"],
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    result = self.run_script(**{field: value})
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertFalse(self.output.exists())

    def test_output_must_be_new_and_have_an_existing_parent(self):
        self.output.mkdir()
        sentinel = self.output / "keep.txt"
        sentinel.write_text("keep")
        self.assertEqual(self.run_script().returncode, 2)
        self.assertEqual(sentinel.read_text(), "keep")
        self.assertEqual(self.run_script(output=self.directory / "absent" / "child").returncode, 2)
        link = self.directory / "linked"
        link.symlink_to(self.output, target_is_directory=True)
        self.assertEqual(self.run_script(output=link).returncode, 2)
        self.assertEqual(self.run_script(output=link / "child").returncode, 2)


if __name__ == "__main__":
    unittest.main()
