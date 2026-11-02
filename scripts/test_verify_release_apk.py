"""Exercise signature-verification orchestration with synthetic signer output; no SDK needed."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('verify-release-apk.py')
spec = importlib.util.spec_from_file_location('verify_release_apk', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
DIGEST = 'ab' * 32


class VerifyReleaseApkTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.apk = self.directory / 'release APK.apk'
        self.apk.write_bytes(b'synthetic')
        self.signer = self.directory / 'apksigner'
        self.log = self.directory / 'arguments.json'

    def stub(self, stdout, code=0):
        self.signer.write_text(f'#!{sys.executable}\nimport json, sys\nfrom pathlib import Path\n'
                               f'Path({str(self.log)!r}).write_text(json.dumps(sys.argv[1:]))\n'
                               f'print({stdout!r})\nsys.exit({code})\n')
        self.signer.chmod(0o700)

    def test_verifies_actual_tool_exit_and_sole_certificate(self):
        self.stub(f'Verifies\nSigner #1 certificate SHA-256 digest: {DIGEST}')
        module.verify(self.signer, self.apk, DIGEST)
        self.assertEqual(json.loads(self.log.read_text()),
                         ['verify', '--verbose', '--print-certs', str(self.apk)])

    def test_rejects_missing_wrong_or_additional_signers(self):
        for stdout in ['', f'Signer #1 certificate SHA-256 digest: {"cd" * 32}',
                       f'Signer #2 certificate SHA-256 digest: {DIGEST}',
                       f'Signer #1 certificate SHA-256 digest: {DIGEST}\nSigner #2 certificate SHA-256 digest: {DIGEST}']:
            self.stub(stdout)
            with self.subTest(stdout=stdout), self.assertRaises(ValueError):
                module.verify(self.signer, self.apk, DIGEST)

    def test_matching_certificate_does_not_hide_signature_failure(self):
        self.stub(f'Signer #1 certificate SHA-256 digest: {DIGEST}', code=1)
        with self.assertRaises(subprocess.CalledProcessError):
            module.verify(self.signer, self.apk, DIGEST)

    def test_invalid_expected_digest_or_missing_apk_never_invokes_tool(self):
        self.stub('')
        for digest in ['', DIGEST.upper(), DIGEST + '\n', 'not-a-digest']:
            with self.subTest(digest=digest), self.assertRaises(ValueError):
                module.verify(self.signer, self.apk, digest)
        self.apk.unlink()
        with self.assertRaises(ValueError): module.verify(self.signer, self.apk, DIGEST)
        self.assertFalse(self.log.exists())

    def test_cli_does_not_relay_tool_output(self):
        self.stub('synthetic-private-tool-output', code=1)
        result = subprocess.run([sys.executable, str(SCRIPT), '--apksigner', str(self.signer),
                                 '--apk', str(self.apk), '--expected-certificate-sha256', DIGEST],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('synthetic-private-tool-output', result.stdout + result.stderr)
