# Budget-stop job

B6-3 implements the design §4.5 Cloud Billing → Pub/Sub → Cloud Run job path. The gateway image includes `dist/budget-job.js`; override its command for a separate job. It does not start with the gateway, expose a public endpoint, create accounts, deploy resources, disable project billing or change any budget amount. It only persists `config/runtime.cloudEnabled = false` through the existing Firestore flag store.

## Configuration and behavior

The standalone `pnpm --filter @fingerpost/gateway budget:job` command is live infrastructure work, not a mock command. Do not run it without an approved project/subscription and ADC. Cloud Run supplies ADC through its service account; never distribute a service-account JSON file or Meta key to this job.

| Environment | Meaning |
|---|---|
| BUDGET_PROJECT_ID | Explicit Firestore/Pub/Sub project |
| BUDGET_SUBSCRIPTION | Full pull subscription resource in that project |
| BUDGET_BILLING_ACCOUNT_ID | Approved billing account identifier |
| BUDGET_ID | Unique ID of the approved stop-budget, not its display name |
| BUDGET_TIME_ZONE | Explicit IANA timezone matching that budget's calendar period |
| BUDGET_CURRENCY | Three-letter currency, defaults to USD; must match the notification |
| BUDGET_STOP_RATIO | Actual-spend stop ratio, greater than zero and at most 1; default 1 (100%) |

This v1 job accepts fixed-amount **monthly calendar** budgets only. Last-month-cost, custom, daily and quarterly budget periods are not supported. Select an appropriate approved stop-budget; do not silently substitute a different period or currency. Other warning budgets can continue to notify their owners but must not be mistaken for the configured stop-budget.

Each execution pulls at most ten deliveries, with a 1 MiB response limit, a 32 KiB encoded notification limit and five-second REST request deadlines. A job-level soft signal is 25 seconds; a 30-second process watchdog also bounds SDK calls and cleanup that ignore cancellation. These are initial operational limits. Run a single-task/single-parallelism job with a 60-second platform timeout and no automatic job retries; Pub/Sub retains unacknowledged messages for the next execution. The process emits only numeric received/disabled/ignored counts or a fixed content-free failure message.

Only the allowlisted account/budget/schema/currency and current calendar month can disable cloud. The notification must report actual spend and an actual threshold at or above the configured ratio; forecast-only and lower-cost messages cannot trigger it. Future, malformed, foreign and old-period notifications are ignored; unrelated payload/display text is neither stored nor logged. Durable flag failure exits unsuccessfully without acknowledging that delivery. An acknowledgement failure after the write is safe to retry: duplicate notifications can only disable again. No notification ever re-enables cloud. Re-enabling requires an operator to review spend and resolve the active stop condition.

## Operator setup — not executed locally

A human must provision/approve billing, the budget, service accounts and IAM. Restrict topic publishing to the intended Cloud Billing publisher and approved administrators. Give the dedicated job account subscriber/consume access only on the selected subscription and reviewed Firestore write permissions. Do not reuse a model/API credential or expose a push endpoint. Review Firestore Admin IAM carefully: client rules do not constrain Admin access, and a generic database role is broader than a single document.

1. Connect the approved monthly stop-budget to a Pub/Sub topic using Google's [programmatic notification setup](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications). Select the account, budget ID, currency and calendar timezone explicitly. Create a pull subscription dedicated to this consumer. Configure retention/dead-letter handling and alert on failed job executions with the infrastructure owner.
2. Build the existing gateway image including this revision. Create a separate Cloud Run job with command `node`, argument `dist/budget-job.js`, the environment above, one task/parallelism, a 60-second task timeout and zero automatic retries. Use the reviewed service account and no Meta/Modal keys. See Google's [Cloud Run job setup](https://docs.cloud.google.com/run/docs/create-jobs).
3. Have the operator schedule executions, initially once per minute, using Cloud Scheduler's authenticated Cloud Run Jobs `:run` API invocation. The scheduler identity may invoke only this reviewed job; do not grant it broad project administration. Control overlap and subscription acknowledgement deadlines. A message ack deadline longer than the 30-second process bound is appropriate for this single consumer; duplicate execution is safe but avoid unnecessary work.
4. In an isolated test project/database, publish permissioned synthetic notifications through the approved topic. Prove below-threshold/no-forecast disablement, exact threshold behavior, old-period rejection, duplicate replay, actual Firestore persistence, persistence/ack failure and eventual gateway `cloudEnabled = false` after its existing 30-second cache expires. Record real job/IAM/scheduler/notification evidence before marking B6-3 done.
5. Validate normal budget deliveries, actual period/timezone and publisher restrictions with the owner before scheduling production execution. Confirm a failed/misconfigured job is observable and that delivery/ack deadlines prevent silent loss. Nothing in local tests establishes this configuration.

Cloud Billing cost data and notifications can be delayed and are not hard billing caps. Job scheduling and the gateway's flag cache add delay. The existing in-process usage ledger/daily cap remains the primary fast application limit. Pausing app cloud features does not stop all GCP charges or disable billing.

## Verification

`budget-job.test.ts` uses synthetic Pub/Sub/flag ports and also proves the resulting flag reaches the actual gateway config route after cache expiry. `budget-pubsub.test.ts` checks authenticated fixed-resource REST requests, cancellation, response bounds and malformed data without contacting Pub/Sub. The production ADC scopes include cloud-platform in the pinned Firebase Admin implementation. Production IAM, queue delivery, scheduler execution and real Firestore are unverified.

The payload/attribute format follows Google's [notification format](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications#notification_format); transport follows [Pub/Sub pull](https://docs.cloud.google.com/pubsub/docs/reference/rest/v1/projects.subscriptions/pull). No new dependency or credential is introduced.
