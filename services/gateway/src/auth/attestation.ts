import { createHash, timingSafeEqual, X509Certificate } from 'node:crypto';
import * as pkijs from 'pkijs';
import { KEY_DESCRIPTION_OID, parseKeyDescription, type SecurityLevel } from './key-description.ts';

export interface AttestationPolicy {
  /** Google hardware attestation roots (PEM or DER), loaded from src/auth/google-roots.pem. */
  trustedRoots: readonly X509Certificate[];
  packageName: string;
  /** Lowercase hex SHA-256 of our release (and debug, in dev) signing certificates. */
  signatureDigests: readonly string[];
  allowSoftware: boolean;
  /** Serial numbers (lowercase hex, no leading zeros) from https://android.googleapis.com/attestation/status. */
  isRevoked?: (serialHex: string) => boolean;
  now?: Date;
}

export type AttestationResult =
  | { ok: true; level: SecurityLevel; keyId: string }
  | { ok: false; reason: string };

const spki = (c: X509Certificate) => c.publicKey.export({ type: 'spki', format: 'der' });
const normSerial = (s: string) => s.toLowerCase().replace(/^0+/, '');

/**
 * Verifies an Android Key Attestation chain (leaf first) for our app and the server's challenge (ADR 0004).
 * keyId = SHA-256 of the attested public key (hex); use it to bind the session JWT.
 */
export function verifyAttestation(chainDer: readonly Uint8Array[], expectedChallenge: Uint8Array, p: AttestationPolicy): AttestationResult {
  const fail = (reason: string): AttestationResult => ({ ok: false, reason });
  if (chainDer.length < 2 || chainDer.length > 10) return fail('chain length');
  let certs: X509Certificate[];
  try {
    certs = chainDer.map((der) => new X509Certificate(Buffer.from(der)));
  } catch {
    return fail('unparseable certificate');
  }
  const now = (p.now ?? new Date()).getTime();
  for (const [i, cert] of certs.entries()) {
    if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) return fail(`certificate ${i} not valid now`);
    if (p.isRevoked?.(normSerial(cert.serialNumber))) return fail(`certificate ${i} revoked`);
    const issuer = certs[i + 1] ?? cert;
    if (!cert.checkIssued(issuer) || !cert.verify(issuer.publicKey)) return fail(`certificate ${i} not signed by its issuer`);
  }
  const rootKey = spki(certs.at(-1)!);
  if (!p.trustedRoots.some((root) => spki(root).equals(rootKey))) return fail('untrusted root');

  const leaf = pkijs.Certificate.fromBER(Buffer.from(chainDer[0]!));
  const extension = leaf.extensions?.find((e) => e.extnID === KEY_DESCRIPTION_OID);
  if (!extension) return fail('no attestation extension');
  let kd;
  try {
    kd = parseKeyDescription(new Uint8Array(extension.extnValue.valueBlock.valueHexView));
  } catch (e) {
    return fail(`bad attestation extension: ${e instanceof Error ? e.message : 'parse error'}`);
  }
  if (kd.challenge.length !== expectedChallenge.length || !timingSafeEqual(kd.challenge, expectedChallenge)) return fail('challenge mismatch');
  if (kd.attestationSecurityLevel === 'software' && !p.allowSoftware) return fail('software attestation not allowed');
  if (!kd.packageNames.includes(p.packageName)) return fail('wrong package');
  if (!kd.signatureDigests.some((d) => p.signatureDigests.includes(d))) return fail('wrong signing certificate');
  return { ok: true, level: kd.attestationSecurityLevel, keyId: createHash('sha256').update(spki(certs[0]!)).digest('hex') };
}
