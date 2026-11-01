/** 64-bit FNV-1a, the per-token hash SimHash sums. */
function fnv1a64(text: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}

/** Charikar SimHash over a bag of tokens: near-identical screens give nearby 64-bit hashes (design §4.2). */
export function simhash64(tokens: string[]): bigint {
  const weights = new Array<number>(64).fill(0);
  for (const token of tokens) {
    const h = fnv1a64(token);
    for (let bit = 0; bit < 64; bit++) weights[bit]! += (h >> BigInt(bit)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let bit = 0; bit < 64; bit++) if (weights[bit]! > 0) out |= 1n << BigInt(bit);
  return out;
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

/** Four 16-bit bands "index:hex". Hashes within Hamming 3 share at least one band exactly (pigeonhole). */
export function lshBands(h: bigint): [string, string, string, string] {
  const band = (i: number) => `${i}:${((h >> BigInt(16 * i)) & 0xffffn).toString(16).padStart(4, '0')}`;
  return [band(0), band(1), band(2), band(3)];
}
