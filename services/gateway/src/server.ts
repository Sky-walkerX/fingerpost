import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadConfig } from './config.ts';
import { buildApp, type AppOverrides } from './app.ts';
import { FirestoreFlagStore, FirestoreQuotaStore } from './quota/firestore-stores.ts';
import { RevocationList } from './auth/revocation.ts';

const cfg = loadConfig(process.env);
const overrides: AppOverrides = {};
if (cfg.MODEL_MODE === 'live') {
  // Cloud Run's service account provides credentials; locally use `gcloud auth application-default login`.
  const fb = initializeApp({ credential: applicationDefault(), ...(cfg.FIREBASE_PROJECT_ID ? { projectId: cfg.FIREBASE_PROJECT_ID } : {}) });
  const db = getFirestore(fb);
  overrides.quotaStore = new FirestoreQuotaStore(db);
  overrides.flagStore = new FirestoreFlagStore(db);
  const revocation = new RevocationList();
  revocation.start(undefined, () => console.error('attestation status list refresh failed'));
  overrides.isRevoked = revocation.isRevoked;
  overrides.auth = { verifyFirebaseIdToken: async (t) => { try { return (await getAuth(fb).verifyIdToken(t)).uid; } catch { return null; } } };
}
const app = await buildApp(cfg, overrides);
await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
