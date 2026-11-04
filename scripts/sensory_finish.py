#!/usr/bin/env python3
"""Master the 1080p Remotion picture with its latest audio export and verify media.

Usage: python3 scripts/sensory_finish.py
No model calls. Does not re-encode video or alter the project's source recordings.
"""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/promo/out/sensory'


def main() -> None:
    video = OUT / 'fingerpost-sensory-raw.mp4'
    mix = OUT / 'fingerpost-sensory-mix.wav'
    final = OUT / 'fingerpost-sensory.mp4'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(video), '-i', str(mix), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9',
                    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', '56',
                    '-movflags', '+faststart', '-metadata', 'title=Fingerpost — Hear the way',
                    '-metadata', 'comment=56-second sensory promo. Recorded phone demo; illustrated payment flow; glasses concept.',
                    str(final)], check=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(final)],
                           capture_output=True, text=True, check=True)
    data = json.loads(probe.stdout)
    picture = next(s for s in data['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in data['streams'] if s['codec_type'] == 'audio')
    if (picture['codec_name'], picture['width'], picture['height'], picture['r_frame_rate']) != ('h264', 1920, 1080, '60/1'):
        raise RuntimeError('Unexpected video export format')
    if audio['codec_name'] != 'aac' or audio['channels'] != 2:
        raise RuntimeError('Expected stereo AAC')
    if abs(float(data['format']['duration']) - 56) > 0.05:
        raise RuntimeError('Expected a 56-second export')
    summary = {'seconds': float(data['format']['duration']), 'width': picture['width'], 'height': picture['height'],
               'fps': picture['r_frame_rate'], 'video': picture['codec_name'], 'audio': audio['codec_name'],
               'channels': audio['channels'], 'bytes': int(data['format']['size'])}
    (OUT / 'export-check.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
