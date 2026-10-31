import base64
import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("prepare_google_services", Path(__file__).with_name("prepare-google-services.py"))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def encoded(package="io.github.fingerpost"):
    return base64.b64encode(json.dumps({"project_info": {"project_id": "synthetic-project"}, "client": [
        {"client_info": {"android_client_info": {"package_name": package}}}]}).encode()).decode()


class PrepareConfigTest(unittest.TestCase):
    def test_missing_secret_leaves_the_checkout_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "google-services.json"
            self.assertFalse(prepare.prepare_config(None, path))
            self.assertFalse(path.exists())

    def test_config_decodes_privately_without_logging_contents(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "google-services.json"
            value = encoded()
            self.assertTrue(prepare.prepare_config(value[:30] + "\n" + value[30:], path))
            self.assertEqual(json.loads(path.read_text())["project_info"]["project_id"], "synthetic-project")
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_invalid_inputs_fail_before_creating_the_file_with_generic_errors(self):
        for value in ["synthetic-invalid-secret", base64.b64encode(b"not json").decode(), encoded("synthetic.wrong.app"),
                      base64.b64encode(b'{"client":["synthetic-private-value"]}').decode()]:
            with self.subTest(value=value), tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "google-services.json"
                with self.assertRaisesRegex(ValueError, "Invalid Firebase configuration") as error:
                    prepare.prepare_config(value, path)
                self.assertNotIn("synthetic", str(error.exception))
                self.assertFalse(path.exists())

    def test_existing_private_configuration_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "google-services.json"
            path.write_text("synthetic-existing-private-configuration")
            with self.assertRaisesRegex(ValueError, "already exists"):
                prepare.prepare_config(encoded(), path)
            self.assertEqual(path.read_text(), "synthetic-existing-private-configuration")


if __name__ == "__main__":
    unittest.main()
