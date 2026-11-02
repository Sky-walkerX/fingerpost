import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreFlagStore } from './quota/firestore-stores.ts';
import { loadBudgetConfig, runBudgetJob } from './budget/job.ts';
import { pubsubBudgetPort } from './budget/pubsub.ts';

async function main() {
  const cfg = loadBudgetConfig(process.env);
  const credential = applicationDefault();
  const app = initializeApp({ credential, projectId: cfg.projectId });
  const db = getFirestore(app);
  // Also bound hung SDK calls; the deployed Cloud Run job has its own hard execution timeout.
  const timer = setTimeout(() => { console.error('Budget job deadline exceeded'); process.exit(1); }, 30_000);
  try {
    const port = pubsubBudgetPort(cfg.subscription, async () => (await credential.getAccessToken()).access_token);
    const result = await runBudgetJob(cfg, port, new FirestoreFlagStore(db), AbortSignal.timeout(25_000));
    console.log(JSON.stringify(result));
  } finally {
    await db.terminate(); await deleteApp(app); clearTimeout(timer);
  }
}
void main().catch(() => { console.error('Budget job failed'); process.exitCode = 1; });
