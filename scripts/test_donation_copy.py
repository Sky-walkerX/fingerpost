"""Keep the spoken consent and client/server contract version synchronized."""
from pathlib import Path
import re
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]

class DonationCopyTest(unittest.TestCase):
    def test_spoken_questions_match_reviewable_versioned_consent_in_every_locale(self):
        doc=(ROOT/'docs/donations.md').read_text()
        rows=dict(re.findall(r'^\| (en|hi|es) \| ([^|]+) \|$',doc,re.M))
        self.assertEqual(set(rows),{'en','hi','es'})
        for locale,folder in [('en','values'),('hi','values-hi'),('es','values-es')]:
            xml=ET.parse(ROOT/f'apps/android/app/src/main/res/{folder}/strings.xml').getroot()
            spoken=xml.find("string[@name='donation_question']").text.replace("\\'", "'")
            self.assertEqual(spoken,rows[locale].strip())

    def test_gateway_and_android_consent_versions_agree(self):
        server=(ROOT/'services/gateway/src/donate/donation.ts').read_text()
        client=(ROOT/'apps/android/core/guidance/src/main/kotlin/io/github/fingerpost/guidance/DonationSession.kt').read_text()
        gateway=re.search(r'DONATE_CONSENT_VERSION\s*=\s*[\'"]([^\'"]+)',server)
        android=re.search(r'DONATION_CONSENT_VERSION\s*=\s*[\'"]([^\'"]+)',client)
        self.assertIsNotNone(android,'Android consent version is missing')
        self.assertEqual(android[1],gateway[1])
        self.assertIn(f'## Consent text, `{gateway[1]}`',(ROOT/'docs/donations.md').read_text())

if __name__=='__main__':unittest.main()
