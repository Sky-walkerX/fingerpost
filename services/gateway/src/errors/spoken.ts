import type { ErrorCode } from '@fingerpost/protocol';

/** English text for each error (docs/protocol.md). Sessions in hi/es use spokenError() in src/i18n/strings.ts. */
export const SPOKEN_ERRORS: Record<ErrorCode, { say: string; retryable: boolean }> = {
  auth_expired: { say: 'Reconnecting.', retryable: true },
  quota_exhausted: { say: "You've used today's free tasks. Basic offline mode still works.", retryable: false },
  cloud_paused: { say: 'Cloud features are paused today. Basic offline mode still works.', retryable: false },
  rate_limited: { say: 'One moment.', retryable: true },
  model_unavailable: { say: "I couldn't reach the reading service. Try again in a moment.", retryable: true },
  bad_message: { say: 'Something went wrong talking to the server.', retryable: false },
  version_unsupported: { say: 'Please update Fingerpost to keep using it.', retryable: false },
};
