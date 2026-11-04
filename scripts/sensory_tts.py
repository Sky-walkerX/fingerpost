#!/usr/bin/env python3
"""User-authorized Vertex TTS for the sensory promo, reusing the pitch adapter.

Usage: python3 scripts/sensory_tts.py <gcp-project> [segment-id ...]
Generated media is local and ignored. Timed copy is synthetic production copy.
"""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request
import wave

from pitch_tts import MODEL, token

ROOT = Path(__file__).resolve().parents[1]
PROMO = ROOT / 'apps/promo'


def synthesize(project: str, style: str, voice: str, text: str) -> tuple[bytes, str]:
    # 3.8 separates direction from the verbatim transcript; prepending direction speaks it.
    # https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview
    url = f'https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/google/models/{MODEL}:generateContent'
    body = {
        'contents': [{'role': 'user', 'parts': [{'text': text, 'speechMetadata': {'style': style}}]}],
        'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'voice': voice}}},
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={
        'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json', 'x-goog-user-project': project,
    })
    with urllib.request.urlopen(req, timeout=120) as response:
        data = json.load(response)
    part = data['candidates'][0]['content']['parts'][0]['inlineData']
    return base64.b64decode(part['data']), part.get('mimeType', '')


def main(project: str, only: list[str]) -> None:
    spec = json.loads((PROMO / 'src/sensory/narration.json').read_text())
    out = PROMO / 'public/sensory/vo'
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = PROMO / 'src/sensory/voice-durations.json'
    durations = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for seg in spec['segments']:
        if only and seg['id'] not in only:
            continue
        dst = out / f"{seg['id']}.wav"
        if dst.exists() and seg['id'] in durations:
            print(f"{seg['id']}: retained {durations[seg['id']]} s", flush=True)
            continue
        audio, mime = synthesize(project, seg['style'], seg['voice'], seg['text'])
        with tempfile.TemporaryDirectory(prefix='fingerpost-tts-') as tmp:
            raw = Path(tmp) / 'raw.wav'
            if audio[:4] == b'RIFF':
                raw.write_bytes(audio)
            else:
                rate = int(mime.split('rate=')[-1].split(';')[0]) if 'rate=' in mime else 24000
                with wave.open(str(raw), 'wb') as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(rate)
                    w.writeframes(audio)
            trimmed = Path(tmp) / 'trimmed.wav'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw),
                            '-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_duration=0.08:start_threshold=-48dB,areverse,apad=pad_dur=0.08',
                            '-ar', '48000', '-ac', '1', str(trimmed)], check=True)
            with wave.open(str(trimmed)) as w:
                length = w.getnframes() / w.getframerate()
            # Keep exact words inside fixed editorial slots, without truncating a sentence.
            target = seg['maxDuration'] - 0.06
            speed = max(1.0, length / target)
            if speed > 1.45:
                raise RuntimeError(f"{seg['id']}: {length:.2f}s needs {speed:.2f}x; regenerate a faster take")
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(trimmed),
                            '-af', f'atempo={speed:.6f},loudnorm=I=-17:TP=-3:LRA=7,afade=t=in:d=0.008',
                            '-ar', '48000', '-ac', '1', str(dst)], check=True)
            with wave.open(str(dst)) as w:
                durations[seg['id']] = round(w.getnframes() / w.getframerate(), 4)
            manifest_path.write_text(json.dumps(durations, indent=2) + '\n')
            print(f"{seg['id']}: {durations[seg['id']]} s ({speed:.3f}x)", flush=True)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
