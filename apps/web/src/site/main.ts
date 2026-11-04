import { startLanding } from './landing.ts';
import { submitWaitlist } from './waitlist.ts';

startLanding();

const form = document.querySelector<HTMLFormElement>('#waitlist')!;
const status = document.querySelector<HTMLElement>('#waitlist-preview')!;
const button = form.querySelector<HTMLButtonElement>('button')!;
const endpoint = import.meta.env.VITE_GATEWAY_URL as string | undefined;
if (endpoint && /^https:\/\//.test(endpoint)) {
  for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button')) control.disabled = false;
  status.textContent = 'Register for beta updates. Your email and language preference are sent to our gateway.';
  button.textContent = 'Join the waitlist';
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    submitting = true; button.disabled = true;
    status.textContent = 'Submitting…';
    const data = new FormData(form);
    const result = await submitWaitlist(endpoint, { email: String(data.get('email') ?? ''), locale: String(data.get('locale') ?? 'en'), website: String(data.get('website') ?? '') });
    status.textContent = result === 'joined' ? 'You are on the waitlist.' : result === 'limited' ? 'Too many attempts. Try again in a minute.' : 'Registration did not complete. Please try again.';
    submitting = false; button.disabled = false;
    if (result === 'joined') form.reset();
  });
}
