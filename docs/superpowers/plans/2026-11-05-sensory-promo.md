# Sensory promo — 2026-11-05

User-authorized replacement direction: 50–60 seconds, cinematic motion, real recorded demo, audible app cues, ducked music, hard PIN privacy cut and a future glasses tease. The original Promo and Pitch remain available. New composition: `SensoryPromo`, 56 seconds, 1920×1080, 60 fps.

Owner: Codex. This is media production, not device or release acceptance. The user explicitly authorizes GCP Gemini 3.8 TTS synthesis. No new dependency or model deployment.

- [x] Add failing-first story/audio checks: duration, payment confirmation before guidance, 70% music duck, no overlapping speech, caption coverage, PIN silence for guidance, honest recorded/illustrated/future labels.
- [x] Generate original narration and app cues with the existing Vertex TTS authentication; synthesize sound design locally using the guidance spec's frequency mapping and double-click timing.
- [x] Build nine scenes: tension 0–4, reveal 4–8, recorded proof 8–14, confirmation 14–20, guidance 20–29, PIN 29–35.5, sensory modes 35.5–41.5, glasses 41.5–50.5, close 50.5–56.
- [x] Inspect representative frames across the motion render and full-resolution stills; fix the proof shot's crop and preserve the actual camera status/target/finger overlays.
- [x] Run promo tests and recursive typecheck; render and verify H.264/AAC, duration, dimensions, frame rate, audio loudness/peaks and caption sidecars.
- [x] Record actual checks and deliver the final MP4 locally. Keep real footage and generated media excluded from commits.

Creative constraints: real Juniper Grill footage is labeled recorded; the pay flow is labeled illustrated; glasses are labeled Next/concept. Payment must read the amount and accept yes before guidance. Never display an entered PIN. All spoken content is captioned; key visuals are also narrated. Music drops to at most 30% of its opening level during 14–28 seconds, with a harder silence at PIN entry. No rapid flashing.

Verified export: 56.000 s, 1920×1080, 60 fps, H.264/yuv420p, stereo AAC/48 kHz, 11,571,540 bytes; whole-file decode passes. Final measured loudness −15.88 LUFS integrated, −1.48 dBTP, LRA 4.9 LU. Music duck strengthened to 75% against the immediately preceding bed. Promo tests 20/20; seven existing Python promo tests and four new sound/TTS tests pass; recursive typecheck and whitespace checks pass. All 14 measured voices fit their slots. Captions include the sound cues in SRT/VTT and the text transcript. Final MP4 and sidecars copied to Downloads; source/destination SHA-256 match.

Production notes: the first TTS request read the prefixed direction and was rejected by the slot check. The new adapter uses Gemini 3.8's documented `speechMetadata` and verbatim text fields; the original pitch adapter is unchanged. Fourteen replacement takes succeed (15 total paid requests). An audio-only export required excluding video CRF/pixel settings from WAV renders. No dependencies, guidance/runtime behavior, public hosting or device acceptance changed.
