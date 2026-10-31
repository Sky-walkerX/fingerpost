#!/usr/bin/env python3
"""Prepare the optional CI Firebase file without printing or overwriting private configuration."""
from pathlib import Path
import base64
import binascii
import json
import os
import sys


def prepare_config(encoded: str | None, destination: Path) -> bool:
    if not encoded:
        return False
    try:
        raw = base64.b64decode("".join(encoded.split()), validate=True)
        document = json.loads(raw)
        clients = document.get("client", []) if isinstance(document, dict) else []
        packages = [client.get("client_info", {}).get("android_client_info", {}).get("package_name") for client in clients]
        if "io.github.fingerpost" not in packages:
            raise ValueError("wrong package")
    except (ValueError, TypeError, AttributeError, binascii.Error):
        raise ValueError("Invalid Firebase configuration") from None
    try:
        with destination.open("xb") as output:
            os.fchmod(output.fileno(), 0o600)
            output.write(raw)
    except FileExistsError:
        raise ValueError("Firebase configuration already exists; refusing to overwrite it") from None
    return True


def main() -> int:
    destination = Path(__file__).resolve().parents[1] / "apps/android/app/google-services.json"
    try:
        prepared = prepare_config(os.environ.get("GOOGLE_SERVICES_JSON"), destination)
        print("Firebase build configuration prepared." if prepared else "No Firebase CI secret; building without Firebase configuration.")
        return 0
    except (OSError, ValueError):
        print("Could not prepare Firebase configuration. Check the CI secret and existing local file.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
