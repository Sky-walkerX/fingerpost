import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { WaitlistEntry, WaitlistStore } from './store.ts';

/** The minimal Firestore interface required by the store. */
export interface FirestoreWaitlistDb {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data?: () => Record<string, unknown> | undefined }>;
      set(data: Record<string, unknown>): Promise<unknown>;
    };
  };
}

/**
 * Live waitlist: writes waitlist/{id} with { email (trimmed, lowercased), locale, createdAt }
 * and nothing else (design §4.9). Deduplication is keyed by the SHA-256 digest of the normalized
 * email, ensuring repeated submissions are not stored twice.
 */
export class FirestoreWaitlistStore implements WaitlistStore {
  private readonly db: FirestoreWaitlistDb;

  constructor(db: Firestore | FirestoreWaitlistDb) {
    this.db = db as FirestoreWaitlistDb;
  }

  async add(entry: WaitlistEntry): Promise<boolean> {
    const email = entry.email.trim().toLowerCase();
    const id = createHash('sha256').update(email).digest('hex');
    const ref = this.db.collection('waitlist').doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      return false;
    }
    await ref.set({
      email,
      locale: entry.locale,
      createdAt: entry.createdAt,
    });
    return true;
  }

  async store(entry: WaitlistEntry): Promise<boolean> {
    return this.add(entry);
  }

  async save(entry: WaitlistEntry): Promise<boolean> {
    return this.add(entry);
  }

  async record(entry: WaitlistEntry): Promise<boolean> {
    return this.add(entry);
  }
}

