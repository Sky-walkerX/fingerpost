import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('preflight', Path(__file__).with_name('release-preflight.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReleasePreflightTest(unittest.TestCase):
    def valid(self):
        return dict(GITHUB_REF_NAME='v1.0.0-rc1', GITHUB_RUN_NUMBER='12', RELEASE_GATEWAY_URL='wss://gateway.example.test', RELEASE_KEYSTORE='synthetic', RELEASE_STORE_PASSWORD='synthetic', RELEASE_KEY_ALIAS='release', RELEASE_KEY_PASSWORD='synthetic', GOOGLE_SERVICES_JSON='synthetic')

    def test_derives_version_and_secure_base(self):
        self.assertEqual(module.validate(self.valid()), ('1.0.0-rc1', 12, 'wss://gateway.example.test'))

    def test_rejects_missing_secrets_without_echoing_values(self):
        for key in ['RELEASE_KEYSTORE', 'RELEASE_STORE_PASSWORD', 'RELEASE_KEY_ALIAS', 'RELEASE_KEY_PASSWORD', 'GOOGLE_SERVICES_JSON']:
            env = self.valid(); env.pop(key)
            with self.subTest(key=key), self.assertRaises(ValueError): module.validate(env)

    def test_rejects_insecure_or_ambiguous_gateways(self):
        for url in ['ws://host', 'wss://localhost', 'wss://127.0.0.1', 'wss://[::1]', 'wss://user:secret@host', 'wss://host/v1/session', 'wss://host?token=secret', 'wss://host#fragment', 'wss://host/\nmalicious']:
            env=self.valid(); env['RELEASE_GATEWAY_URL']=url
            with self.subTest(url=url), self.assertRaises(ValueError): module.validate(env)

    def test_rejects_unversioned_tags_and_bad_codes(self):
        for key,value in [('GITHUB_REF_NAME','main'),('GITHUB_REF_NAME','v1.0.0\nnext'),('GITHUB_REF_NAME','v١.0.0'),('GITHUB_RUN_NUMBER','0'),('GITHUB_RUN_NUMBER','1١'),('GITHUB_RUN_NUMBER','2147483648')]:
            env=self.valid();env[key]=value
            with self.subTest(key=key,value=value), self.assertRaises(ValueError): module.validate(env)

    def test_rejects_gateway_literal_injection_and_invalid_hosts(self):
        for url in ['wss://host"', 'wss://host\\evil', 'wss://host\x00',
                    'wss://-host.test', 'wss://host..test', 'wss://host:0',
                    'wss://host:', 'wss://127.1', 'wss://2130706433',
                    'wss://127.0.0.1.', 'wss://localhost.', 'wss://[::ffff:127.0.0.1]',
                    'wss://[2001:db8::1]suffix', 'wss://[2001:db8::1]]']:
            env = self.valid(); env['RELEASE_GATEWAY_URL'] = url
            with self.subTest(url=url), self.assertRaises(ValueError): module.validate(env)

    def test_accepts_dns_and_ip_literal_gateways_with_valid_ports(self):
        for url in ['wss://gateway.example.test:443', 'wss://203.0.113.1:8443', 'wss://[2001:db8::1]']:
            env = self.valid(); env['RELEASE_GATEWAY_URL'] = url
            with self.subTest(url=url): self.assertEqual(module.validate(env)[2], url)

    def test_rejects_versions_the_android_updater_cannot_parse(self):
        for core in ['01.0.0', '1.01.0', '1.0.01', '00.0.0',
                     '2147483648.0.0', '1.2147483648.0', '1.0.2147483648',
                     f'{"9" * 5000}.0.0']:
            env = self.valid(); env['GITHUB_REF_NAME'] = f'v{core}'
            with self.subTest(core=core[:40]), self.assertRaises(ValueError): module.validate(env)

    def test_accepts_android_version_component_boundaries(self):
        for version in ['0.0.0', '1.0.0-rc1', '2147483647.2147483647.2147483647']:
            env = self.valid(); env['GITHUB_REF_NAME'] = f'v{version}'
            with self.subTest(version=version): self.assertEqual(module.validate(env)[0], version)
