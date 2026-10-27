export type ElementRole = 'button' | 'pay' | 'confirm' | 'submit' | 'back' | 'cancel' | 'input' | 'text' | 'icon' | 'key';
export interface Rect { x: number; y: number; w: number; h: number; }
export interface SimElement { id: string; label: string; role: ElementRole; rect: Rect; }
export interface SimScreen { id: string; title: string; elements: SimElement[]; next: Record<string, string>; }
export interface SimScene { id: string; seed: number; screens: SimScreen[]; start: string; }
/** Every scene is laid out on this logical canvas; main.ts scales it to the device. */
export const CANVAS = { w: 1280, h: 800 } as const;
export interface TouchEvent { runId: string; screenId: string; x: number; y: number; u: number; v: number; elementId: string | null; pointerId: number; ts: number; }
export interface RunState { runId: string; scene: SimScene; screenId: string; events: TouchEvent[]; }
export interface Label { id: string; label: string; role: ElementRole; u: number; v: number; w: number; h: number; }
