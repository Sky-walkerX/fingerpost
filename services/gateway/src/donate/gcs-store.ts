import { uploadHeaders, type DonationRecord, type DonationStore, type SignedUpload } from './donation.ts';

/** The parts of a firebase-admin Storage bucket this store uses (getStorage(app).bucket(DONATE_BUCKET)). */
export interface SignableBucket {
  file(name: string): { getSignedUrl(cfg: { version: 'v4'; action: 'write'; expires: number; contentType: string;
    extensionHeaders: Record<string, string> }): Promise<[string]> };
}
/** The parts of a firebase-admin Firestore this store uses. */
export interface PointerDb {
  collection(name: string): { doc(id: string): { set(data: Record<string, unknown>): Promise<unknown> } };
}

/**
 * Live donations: V4 signed PUT URLs on the restricted bucket (lifecycle delete at 90 days) and a
 * donations/{id} pointer whose `expireAt` field drives a Firestore TTL policy (infra/setup-donations.sh).
 * The size header is signed, so GCS rejects an upload bigger than declared.
 */
export class GcsDonationStore implements DonationStore {
  private readonly bucket: SignableBucket;
  private readonly db: PointerDb;
  constructor(bucket: SignableBucket, db: PointerDb) { this.bucket = bucket; this.db = db; }

  async signUpload(objectName: string, contentType: string, maxBytes: number, expiresAtMs: number): Promise<SignedUpload> {
    const headers = uploadHeaders(contentType, maxBytes);
    const [url] = await this.bucket.file(objectName).getSignedUrl({ version: 'v4', action: 'write', expires: expiresAtMs, contentType,
      extensionHeaders: { 'x-goog-content-length-range': headers['x-goog-content-length-range'] } });
    return { url, headers };
  }

  async record(d: DonationRecord): Promise<void> {
    await this.db.collection('donations').doc(d.id).set({ ...d, expireAt: new Date(d.deleteAfter) });
  }
}
