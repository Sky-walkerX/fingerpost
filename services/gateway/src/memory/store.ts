import type { LayoutElement, Layout } from '@fingerpost/protocol';

/** kiosk_layouts/{key} (design §4.9). Layout structure only: no images, uids, prices, names or numbers. */
export interface MemoryEntry {
  key: string;
  aspect: string;
  bands: string[];
  screenType: Layout['screenType'];
  language: string;
  rotation: Layout['rotation'];
  /** Actionable elements and text that at least two installs saw, with digits and currency removed. */
  elements: LayoutElement[];
  /** Static-text candidates seen by a single install so far: salted hashes only, never the words. */
  textVotes: { hash: string; installs: string[] }[];
  /** ≤5 salted SHA-256 hashes of attestation key ids. */
  installs: string[];
  seenCount: number;
  trusted: boolean;
}

export interface MemoryStore {
  get(band: string): Promise<MemoryEntry[]>;
  upsert(entry: MemoryEntry): Promise<void>;
}

export class InMemoryStore implements MemoryStore {
  private readonly byKey = new Map<string, MemoryEntry>();
  async get(band: string): Promise<MemoryEntry[]> {
    return [...this.byKey.values()].filter((e) => e.bands.includes(band)).map((e) => structuredClone(e));
  }
  async upsert(entry: MemoryEntry): Promise<void> { this.byKey.set(entry.key, structuredClone(entry)); }
  /** Tests and debugging only. */
  all(): MemoryEntry[] { return [...this.byKey.values()].map((e) => structuredClone(e)); }
}
