import { LIMITS } from '@fingerpost/protocol';
import type { DiagnosticSocket, SocketOptions } from './asr-probe.ts';

/** A bounded developer-tool exchange. Only fixed errors cross this boundary. */
export function socketExchange<T>(
  url: string, options: SocketOptions, errorText: string,
  onOpen: (socket: DiagnosticSocket) => void,
  onMessage: (data: unknown, socket: DiagnosticSocket) => T | undefined,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 60_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      reject(new Error(errorText)); return;
    }
    let socket: DiagnosticSocket;
    try { socket = options.createSocket ? options.createSocket(url) : new WebSocket(url); }
    catch { reject(new Error(errorText)); return; }
    let finished = false;
    const settle = (value?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const [type, listener] of Object.entries(listeners)) socket.removeEventListener(type, listener);
      try { socket.close(1000); } catch { /* A failed connection may already be closed. */ }
      if (value === undefined) reject(new Error(errorText)); else resolve(value);
    };
    const listeners: Record<string, (event: Event) => void> = {
      open: () => { try { onOpen(socket); } catch { settle(); } },
      message: (event) => {
        try {
          const data: unknown = 'data' in event ? event.data : undefined;
          if (typeof data !== 'string' || Buffer.byteLength(data) > LIMITS.textBytes) { settle(); return; }
          const value = onMessage(JSON.parse(data), socket);
          if (value !== undefined) settle(value);
        } catch { settle(); }
      },
      error: () => settle(), close: () => settle(),
    };
    const timer = setTimeout(() => settle(), timeoutMs);
    for (const [type, listener] of Object.entries(listeners)) socket.addEventListener(type, listener);
  });
}
