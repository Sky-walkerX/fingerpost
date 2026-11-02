#!/usr/bin/env python3
"""Verify the APK signature and its sole signer's identity using existing build tools."""
import argparse
from pathlib import Path
import re
import subprocess
import sys


def verify(apksigner, apk, expected_digest):
    if not re.fullmatch(r'[0-9a-f]{64}', expected_digest):
        raise ValueError('Invalid expected signing certificate digest')
    if not Path(apk).is_file():
        raise ValueError('Release APK is missing')
    result = subprocess.run([str(apksigner), 'verify', '--verbose', '--print-certs', str(apk)],
                            capture_output=True, text=True, timeout=30, check=True)
    signers = re.findall(r'^Signer #([0-9]+) certificate SHA-256 digest: ([^\r\n]+)$',
                         result.stdout, re.MULTILINE)
    if len(signers) != 1 or signers[0] != ('1', expected_digest):
        raise ValueError('Release APK signing certificate does not match the configured keystore')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apksigner', required=True)
    parser.add_argument('--apk', required=True)
    parser.add_argument('--expected-certificate-sha256', required=True)
    args = parser.parse_args()
    try:
        verify(args.apksigner, args.apk, args.expected_certificate_sha256)
    except (ValueError, OSError, subprocess.SubprocessError):
        print('Release APK signature or certificate verification failed.', file=sys.stderr)
        return 1
    print('Release APK signature and signing certificate verified.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
