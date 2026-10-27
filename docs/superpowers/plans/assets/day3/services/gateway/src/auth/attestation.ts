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
  throw new Error('TODO(D3-T5): implement this; the tests describe the behaviour');
}
