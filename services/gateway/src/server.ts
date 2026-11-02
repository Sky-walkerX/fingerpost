import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getRemoteConfig } from 'firebase-admin/remote-config';
import { loadConfig } from './config.ts';
import { buildApp, type AppOverrides } from './app.ts';
import { FirestoreFlagStore, FirestoreQuotaStore } from './quota/firestore-stores.ts';
import { FirestoreMemoryStore } from './memory/firestore-store.ts';
import { RevocationList } from './auth/revocation.ts';
import { GcsDonationStore } from './donate/gcs-store.ts';
import { FirestoreWaitlistStore } from './waitlist/firestore-store.ts';
import { RemoteConfigMinVersionSource } from './min-version/remote-config-source.ts';

const cfg = loadConfig(process.env);
const overrides: AppOverrides = {};
if (cfg.MODEL_MODE === 'live') {
  // Cloud Run's service account provides credentials; locally use `gcloud auth application-default login`.
  const fb = initializeApp({ credential: applicationDefault(), ...(cfg.FIREBASE_PROJECT_ID ? { projectId: cfg.FIREBASE_PROJECT_ID } : {}) });
  const db = getFirestore(fb);
  overrides.quotaStore = new FirestoreQuotaStore(db);
  overrides.flagStore = new FirestoreFlagStore(db);
  overrides.memoryStore = new FirestoreMemoryStore(db);
  overrides.waitlistStore = new FirestoreWaitlistStore(db);
  overrides.minVersionSource = new RemoteConfigMinVersionSource(getRemoteConfig(fb));
  if (cfg.DONATE_BUCKET) overrides.donations = new GcsDonationStore(getStorage(fb).bucket(cfg.DONATE_BUCKET), db);
  const revocation = new RevocationList();
  revocation.start(undefined, () => console.error('attestation status list refresh failed'));
  overrides.isRevoked = revocation.isRevoked;
  overrides.auth = { verifyFirebaseIdToken: async (t) => { try { return (await getAuth(fb).verifyIdToken(t)).uid; } catch { return null; } } };
}
const app = await buildApp(cfg, overrides);
await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
