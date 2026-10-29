import { X509Certificate } from 'node:crypto';
import { expect, test } from 'vitest';
import { verifyAttestation, type AttestationPolicy } from '../src/auth/attestation.ts';
import { parseKeyDescription } from '../src/auth/key-description.ts';
import { fakeChain, keyDescriptionDer } from './helpers/fake-attestation.ts';

const challenge = new Uint8Array(32).fill(7);
const digest = 'cd'.repeat(32);
const policy = (root: Uint8Array, over: Partial<AttestationPolicy> = {}): AttestationPolicy =>
  ({ trustedRoots: [new X509Certificate(Buffer.from(root))], packageName: 'io.github.fingerpost', signatureDigests: [digest], allowSoftware: false, ...over });

test('parseKeyDescription reads level, challenge, package and digest', () => {
  const kd = parseKeyDescription(keyDescriptionDer({ challenge, level: 2, signatureDigestHex: digest }));
  expect(kd).toMatchObject({ attestationVersion: 300, attestationSecurityLevel: 'strongbox', packageNames: ['io.github.fingerpost'], signatureDigests: [digest] });
  expect([...kd.challenge]).toEqual([...challenge]);
});
test('parseKeyDescription rejects garbage', () => expect(() => parseKeyDescription(new Uint8Array([1, 2, 3]))).toThrow());

test('a valid TEE chain for our app and challenge passes and yields a key id', async () => {
  const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest });
  const r = verifyAttestation(chain, challenge, policy(root));
  expect(r).toMatchObject({ ok: true, level: 'tee' });
  if (r.ok) expect(r.keyId).toMatch(/^[0-9a-f]{64}$/);
});
test.each([
  ['challenge mismatch', async () => { const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest }); return verifyAttestation(chain, new Uint8Array(32), policy(root)); }],
  ['wrong package', async () => { const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest, packageName: 'com.evil' }); return verifyAttestation(chain, challenge, policy(root)); }],
  ['wrong signing certificate', async () => { const { chain, root } = await fakeChain({ challenge }); return verifyAttestation(chain, challenge, policy(root)); }],
  ['software attestation not allowed', async () => { const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest, level: 0 }); return verifyAttestation(chain, challenge, policy(root)); }],
  ['untrusted root', async () => { const a = await fakeChain({ challenge, signatureDigestHex: digest }); const b = await fakeChain({ challenge }); return verifyAttestation(a.chain, challenge, policy(b.root)); }],
  ['certificate 0 not valid now', async () => { const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest }, { expiredLeaf: true }); return verifyAttestation(chain, challenge, policy(root)); }],
  ['certificate 1 revoked', async () => { const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest }); return verifyAttestation(chain, challenge, policy(root, { isRevoked: (s) => s === '2' })); }],
  ['certificate 0 not signed by its issuer', async () => { const a = await fakeChain({ challenge, signatureDigestHex: digest }); const b = await fakeChain({ challenge, signatureDigestHex: digest }); return verifyAttestation([a.chain[0]!, b.chain[1]!, b.chain[2]!], challenge, policy(b.root)); }],
  ['no attestation extension', async () => { const { chain, root } = await fakeChain({ challenge }); return verifyAttestation([chain[1]!, chain[2]!], challenge, policy(root)); }],
  ['chain length', async () => { const { root } = await fakeChain({ challenge }); return verifyAttestation([root], challenge, policy(root)); }],
])('rejects: %s', async (reason, run) => {
  expect(await run()).toEqual({ ok: false, reason });
});
test('a certificate signed by a genuine attested key is not accepted as the leaf', async () => {
  const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest }, { forgedChild: true });
  expect(verifyAttestation(chain, challenge, policy(root))).toEqual({ ok: false, reason: 'certificate 1 is not a CA' });
});
test('revocation fails closed when the status list is unavailable', async () => {
  const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest });
  expect(verifyAttestation(chain, challenge, policy(root, { isRevoked: () => { throw new Error('status list not loaded'); } })))
    .toEqual({ ok: false, reason: 'revocation status unavailable' });
});
test('software attestation passes when allowed (lower quota tier)', async () => {
  const { chain, root } = await fakeChain({ challenge, signatureDigestHex: digest, level: 0 });
  expect(verifyAttestation(chain, challenge, policy(root, { allowSoftware: true }))).toMatchObject({ ok: true, level: 'software' });
});
test('a chain with no app id is rejected as wrong package', async () => {
  const { chain, root } = await fakeChain({ challenge, omitAppId: true });
  expect(verifyAttestation(chain, challenge, policy(root))).toEqual({ ok: false, reason: 'wrong package' });
});
