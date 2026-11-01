import type { Firestore } from 'firebase-admin/firestore';
import type { MemoryEntry, MemoryStore } from './store.ts';

/** kiosk_layouts/{simhash hex} with an array-contains index on `bands` (design §4.9). */
export class FirestoreMemoryStore implements MemoryStore {
  private readonly db: Firestore;
  constructor(db: Firestore) { this.db = db; }
  async get(band: string): Promise<MemoryEntry[]> {
    const snap = await this.db.collection('kiosk_layouts').where('bands', 'array-contains', band).limit(20).get();
    return snap.docs.map((d) => d.data() as MemoryEntry);
  }
  async upsert(entry: MemoryEntry): Promise<void> {
    await this.db.collection('kiosk_layouts').doc(entry.key).set(entry);
  }
}
