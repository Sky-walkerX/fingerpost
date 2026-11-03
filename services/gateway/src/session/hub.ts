import { ulid } from 'ulid';
import { spokenError } from '../i18n/strings.ts';
import { satisfiesMinimum } from '../min-version/version.ts';
import { decodeFrame, LIMITS, parseClientMessage, PROTOCOL, type ClientMessage, type ErrorCode, type Locale, type ServerMessage } from '@fingerpost/protocol';

/** What the hub hands work to. Day 1 runs with none; Day 2 wires SessionPipeline + ASR. */
export interface HubHandlers {
  onHello?(m: Extract<ClientMessage, { type: 'hello' }>): void;
  onMessage?(m: ClientMessage, payload: Uint8Array | null): Promise<void> | void;
  onVersionUnsupported?(): void;
}

export interface HubDeps { send: (m: ServerMessage) => void; handlers?: HubHandlers; now?: () => number; minimumVersion?: () => Promise<string>; /** B4-3: reported in ready.flags. */ privateAvailable?: boolean; }


/**
 * One WebSocket session. Validates every frame against fp.v1 and the size limits, enforces hello-first,
 * answers hello with ready, and forwards everything else to the handlers. Never throws to the socket.
 */
export class SessionHub {
  readonly id = `ses_${ulid()}`;
  private helloed = false;
  locale: Locale = 'en';
  simRunId: string | null = null;

  private readonly d: HubDeps;

  constructor(d: HubDeps) { this.d = d; }
  private now() {
    return this.d.now?.() ?? Date.now();
  }
  private error(code: ErrorCode, say = spokenError(code, this.locale).say) {
    this.d.send({ type: 'error', id: ulid(), ts: this.now(), code, retryable: false, say });
  }

  async onText(raw: string): Promise<void> {
    if (new TextEncoder().encode(raw).length > LIMITS.textBytes) {
      this.error('bad_message');
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.error('bad_message');
      return;
    }
    await this.dispatch(json, null);
  }

  async onBinary(buf: Uint8Array): Promise<void> {
    const frame = decodeFrame(buf);
    if (!frame.ok) {
      this.error('bad_message');
      return;
    }
    await this.dispatch(frame.header, frame.payload);
  }

  private async dispatch(json: unknown, payload: Uint8Array | null): Promise<void> {
    if (typeof json === 'object' && json !== null && 'type' in json && json.type === 'hello'
        && (!('protocol' in json) || json.protocol !== PROTOCOL)) {
      this.error('version_unsupported');
      return;
    }
    const parsed = parseClientMessage(json);
    if (!parsed.ok) {
      this.error('bad_message');
      return;
    }
    const msg = parsed.msg;
    if (((msg.type === 'audio' || msg.type === 'keyframe') && payload === null)
        || (msg.type === 'keyframe' && payload !== null && payload.length > LIMITS.keyframeBytes)
        || (msg.type !== 'hello' && !this.helloed)) {
      this.error('bad_message');
      return;
    }
    try {
      if (msg.type === 'hello') {
        this.locale = msg.locale;
        if (this.d.minimumVersion && !satisfiesMinimum(msg.appVersion, await this.d.minimumVersion())) {
          this.helloed = false;
          this.d.handlers?.onVersionUnsupported?.();
          this.error('version_unsupported');
          return;
        }
        this.simRunId = msg.caps.simRunId ?? null;
        this.d.handlers?.onHello?.(msg);
        this.helloed = true;
        this.d.send({ type: 'ready', id: ulid(), ts: this.now(), sessionId: this.id,
          quota: { tasksLeft: 30 }, flags: { cloudEnabled: true, privateAvailable: this.d.privateAvailable ?? false } });
      } else {
        await this.d.handlers?.onMessage?.(msg, payload);
      }
    } catch {
      this.d.send({ type: 'error', id: ulid(), ts: this.now(), code: 'model_unavailable', retryable: true,
        say: spokenError('model_unavailable', this.locale).say });
    }
  }
}
