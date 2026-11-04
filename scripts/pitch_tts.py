#!/usr/bin/env python3
"""Pitch voiceover: one WAV per narration segment from Vertex AI Gemini TTS, plus measured durations.

Usage: python3 scripts/pitch_tts.py <project> [segment-id ...]
Auth comes from `gcloud auth application-default`; no key is stored. This is a paid call.
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request
import wave

ROOT = os.path.join(os.path.dirname(__file__), '..', 'apps', 'promo')
NARRATION = os.path.join(ROOT, 'src', 'pitch', 'narration.json')
OUT_DIR = os.path.join(ROOT, 'public', 'vo')
DURATIONS = os.path.join(ROOT, 'src', 'pitch', 'vo-durations.json')
MODEL = 'gemini-3.8-flash-tts'


def token() -> str:
    return subprocess.run(['gcloud', 'auth', 'application-default', 'print-access-token'], check=True, capture_output=True, text=True).stdout.strip()


def synthesize(project: str, style: str, voice: str, text: str) -> tuple[bytes, str]:
    url = f'https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/google/models/{MODEL}:generateContent'
    body = {
        'contents': [{'role': 'user', 'parts': [{'text': f'{style} {text}' if style else text}]}],
        'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}},
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json', 'x-goog-user-project': project})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    part = data['candidates'][0]['content']['parts'][0]['inlineData']
    return base64.b64decode(part['data']), part.get('mimeType', '')


def main(argv: list[str]) -> None:
    project, only = argv[0], set(argv[1:])
    spec = json.load(open(NARRATION))
    os.makedirs(OUT_DIR, exist_ok=True)
    durations = json.load(open(DURATIONS)) if os.path.exists(DURATIONS) else {}
    for seg in spec['segments']:
        if only and seg['id'] not in only:
            continue
        audio, mime = synthesize(project, spec['style'], spec['voice'], seg['text'])
        path = os.path.join(OUT_DIR, f"{seg['id']}.wav")
        if audio[:4] == b'RIFF':
            with open(path, 'wb') as f:
                f.write(audio)
        else:  # raw 16-bit PCM, e.g. audio/L16;rate=24000
            rate = int(mime.split('rate=')[-1].split(';')[0]) if 'rate=' in mime else 24000
            with wave.open(path, 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(audio)
        with wave.open(path) as w:
            durations[seg['id']] = round(w.getnframes() / w.getframerate(), 3)
        print(f"{seg['id']}: {durations[seg['id']]} s")
    with open(DURATIONS, 'w') as f:
        json.dump(durations, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main(sys.argv[1:])
