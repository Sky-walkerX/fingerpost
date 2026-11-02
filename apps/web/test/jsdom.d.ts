// jsdom ships no types and @types/jsdom isn't a planned dependency: just the surface the a11y test uses.
declare module 'jsdom' {
  export interface ConstructorOptions { runScripts?: 'outside-only' | 'dangerously'; pretendToBeVisual?: boolean; url?: string }
  export class JSDOM {
    constructor(html?: string, options?: ConstructorOptions);
    readonly window: Window & typeof globalThis & { eval(source: string): unknown };
  }
}
