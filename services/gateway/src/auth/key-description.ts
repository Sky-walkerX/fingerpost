import * as asn1js from 'asn1js';

/** Android Key Attestation extension (https://source.android.com/docs/security/features/keystore/attestation). */
export const KEY_DESCRIPTION_OID = '1.3.6.1.4.1.11129.2.1.17';
const TAG_ATTESTATION_APPLICATION_ID = 709;

export type SecurityLevel = 'software' | 'tee' | 'strongbox';
const LEVELS: Record<number, SecurityLevel> = { 0: 'software', 1: 'tee', 2: 'strongbox' };

export interface KeyDescription {
  attestationVersion: number;
  attestationSecurityLevel: SecurityLevel;
  challenge: Uint8Array;
  packageNames: string[];
  /** SHA-256 digests of the app's signing certificates, lowercase hex. */
  signatureDigests: string[];
}

const hex = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('hex');
const bytes = (o: asn1js.OctetString) => new Uint8Array(o.valueBlock.valueHexView);

/**
 * KeyDescription ::= SEQUENCE { attestationVersion INTEGER, attestationSecurityLevel ENUMERATED,
 *   keyMintVersion INTEGER, keyMintSecurityLevel ENUMERATED, attestationChallenge OCTET STRING,
 *   uniqueId OCTET STRING, softwareEnforced AuthorizationList, hardwareEnforced AuthorizationList }
 * attestationApplicationId is [709] EXPLICIT OCTET STRING inside softwareEnforced; its content is DER of
 *   SEQUENCE { packageInfos SET OF SEQUENCE { packageName OCTET STRING, version INTEGER }, signatureDigests SET OF OCTET STRING }.
 * Throws on malformed input.
 */
export function parseKeyDescription(der: Uint8Array): KeyDescription {
  const { result, offset } = asn1js.fromBER(der);
  if (offset === -1 || !(result instanceof asn1js.Sequence)) throw new Error('KeyDescription is not a SEQUENCE');
  const f = result.valueBlock.value;
  const [ver, lvl, , , challenge, , sw] = f;
  if (!(ver instanceof asn1js.Integer) || !(lvl instanceof asn1js.Enumerated) || !(challenge instanceof asn1js.OctetString) || !(sw instanceof asn1js.Sequence)) throw new Error('KeyDescription fields have unexpected types');
  const level = LEVELS[lvl.valueBlock.valueDec];
  if (!level) throw new Error(`unknown security level ${lvl.valueBlock.valueDec}`);

  const appIdTagged = sw.valueBlock.value.find((v) => v.idBlock.tagClass === 3 && v.idBlock.tagNumber === TAG_ATTESTATION_APPLICATION_ID);
  const packageNames: string[] = [];
  const signatureDigests: string[] = [];
  if (appIdTagged instanceof asn1js.Constructed) {
    const inner = appIdTagged.valueBlock.value[0];
    if (!(inner instanceof asn1js.OctetString)) throw new Error('attestationApplicationId is not an OCTET STRING');
    const app = asn1js.fromBER(bytes(inner)).result;
    if (!(app instanceof asn1js.Sequence)) throw new Error('AttestationApplicationId is not a SEQUENCE');
    const [infos, digests] = app.valueBlock.value;
    if (infos instanceof asn1js.Set) for (const pi of infos.valueBlock.value) {
      const name = pi instanceof asn1js.Sequence ? pi.valueBlock.value[0] : undefined;
      if (name instanceof asn1js.OctetString) packageNames.push(Buffer.from(bytes(name)).toString('utf8'));
    }
    if (digests instanceof asn1js.Set) for (const d of digests.valueBlock.value) if (d instanceof asn1js.OctetString) signatureDigests.push(hex(bytes(d)));
  }
  return { attestationVersion: ver.valueBlock.valueDec, attestationSecurityLevel: level, challenge: bytes(challenge), packageNames, signatureDigests };
}
