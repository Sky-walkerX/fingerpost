import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import type { Layout, LayoutElement } from '@fingerpost/protocol';
import { normalizeLabel } from '../parse/spark-parse.ts';
import { layoutFingerprint } from '../session/pipeline.ts';
import { hamming, lshBands, simhash64 } from './simhash.ts';
import type { MemoryElement, MemoryEntry, MemoryStore } from './store.ts';

/** A keyframe OCR token (fp.v1 `keyframe.ocrTokens[]`), box in screen-normalized units. */
export interface OcrToken { text: string; box: { u: number; v: number; w: number; h: number } }

/** Prices, numbers and currency change between visits and can be personal: never fingerprinted or stored. */
const DYNAMIC = /[0-9₹$€£]/u;
const MAX_DISTANCE = 3;
const MAX_INSTALLS = 5;
const NEVER_REMEMBER = new Set(['payment_entry', 'pin_pad', 'confirm']);
const SENSITIVE_ROLES = new Set(['pay', 'confirm', 'submit']);

const stripDynamic = (label: string) => label.split(/\s+/).filter((w) => w && !DYNAMIC.test(w)).join(' ').trim();
const stableWords = (tokens: readonly OcrToken[]) =>
  tokens.flatMap((t) => normalizeLabel(t.text).split(' ')).filter((w) => w && !DYNAMIC.test(w));
const aspectBucket = (aspect: number) => (Math.round(aspect * 4) / 4).toFixed(2);
/** Coarse layout shape: how many distinct rows and columns the text sits in. */
function gridSignature(tokens: readonly OcrToken[]): string {
  const rows = new Set(tokens.map((t) => Math.round((t.box.v + t.box.h / 2) * 10)));
  const cols = new Set(tokens.map((t) => Math.round((t.box.u + t.box.w / 2) * 10)));
  return `grid:${rows.size}x${cols.size}`;
}
const centreIn = (t: OcrToken, el: Pick<LayoutElement, 'polygon'>) => {
  const us = el.polygon.map((p) => p.u), vs = el.polygon.map((p) => p.v);
  const cx = t.box.u + t.box.w / 2, cy = t.box.v + t.box.h / 2;
  return cx >= Math.min(...us) && cx <= Math.max(...us) && cy >= Math.min(...vs) && cy <= Math.max(...vs);
};

/**
 * Kiosk memory (design §4.2 step 1, §4.9; Days 4–7 plan B5-2). A screen seen before is answered from its
 * stored structure instead of a model call. Rules that protect users:
 *  - a layout is served only after ≥2 distinct attested installs agreed on it, and only when fresh OCR
 *    still reads every stored label inside its box (a look-alike screen falls through to the model);
 *  - payment, PIN, confirm and sensitive screens are never remembered (their amounts must be read fresh);
 *  - no raw label, model ID or normalized text is stored, even after trust: independent agreement
 *    cannot prove that a string is not a name. Labels are reconstructed only from fresh agreeing OCR.
 */
export class MemoryService {
  private readonly store: MemoryStore;
  private readonly salt: string;
  private readonly minInstalls: number;
  constructor(store: MemoryStore, o: { salt: string; minInstalls?: number }) {
    this.store = store;
    this.salt = o.salt;
    this.minInstalls = o.minInstalls ?? 2;
    if (!Number.isInteger(this.minInstalls) || this.minInstalls < 2 || this.minInstalls > MAX_INSTALLS)
      throw new RangeError('MEMORY_MIN_INSTALLS must be an integer from 2 to 5');
  }

  private hash(kind: string, value: string) {
    return createHash('sha256').update(`${this.salt}:${kind}:${value}`).digest('hex');
  }

  private key(tokens: readonly OcrToken[]): bigint | null {
    const words = stableWords(tokens).map((word) => this.hash('token', word));
    return words.length >= 2 ? simhash64([...words, gridSignature(tokens)]) : null;
  }

  private async nearest(h: bigint, aspect: string): Promise<MemoryEntry | null> {
    const seen = new Map<string, MemoryEntry>();
    for (const band of lshBands(h)) for (const e of await this.store.get(band)) seen.set(e.key, e);
    let best: MemoryEntry | null = null, bestD = MAX_DISTANCE + 1;
    for (const e of seen.values()) {
      if (e.formatVersion !== 2 || e.aspect !== aspect) continue;
      const d = hamming(BigInt(`0x${e.key}`), h);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  async lookup(tokens: readonly OcrToken[], aspect: number): Promise<Layout | null> {
    const h = this.key(tokens);
    if (h === null) return null;
    const entry = await this.nearest(h, aspectBucket(aspect));
    if (!entry?.trusted || !entry.elements.length) return null;
    // Fresh OCR must read every stored label in its place, or this is a different screen.
    const elements: LayoutElement[] = [];
    for (const [index, el] of entry.elements.entries()) {
      const inside = tokens.filter((t) => centreIn(t, el)).map((t) => t.text).join(' ');
      const label = stripDynamic(inside);
      if (!label || this.hash('label', `${el.role}:${normalizeLabel(label)}`) !== el.labelHash) return null;
      elements.push({ id: `memory-${index}`, label, role: el.role, polygon: el.polygon,
        confidence: el.confidence, textNorm: normalizeLabel(label) });
    }
    return { id: ulid(), ts: Date.now(), type: 'layout', fingerprint: layoutFingerprint(elements),
      screenType: entry.screenType, rotation: entry.rotation, language: entry.language, sensitivity: 'none',
      elements, source: 'memory' };
  }

  async record(layout: Layout, tokens: readonly OcrToken[], aspect: number, attestedKeyId: string): Promise<void> {
    if (layout.sensitivity !== 'none' || NEVER_REMEMBER.has(layout.screenType)) return;
    if (layout.elements.some((el) => SENSITIVE_ROLES.has(el.role))) return;
    const h = this.key(tokens);
    if (h === null) return;
    const bucket = aspectBucket(aspect);
    const install = this.hash('install', attestedKeyId);
    const existing = await this.nearest(h, bucket);
    const entry: MemoryEntry = existing ?? { formatVersion: 2, key: h.toString(16).padStart(16, '0'), aspect: bucket, bands: lshBands(h),
      screenType: layout.screenType, language: layout.language, rotation: layout.rotation, elements: [], textVotes: [],
      installs: [], seenCount: 0, trusted: false };
    if (!entry.installs.includes(install) && entry.installs.length < MAX_INSTALLS) entry.installs.push(install);
    entry.seenCount++;
    entry.trusted = entry.installs.length >= this.minInstalls;

    const elements: MemoryElement[] = [];
    for (const el of layout.elements) {
      if (el.role === 'text' && DYNAMIC.test(el.label)) continue;
      const label = stripDynamic(el.label);
      if (!label) continue;
      const textHash = this.hash('label', `${el.role}:${normalizeLabel(label)}`);
      let vote = entry.textVotes.find((v) => v.hash === textHash);
      if (!vote) { vote = { hash: textHash, installs: [] }; entry.textVotes.push(vote); }
      if (!vote.installs.includes(install) && vote.installs.length < MAX_INSTALLS) vote.installs.push(install);
      if (vote.installs.length >= this.minInstalls)
        elements.push({ labelHash: textHash, role: el.role, polygon: el.polygon, confidence: el.confidence });
    }
    entry.elements = elements;
    entry.screenType = layout.screenType;
    entry.language = ['en', 'hi', 'es'].includes(layout.language) ? layout.language : 'en';
    entry.rotation = layout.rotation;
    await this.store.upsert(entry);
  }
}
