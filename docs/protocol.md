# Session protocol `fp.v1`

The source of truth is `packages/protocol/src/*.ts` (zod). This doc explains the shapes and the rules that code alone doesn't show. `packages/protocol/fixtures/*.json` are golden examples. The TypeScript tests and the Kotlin tests must both parse every fixture, round-trip it, and reject every `invalid-*` fixture.

## Transport
- **Endpoint:** `wss://<gateway>/v1/session`. Headers: `Authorization: Bearer <session JWT>` and `Fp-Protocol: fp.v1`.
- **JSON text frames:** control messages. Every message has `type`, `id` (a client- or server-generated ULID) and `ts` (ms since epoch). A reply carries `re`, the `id` of the message it answers.
- **Binary frames:** `[u32 big-endian headerLen][UTF-8 JSON header][payload bytes]`. The header is a normal message: `audio` with raw PCM16LE mono 16 kHz, or `keyframe` with a JPEG.
- **Limits:**
  - text messages ≤ 16 KB;
  - keyframe payload ≤ 400 KB;
  - audio chunks 20–100 ms;
  - at most 20 messages/s per client (audio excluded).
  - Oversized text messages or keyframe payloads return `error{code:"bad_message"}` and are dropped.
  - Exceeding the message-rate limit returns `error{code:"rate_limited"}`, and the gateway closes the socket with code 1008 if it continues.
- **Keepalive:** a WebSocket ping every 15 s from the server. The client reconnects with exponential backoff (0.5 s → 8 s, with jitter) and sends `hello{resume: {sessionId, digest}}`.

## Lifecycle
```
client: hello ──► server: ready{sessionId, quota, flags}
client: audio* … audio.end            ──► server: transcript{partial}* … transcript{final}
 (or)  goal{text}                      ──► server: goal.ack
client: keyframe{kind:full}+JPEG       ──► server: layout{…} ─► target{…} | ask{…} | say{…}
client: event{targetReached}           (informational)
client: event{tapDetected|screenChanged}      (server: sim.touch, when a sim run is linked)
client: keyframe{kind:screen}+JPEG     ──► server: verify{ok|wrong|nochange}
server: (agent) next target | ask | confirm | finish{result}
client: answer{text} / confirm.reply{accepted}
client: abort                          ──► server: finish{result:"aborted"}
```

## Client → server
| type | fields | notes |
|---|---|---|
| `hello` | `appVersion`, `protocol:"fp.v1"`, `locale` (`en`\|`hi`\|`es`), `mode` (`auto`\|`guide`\|`task`\|`explore`; default `auto`, so the server infers it from the goal), `privacy` (`normal`\|`private`), `caps{simRunId?, glasses?}`, `resume?{sessionId, digest}` | first message after connecting |
| `audio` *(binary)* | `seq`, `sampleRate:16000` | PCM16LE mono |
| `audio.end` | — | stops the ASR stream; sent on PIN-mode entry too |
| `goal` | `text`, `source` (`asr_device`\|`typed`) | goal from the on-device ASR path |
| `keyframe` *(binary)* | `kind` (`full`\|`screen`), `quad?` ([4]{x,y} image px; required for `full` once known), `imageSize{w,h}`, `ocrTokens[]{text, box{u,v,w,h}}`, `purpose` (`locate`\|`verify`\|`explore`) | `full` is face-blurred on device; `screen` is the rectified screen crop |
| `event` | `kind` (`targetReached`\|`tapDetected`\|`screenChanged`\|`lost`\|`pinModeEntered`\|`pinModeExited`\|`userCancel`), `detail?` | `tapDetected.detail` = `{evidence: "sim"\|"screen_change"\|"dwell"}`; PIN events carry no detail |
| `answer` | `re`, `text` | reply to `ask` |
| `confirm.reply` | `re`, `accepted:boolean`, `utterance` | reply to `confirm` |
| `abort` | `reason?` | |

## Server → client
| type | fields | notes |
|---|---|---|
| `ready` | `sessionId`, `quota{tasksLeft}`, `flags{cloudEnabled, privateAvailable}` | |
| `transcript` | `final:boolean`, `text` | partials replace, not append |
| `goal.ack` | `goal`, `intent` (`guide`\|`task`\|`explore`) | the inferred mode when `hello.mode` is `auto` |
| `sim.touch` | `runId`, `screenId`, `x`, `y`, `u`, `v`, `elementId` (string or null) | relayed from `POST /v1/sim/events` to the session whose `caps.simRunId` matches |
| `layout` | `fingerprint`, `screenType` (`menu`\|`form`\|`confirm`\|`payment_entry`\|`pin_pad`\|`appliance`\|`info`\|`unknown`), `rotation` (0\|90\|180\|270), `language`, `sensitivity` (`none`\|`financial`\|`identity`), `screenQuad?` ([4]{x,y} image px, `full` frames only), `elements[]{id, label, labelLocal?, role (`button`\|`pay`\|`confirm`\|`submit`\|`back`\|`cancel`\|`input`\|`text`\|`icon`\|`key`), state?, polygon[]{u,v}, textNorm?, confidence}`, `source` (`memory`\|`model`) | |
| `target` | `elementId`, `polygon[]{u,v}`, `confidence`, `say` | `say` is speech in the user's locale |
| `say` | `text`, `priority` (`safety`\|`state`\|`guide`\|`info`) | |
| `ask` | `question`, `options[]` | the client speaks it, then listens |
| `confirm` | `summary`, `amount?{value, currency}` | the client must get a spoken yes |
| `expect` | `description` | what verify will look for |
| `verify` | `re`, `result` (`ok`\|`wrong`\|`nochange`), `actualElementId?`, `say` | |
| `mode` | `mode` (`normal`\|`pin`\|`private`\|`offline`), `reason` | |
| `quota` | `tasksLeft` | |
| `finish` | `result` (`done`\|`aborted`\|`failed`), `say` | |
| `error` | `code`, `retryable`, `say` | codes below |

## Error codes
| code | when | client behavior |
|---|---|---|
| `auth_expired` | JWT expired | refresh the attestation token and reconnect |
| `quota_exhausted` | user daily quota used | speak `say`, offer offline mode |
| `cloud_paused` | kill switch on | switch to offline mode |
| `rate_limited` | over message limits | back off 1 s |
| `model_unavailable` | the provider failed after fallbacks | speak; offer a retry |
| `bad_message` | schema validation failed | log locally (no content); drop |
| `version_unsupported` | protocol or app too old | speak, and open the update flow |

## Versioning
- **Additive** changes (new optional fields, new message types the client ignores) stay `fp.v1`. Clients ignore unknown `type` values and unknown fields.
- **Breaking** changes bump the version to `fp.v2`. The gateway supports both for 30 days, and Remote Config `min_supported_version` retires old clients.
