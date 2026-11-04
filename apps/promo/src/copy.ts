/** Lines that quote the app must stay identical to Strings.kt (copy.test.ts). */
export const appQuote = {
  pressNow: 'Press now.',
  sayYesToPay: 'Say yes to pay, or no to cancel.',
  done: 'Done.',
  pinPad: "PIN pad detected. I'll stay offline while you enter it.",
} as const;

/** Guidance directions as the app composes them from its direction words. */
export const directions = ['Move right.', 'Up a little.'] as const;

export const copy = {
  problem: ['Flat glass.', 'No buttons to feel.'],
  answer: { name: 'Fingerpost.', line: 'Your phone finds the button for you.' },
  scan: 'Screen found.',
  /** The app's status label while framing (strings.xml `frame_screen`). */
  framing: 'Frame the screen',
  userSays: { payByCard: 'Pay by card', yes: 'Yes.' },
  confirmSummary: 'Pay by card, total 12.40.',
  privacy: { chip: 'PIN mode · upload off · mic off', headline: ['Your PIN', 'never leaves your phone.'] },
  close: {
    channels: ['Voice', 'Tone', 'Vibration'],
    languages: [{ text: 'English', lang: 'en' }, { text: 'हिन्दी', lang: 'hi' }, { text: 'Español', lang: 'es' }],
    tag: 'Free and open source',
    url: 'fingerpost.web.app',
  },
} as const;
