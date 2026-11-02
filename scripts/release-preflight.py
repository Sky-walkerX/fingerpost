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
    version = re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?', tag)
    # Android's updater parses each core component as a Kotlin Int.
    if not version or any(len(part) > 10 or int(part) > 2147483647 for part in version.groups()):
        raise ValueError('Release tag must contain a version')
    code = env.get('GITHUB_RUN_NUMBER', '')
    if not re.fullmatch(r'[1-9][0-9]*', code) or len(code) > 10 or int(code) > 2147483647:
        raise ValueError('Invalid release version code')
    url = env.get('RELEASE_GATEWAY_URL', '')
    # This value also becomes a generated Java string and a GitHub output line.
    if not re.fullmatch(r'wss://(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(?::[0-9]+)?', url):
        raise ValueError('Invalid release gateway')
    parsed = urlsplit(url)
    if parsed.scheme != 'wss' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('Release gateway must be a secure base URL')
    host = parsed.hostname.lower()
    if host == 'localhost' or host.endswith('.localhost'):
        raise ValueError('Release gateway must not be loopback')
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        labels = host.split('.')
        if (len(host) > 253 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in labels)
                or re.fullmatch(r'(?:[0-9]+|0x[0-9a-f]+)', labels[-1])):
            raise ValueError('Invalid gateway hostname') from None
    else:
        mapped = getattr(address, 'ipv4_mapped', None)
        if address.is_loopback or (mapped is not None and mapped.is_loopback):
            raise ValueError('Release gateway must not be loopback')
    try:
        port = parsed.port
    except ValueError: raise ValueError('Invalid gateway port') from None
    if parsed.netloc.endswith(':') or port == 0:
        raise ValueError('Invalid gateway port')
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
