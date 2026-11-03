# Real-image PIN evaluation procedure

D3-T10/C4-4 now have an Android image runner using the production `Ocr` and `PinGate`, in addition to the synthetic DOM-token tests. The runner is in the debug instrumentation APK; it has no camera, microphone, session-client or model-adapter path. No phone run or recall result is claimed by compiling it.

Use only approved, non-sensitive, **upright** JPEG/PNG practice images. Do not use real PINs, credentials, customer screens or faces. Ground truth belongs in the ignored `evals/datasets/private/<name>/labels.json`; the existing synthetic `pinpay` corpus also works. Image filenames, labels and OCR never enter the numeric results. Do not commit the private corpus, prepared bundle or per-image results. Aggregate numeric evidence can be reviewed separately.

## Prepare locally

From the repository root, for synthetic images:

```bash
pnpm --filter @fingerpost/evals prepare-pin-images --set pinpay --origin sim --out pin-bundle
```

For permissioned real images use `--set private/<name> --origin real --out <new-bundle-name>`. This writes an exclusive directory under `evals/datasets/private/`; an existing bundle is never overwritten. Each file becomes `sample-000001.jpg` (or `.png`), and the manifest contains only anonymous IDs, SHA-256, origin, format and booleans. Origin and ground truth require human review; a `real` flag is not proof of photo provenance.

`pin_pad` means `expectedLocalBlock=true`. `payment_entry` amount summaries mean `expectedLocalBlock=false, expectedSensitive=true`: the local gate must permit the amount-confirmation turn. Label input keypads as PIN pads, not amount summaries. Other screen types are negatives for both. DOM text/boxes are not copied into OCR results.

## Bind real server evidence

Only when live API evaluation is authorized and credentials are privately configured:

```bash
mkdir -p evals/datasets/private
pnpm --filter @fingerpost/evals eval --set pinpay --mode live --out ../docs/evals/report-pinpay-server.md --numeric-out datasets/private/pinpay-server.json
pnpm --filter @fingerpost/evals prepare-pin-images --set pinpay --origin sim --out pin-live-bundle --server-results datasets/private/pinpay-server.json
```

`--mode private` produces Glimmer evidence instead. Mock output stays marked `mock` and is refused as server recall evidence. Numeric results are joined on anonymous index **and exact image hash and sensitive ground truth**. Keep the dataset order unchanged between evaluation and preparation. A limited server run leaves other samples unknown; mismatched/duplicate/unmatched evidence is rejected. Numeric output is exclusive too; choose a new file for each run. No API requests are made by preparation.

## Run later on an authorized phone

Ask the user to connect/unlock the phone before doing this. Stop Fingerpost before evaluating so the camera is inactive. These commands install debug APKs; they neither grant camera/mic permissions nor enable cloud upload:

```bash
./scripts/android.sh :app:assembleDebug :app:assembleDebugAndroidTest
adb install -r apps/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am force-stop io.github.fingerpost
adb shell mkdir -p /sdcard/Android/data/io.github.fingerpost/files/pin-eval
adb push evals/datasets/private/pin-bundle/. /sdcard/Android/data/io.github.fingerpost/files/pin-eval/
adb shell am instrument -w -e check pin-images io.github.fingerpost.test/io.github.fingerpost.DeviceSafetyRunner
adb pull /sdcard/Android/data/io.github.fingerpost/files/pin-eval/result.json evals/datasets/private/pin-result.json
```

Use the matching prepared bundle name. Do not publish device identifiers or image data from shell output. Delete that dedicated `pin-eval` folder from the phone after retrieving the result.

The runner verifies all manifest paths, hashes and sizes before OCR, rejects symlink escape and unknown manifest fields, bounds decode allocations, and scales the upright image to the production pre-upload OCR width of 1024. It measures the full-frame local gate; cropped-quad recognition is a separate device acceptance check. Initial evaluation-only limits: 1000 items, 1 MiB manifest, 8 MiB/image, 8192-pixel dimension/32-million source pixels. Each production ML Kit task completes before its bitmap is recycled; interrupted runs have no completed result. Failed decode/OCR is `null`/unmeasured, never a successful fail-closed detection. Any such sample makes instrumentation `INCOMPLETE`; invalid data returns `INVALID_DATASET`. Neither outcome emits OCR text, filenames or exception content.

`result.json` contains local/server/OR counts, false positives, misses, unknowns and separate sim/real counts. Recall is `null` until its positive denominator has no unknowns. OR is true when either measured layer detects the sample, false only when both measure false, otherwise unknown. `MEASURED` means OCR ran for every item, **not** that recall passed or that the corpus is approved. Check the ≥98%/≥150 release gate, real-photo requirement and all other release evidence separately. Missing server results cannot become a fabricated server score.
