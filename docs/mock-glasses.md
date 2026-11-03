# Debug mock-glasses frame source

A5-4 now has `FrameSource`, `PhoneCameraSource` and `MockGlassesSource`. The normal app keeps the CameraX path. The mock source reads a local simulator MP4, draws its frames into the preview and delivers the same `AnalysisFrame` objects to the production tracker/OCR/PIN pipeline. It does not decode audio or bypass upload protection. No DAT SDK or actual glasses integration is claimed.

Selection requires a **debug build** and the explicit `fingerpost.mockGlasses` intent flag. The only input is the fixed app-private `files/mock-glasses.mp4`; activity extras cannot select arbitrary phone files or URLs. Release builds ignore the flag and retain the normal camera permission flow. Replay is labeled in the visible/TalkBack session status and does not need camera permission.

After arranging an authorized phone connection, stage only an approved, upright simulator MP4. The ignored existing synthetic `video/out/sim-demo/simulator-fastfood.mp4` is suitable if available:

```bash
adb push video/out/sim-demo/simulator-fastfood.mp4 /data/local/tmp/fingerpost-sim.mp4
adb shell run-as io.github.fingerpost mkdir -p files
adb shell run-as io.github.fingerpost cp /data/local/tmp/fingerpost-sim.mp4 files/mock-glasses.mp4
adb shell rm /data/local/tmp/fingerpost-sim.mp4
adb shell am start -S -n io.github.fingerpost/.MainActivity --ez fingerpost.mockGlasses true
```

To restore the real phone source:

```bash
adb shell am start -S -n io.github.fingerpost/.MainActivity --ez fingerpost.mockGlasses false
```

Only the source is replaced: the existing gateway configuration still determines mock/live model use. Start with the mock gateway; fixed mock targets do not demonstrate recognition of a video or a real appliance. Do not substitute replay for real-phone guidance acceptance.

Lifecycle stop cancels decoding and drains the worker before vision closes. The pure timeline loops media positions while keeping inference timestamps monotonic, and drops missed frames instead of queuing a backlog. Initial operational bounds: media duration up to 24 hours, metadata frame rate 1–60 FPS with 30 FPS fallback, decoded dimensions fitted within 1280×1280. These are replay bounds, not measured tracking performance.

Four failing-first timeline tests, native compilation/debug/test APKs and lint pass. Physical MP4 decoding/preview alignment, pause/resume, corrupt/missing clip and release-flag rejection remain acceptance checks; no phone was used for this implementation.
