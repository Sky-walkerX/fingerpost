# ADR 0005: Zero retention by default, opt-in donations
- Status: accepted (2026-10-27)

## Context
Camera frames show users' surroundings and sometimes payment screens. Blind users can't easily check what the camera sees. Accuracy still has to improve over time.

## Decision
- Frames and audio are processed in memory only and never stored. Meta API Standard mode only; Contributor mode never.
- Only the rectified screen crop is uploaded after the first frame. The first full frame is face-blurred on the device.
- **PIN mode:** no uploads and no mic stream.
- **Logs and metrics:** numbers only (latencies, outcomes, modes), with a 30-day TTL.
- **Donations:** after a failed task, the app asks whether the user wants to donate the session.
  - The device blurs faces and 13–19-digit numbers before upload.
  - Uploads go to a restricted GCS bucket through a signed URL, with a 90-day lifecycle delete.
- **Kiosk memory** stores only layout structure: normalized boxes and stable labels. No images, no user IDs, no numbers or names.

## Consequences
- We can make a strong, simple privacy promise on the website and in the video.
- Debugging relies on metrics, replays (landmarks and quads, not images) and donations, so the replay tooling has to be good.
