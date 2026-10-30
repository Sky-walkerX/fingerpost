import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { FlagStore, QuotaStore } from './ports.ts';

const SHARDS = 10;

/** users/{uid} {quotaDay, tasksToday}; spend/{day}/shards/{0..9} {micros}; design §4.9. */
export class FirestoreQuotaStore implements QuotaStore {
  private readonly db: Firestore;
  constructor(db: Firestore) { this.db = db; }

  async incrementTasks(uid: string, day: string): Promise<number> {
    const ref = this.db.collection('users').doc(uid);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data() as { quotaDay?: string; tasksToday?: number } | undefined;
      const n = d?.quotaDay === day ? (d.tasksToday ?? 0) + 1 : 1;
      tx.set(ref, { quotaDay: day, tasksToday: n }, { merge: true });
      return n;
    });
  }

  async addSpend(day: string, micros: number): Promise<number> {
    const shards = this.db.collection('spend').doc(day).collection('shards');
    await shards.doc(String(Math.floor(Math.random() * SHARDS))).set({ micros: FieldValue.increment(micros) }, { merge: true });
    const all = await shards.get();
    return all.docs.reduce((s, d) => s + ((d.get('micros') as number | undefined) ?? 0), 0);
  }
}

/** config/runtime {cloudEnabled, reason, updatedAt}. The budget-alert job writes the same document. */
export class FirestoreFlagStore implements FlagStore {
  private readonly db: Firestore;
  constructor(db: Firestore) { this.db = db; }
  async getCloudEnabled(): Promise<boolean> {
    const snap = await this.db.collection('config').doc('runtime').get();
    return (snap.get('cloudEnabled') as boolean | undefined) ?? true;
  }
  async setCloudEnabled(enabled: boolean, reason: string): Promise<void> {
    await this.db.collection('config').doc('runtime').set({ cloudEnabled: enabled, reason, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}
