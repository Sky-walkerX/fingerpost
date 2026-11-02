export async function submitWaitlist(baseUrl: string, entry: { email: string; locale: string; website: string }, fetcher: typeof fetch = fetch): Promise<'joined' | 'limited' | 'failed'> {
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/v1/waitlist`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry), signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429) return 'limited';
    if (!response.ok) return 'failed';
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && 'ok' in body && body.ok === true ? 'joined' : 'failed';
  } catch { return 'failed'; }
}
