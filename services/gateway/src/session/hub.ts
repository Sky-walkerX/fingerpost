import { ulid } from 'ulid';
import { decodeFrame, LIMITS, parseClientMessage, PROTOCOL, type ClientMessage, type ErrorCode, type Locale, type ServerMessage } from '@fingerpost/protocol';

/** What the hub hands work to. Day 1 runs with none; Day 2 wires SessionPipeline + ASR. */
export interface HubHandlers {
  onHello?(m: Extract<ClientMessage, { type: 'hello' }>): void;
  onMessage?(m: ClientMessage, payload: Uint8Array | null): Promise<void> | void;
}

export interface HubDeps { send: (m: ServerMessage) => void; handlers?: HubHandlers; now?: () => number; }

const SPOKEN_BAD = 'Something went wrong talking to the server.';

/**
 * One WebSocket session. Validates every frame against fp.v1 and the size limits, enforces hello-first,
 * answers hello with ready, and forwards everything else to the handlers. Never throws to the socket.
 */
export class SessionHub {
  readonly id = `ses_${ulid()}`;
  private helloed = false;
  locale: Locale = 'en';
  simRunId: string | null = null;

  constructor(private readonly d: HubDeps) {}
  private now() {
    throw new Error('TODO(D1-T3): implement this; the tests describe the behaviour');
  }
  private error(code: ErrorCode, say = SPOKEN_BAD) {
    throw new Error('TODO(D1-T3): implement this; the tests describe the behaviour');
  }

  async onText(raw: string): Promise<void> {
    throw new Error('TODO(D1-T3): implement this; the tests describe the behaviour');
  }

  async onBinary(buf: Uint8Array): Promise<void> {
    throw new Error('TODO(D1-T3): implement this; the tests describe the behaviour');
  }

  private async dispatch(json: unknown, payload: Uint8Array | null): Promise<void> {
    throw new Error('TODO(D1-T3): implement this; the tests describe the behaviour');
  }
}
