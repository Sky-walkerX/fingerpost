#!/usr/bin/env python3
"""Validate release inputs without printing credentials."""
import ipaddress
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit


def validate(env):
    for name in ('RELEASE_KEYSTORE', 'RELEASE_STORE_PASSWORD', 'RELEASE_KEY_ALIAS', 'RELEASE_KEY_PASSWORD', 'GOOGLE_SERVICES_JSON'):
        if not env.get(name, '').strip():
            raise ValueError('Required release configuration is missing')
    tag = env.get('GITHUB_REF_NAME', '')
    if not re.fullmatch(r'v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?', tag):
        raise ValueError('Release tag must contain a version')
    code = env.get('GITHUB_RUN_NUMBER', '')
    if not re.fullmatch(r'[1-9]\d*', code) or int(code) > 2147483647:
        raise ValueError('Invalid release version code')
    url = env.get('RELEASE_GATEWAY_URL', '')
    if any(c.isspace() for c in url):
        raise ValueError('Invalid release gateway')
    parsed = urlsplit(url)
    if parsed.scheme != 'wss' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('Release gateway must be a secure base URL')
    if parsed.hostname.lower() == 'localhost' or parsed.hostname.lower().endswith('.localhost'):
        raise ValueError('Release gateway must not be loopback')
    try:
        if ipaddress.ip_address(parsed.hostname).is_loopback:
            raise ValueError('Release gateway must not be loopback')
    except ValueError as error:
        if str(error) == 'Release gateway must not be loopback': raise
    try: parsed.port
    except ValueError: raise ValueError('Invalid gateway port') from None
    return tag[1:], int(code), url


def main():
    try:
        version, code, gateway = validate(os.environ)
        output = os.environ.get('GITHUB_OUTPUT')
        if output:
            with Path(output).open('a') as stream:
                stream.write(f'version={version}\ncode={code}\ngateway={gateway}\n')
        print('Release configuration validated.')
        return 0
    except ValueError:
        print('Release preflight failed. Check tag, version, secure gateway, Firebase and signing configuration.', file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
