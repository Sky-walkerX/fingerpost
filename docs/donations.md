# Session donations (C5-4)

By default Fingerpost keeps nothing (ADR 0005). After a task fails, the app may ask once whether the user wants to **donate** that session to help improve it. Nothing is uploaded unless the user says yes to this exact text. The text is version `donate.v1`. If you change any wording below, bump the version in `services/gateway/src/donate/donation.ts` in the same commit; the gateway refuses an old version.

## When the app may ask
- Only after a task ended in `failed`, `wrong` (wrong control pressed) or `nochange` (press not seen).
- At most once per task, and never while PIN mode is or was active in that task. Frames captured during or after PIN mode are never included.
- Never in private mode.
- A missing or unclear answer is a no (same rule as the payment confirm).

## Consent text, `donate.v1`

### Spoken question (short; the app reads it, then listens for yes or no)
| Locale | Text |
|---|---|
| en | That didn't work. Would you like to donate this session's screen pictures to help us improve? Faces and card numbers are blurred first, and everything is deleted after 90 days. Say yes or no. |
| hi | यह काम नहीं हुआ। क्या आप सुधार में मदद के लिए इस सत्र की स्क्रीन की तस्वीरें दान करना चाहेंगे? पहले चेहरे और कार्ड नंबर धुंधले किए जाते हैं, और 90 दिन बाद सब कुछ मिटा दिया जाता है। हाँ या नहीं बोलिए। |
| es | Eso no funcionó. ¿Quieres donar las imágenes de pantalla de esta sesión para ayudarnos a mejorar? Antes se difuminan las caras y los números de tarjeta, y todo se borra a los 90 días. Di sí o no. |

### After yes / after no
| Locale | Yes | No |
|---|---|---|
| en | Thank you. Uploading now. | Okay, nothing was saved. |
| hi | धन्यवाद। अभी अपलोड हो रहा है। | ठीक है, कुछ भी सेव नहीं किया गया। |
| es | Gracias. Subiendo ahora. | De acuerdo, no se guardó nada. |

### Details (settings screen and privacy page)
**en.** If you say yes, the app uploads the screen pictures it took during that task (at most 20) and a record of finger and screen positions. It never uploads audio, what you said, your PIN, or pictures from PIN entry. Before upload, the phone blurs faces and hides any long number that could be a card number. The files go to a private storage area that only the Fingerpost team can open, and they are deleted automatically after 90 days. They are not linked to your account or your phone. They are used only to test and improve Fingerpost.

**hi.** अगर आप हाँ कहते हैं, तो ऐप उस काम के दौरान ली गई स्क्रीन की तस्वीरें (ज़्यादा से ज़्यादा 20) और उंगली व स्क्रीन की स्थिति का रिकॉर्ड अपलोड करता है। यह कभी भी आवाज़, आपकी कही बातें, आपका PIN, या PIN डालते समय की तस्वीरें अपलोड नहीं करता। अपलोड से पहले फ़ोन चेहरों को धुंधला करता है और कार्ड नंबर जैसा दिखने वाला कोई भी लंबा नंबर छिपा देता है। फ़ाइलें एक निजी स्टोरेज में जाती हैं जिसे सिर्फ़ Fingerpost टीम खोल सकती है, और 90 दिन बाद अपने-आप मिट जाती हैं। ये आपके खाते या फ़ोन से जुड़ी नहीं होतीं। इनका उपयोग सिर्फ़ Fingerpost को जाँचने और बेहतर बनाने के लिए होता है।

**es.** Si dices que sí, la app sube las imágenes de pantalla que tomó durante esa tarea (como máximo 20) y un registro de las posiciones del dedo y de la pantalla. Nunca sube audio, lo que dijiste, tu PIN ni imágenes de cuando introducías el PIN. Antes de subirlas, el teléfono difumina las caras y oculta cualquier número largo que pueda ser de una tarjeta. Los archivos van a un almacenamiento privado que solo puede abrir el equipo de Fingerpost y se borran automáticamente a los 90 días. No están vinculados a tu cuenta ni a tu teléfono. Solo se usan para probar y mejorar Fingerpost.

The Hindi and Spanish text needs a native-speaker check (A6-3 listen-through) before release.

## API: `POST /v1/donate`
Auth: `Authorization: Bearer <session JWT>` when `AUTH_REQUIRED` (live). Mock/dev accepts it without auth and signs fake `https://donations.invalid/…` URLs.

Request (strict; unknown fields → 400):
```json
{ "consent": { "version": "donate.v1", "accepted": true },
  "redacted": { "faces": true, "cardNumbers": true },
  "locale": "hi", "outcome": "wrong",
  "files": [ { "kind": "keyframe", "contentType": "image/jpeg", "bytes": 120000 },
             { "kind": "replay", "contentType": "application/json", "bytes": 4000 } ] }
```
- 1–20 keyframes (JPEG, ≤ 409,600 bytes each) and at most one replay (JSON landmarks/quads, ≤ 256 KiB). No other kinds; audio is never accepted.

Response 200:
```json
{ "donationId": "01J…", "uploadExpiresAt": 1793000000000, "deleteAfter": 1800000000000,
  "uploads": [ { "index": 0, "kind": "keyframe", "method": "PUT", "url": "https://…",
                 "headers": { "content-type": "image/jpeg", "x-goog-content-length-range": "1,120000" } } ] }
```
The phone PUTs each file to its URL with exactly those headers within 15 minutes. GCS rejects a file larger than declared.

Errors: 400 `bad_request`, 401 auth, 429 (3 per user and 10 per IP per hour), 503 `donations_unavailable` (no bucket, kill switch on, or storage error).

## What is stored
- **Bucket objects** `YYYY-MM-DD/<donationId>/<index>-<kind>.<ext>`, deleted by the bucket lifecycle at 90 days.
- **`donations/{id}`** pointer: id, created/deleteAfter times, consent version, locale, outcome and the object list (name, kind, type, size). No uid, key id, IP, labels or text. Firestore TTL on `expireAt` removes it at 90 days.
- Set up with `infra/setup-donations.sh` (human step), then set `DONATE_BUCKET` on the gateway.

## Not done yet
- **Android (lane A):** the ask/answer turn, face blur and card-number masking before upload, and the PUTs. Until then the tester protocol's "do not offer donations" rule stands.
- **Deletion on request:** pointers carry no user id, so a single user's donation can't be found later. Deletion is by the 90-day expiry.
