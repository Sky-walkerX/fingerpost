import { webcrypto } from 'node:crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { KEY_DESCRIPTION_OID } from '../../src/auth/key-description.ts';

type CryptoKey = webcrypto.CryptoKey;
type CryptoKeyPair = webcrypto.CryptoKeyPair;
// pkijs types its engine against the DOM Crypto; Node's webcrypto is compatible at runtime.
pkijs.setEngine('node-webcrypto', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as never }));
const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;

export interface FakeKeyDescription { challenge: Uint8Array; level?: 0 | 1 | 2; packageName?: string; signatureDigestHex?: string; omitAppId?: boolean; }

/** DER of a KeyDescription with the fields our verifier reads (see key-description.ts). */
export function keyDescriptionDer(o: FakeKeyDescription): Uint8Array {
  const appId = new asn1js.Sequence({ value: [
    new asn1js.Set({ value: [new asn1js.Sequence({ value: [new asn1js.OctetString({ valueHex: new TextEncoder().encode(o.packageName ?? 'io.github.fingerpost') }), new asn1js.Integer({ value: 1 })] })] }),
    new asn1js.Set({ value: [new asn1js.OctetString({ valueHex: Buffer.from(o.signatureDigestHex ?? 'ab'.repeat(32), 'hex') })] }),
  ] });
  const sw = new asn1js.Sequence({ value: o.omitAppId ? [] : [
    new asn1js.Constructed({ idBlock: { tagClass: 3, tagNumber: 709 }, value: [new asn1js.OctetString({ valueHex: appId.toBER() })] }),
  ] });
  const kd = new asn1js.Sequence({ value: [
    new asn1js.Integer({ value: 300 }), new asn1js.Enumerated({ value: o.level ?? 1 }),
    new asn1js.Integer({ value: 300 }), new asn1js.Enumerated({ value: o.level ?? 1 }),
    new asn1js.OctetString({ valueHex: o.challenge }), new asn1js.OctetString({ valueHex: new Uint8Array() }),
    sw, new asn1js.Sequence({ value: [] }),
  ] });
  return new Uint8Array(kd.toBER());
}

async function makeCert(serial: number, subjectCN: string, issuerCN: string, subjectKey: CryptoKeyPair, issuerKey: CryptoKey, ca: boolean, ext?: Uint8Array, notAfter = new Date(Date.now() + 864e5)) {
  const c = new pkijs.Certificate();
  c.version = 2;
  c.serialNumber = new asn1js.Integer({ value: serial });
  c.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: subjectCN }) }));
  c.issuer.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: issuerCN }) }));
  c.notBefore.value = new Date(Date.now() - 864e5);
  c.notAfter.value = notAfter;
  c.extensions = [new pkijs.Extension({ extnID: '2.5.29.19', critical: true, extnValue: new pkijs.BasicConstraints({ cA: ca }).toSchema().toBER(false), parsedValue: new pkijs.BasicConstraints({ cA: ca }) })];
  if (ext) c.extensions.push(new pkijs.Extension({ extnID: KEY_DESCRIPTION_OID, critical: false, extnValue: ext.buffer.slice(ext.byteOffset, ext.byteOffset + ext.byteLength) as ArrayBuffer }));
  await c.subjectPublicKeyInfo.importKey(subjectKey.publicKey as never);
  await c.sign(issuerKey as never, 'SHA-256');
  return new Uint8Array(c.toSchema(true).toBER(false));
}

/** A root → intermediate → leaf chain (returned leaf first) whose leaf carries the given KeyDescription. */
export async function fakeChain(kd: FakeKeyDescription, opts: { expiredLeaf?: boolean } = {}) {
  const gen = () => webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
  const [rootK, interK, leafK] = await Promise.all([gen(), gen(), gen()]);
  const root = await makeCert(1, 'Fake Root', 'Fake Root', rootK, rootK.privateKey, true);
  const inter = await makeCert(2, 'Fake Intermediate', 'Fake Root', interK, rootK.privateKey, true);
  const leaf = await makeCert(3, 'Android Keystore Key', 'Fake Intermediate', leafK, interK.privateKey, false, keyDescriptionDer(kd), opts.expiredLeaf ? new Date(Date.now() - 1000) : undefined);
  return { chain: [leaf, inter, root], root };
}
