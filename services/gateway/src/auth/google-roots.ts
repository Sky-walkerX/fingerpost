import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';

/**
 * Google's hardware attestation root certificates, from
 * https://developer.android.com/privacy-and-security/security-key-attestation#root_certificate
 * saved as services/gateway/certs/google-roots.pem (several PEM blocks). Reviewers check the SHA-256 fingerprints
 * recorded in docs/adr/0004-key-attestation.md against that page.
 */
export function loadGoogleRoots(path = new URL('../../certs/google-roots.pem', import.meta.url)): X509Certificate[] {
  const pem = readFileSync(path, 'utf8');
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (blocks.length === 0) throw new Error('google-roots.pem has no certificates');
  return blocks.map((b) => new X509Certificate(b));
}
