import OpenAI from 'openai';

/** The SDK's header timeout alone does not bound a streaming response body. */
export async function modelRequest<T>(client: OpenAI, parent: AbortSignal | undefined,
  call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const deadline = new AbortController();
  const signal = parent ? AbortSignal.any([parent, deadline.signal]) : deadline.signal;
  const timer = setTimeout(() => deadline.abort(new OpenAI.APIConnectionTimeoutError()), client.timeout ?? 30_000);
  let cancel: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
  });
  try {
    signal.throwIfAborted();
    return await Promise.race([call(signal), aborted]);
  } catch (error) {
    if (deadline.signal.aborted && !parent?.aborted) throw new OpenAI.APIConnectionTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
