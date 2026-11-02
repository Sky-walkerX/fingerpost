# Local PIN gate recall on sim items (C4-4, mock-first)

**Date:** 2026-11-02 · **What:** the on-device pre-upload gate (guidance-spec §10.1, `PinGate.check`) on the 170 synthetic `pinpay` sim items, exported as OCR-like tokens (`pnpm --filter @fingerpost/evals export-pin-tokens` → `evals/out/pinpay-tokens.json`). **Test:** `./scripts/android.sh :core:guidance:test --tests '*PinGateDatasetTest*'`.

These are simulator DOM labels, not camera OCR. The release gate (≥ 98% on ≥ 150 examples, design §5.6) still needs the live server layer and real photos (C4-4 live step).

| Check | Result |
|---|---|
| PIN pads blocked (120: phone, calculator, scrambled × 40) | 120/120 (100%) |
| PIN pads blocked with all text removed (digit grid only) | 120/120 (100%) |
| PIN pads blocked under OCR noise (one digit missed, boxes jittered by 15% of a key, one row merged) | 120/120 (100%) |
| Same noise and no text (digit grid only) | 120/120 (100%) — **0/120 before the fix below** |
| Amount summaries with a Pay button wrongly blocked (50; must stay online for the confirm) | 0/50 |

## Fix found by this test
The digit-grid rule compared horizontal distances (normalized to screen width) with a tolerance built from key height (normalized to screen height). On a 16:10 screen the column tolerance was about 60% too wide, so a keypad whose columns are closer than about 1.1 key heights read as one column and was **not** blocked. The sim pads passed only because their columns sit 0.136 apart against a 0.135 tolerance, and only the "Enter PIN" wording caught them under noise. `PinGate.check` now takes the token space's pixel aspect, and the phone passes the camera frame's or the rectified screen's aspect. Square spaces behave as before.
