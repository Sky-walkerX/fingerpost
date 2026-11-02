#!/usr/bin/env python3
"""Render local, disabled Cloud Monitoring policy drafts. No cloud SDK required."""

import argparse
from decimal import Decimal
import json
from pathlib import Path
import re
import shutil
import tempfile


PREFIX = "custom.googleapis.com/fingerpost/"


def policy(project, channel, metric, title, threshold):
    return {
        "displayName": f"Fingerpost: {title} (draft)",
        "enabled": False,
        "combiner": "OR",
        "notificationChannels": [channel],
        "documentation": {
            "mimeType": "text/markdown",
            "content": (
                "Disabled preparation only. Metric emission is not implemented. "
                "Review docs/monitoring.md before activation. Use docs/runbook.md for response; "
                "record numeric impact only. Missing telemetry is unknown, never healthy zero."
            ),
        },
        "conditions": [{
            "displayName": title,
            "conditionThreshold": {
                "filter": (f'metric.type = "{PREFIX}{metric}" AND resource.type = "global" '
                           f'AND resource.labels.project_id = "{project}"'),
                "aggregations": [{"alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_MAX"}],
                "comparison": "COMPARISON_GT",
                "thresholdValue": threshold,
                "duration": "60s",
                "trigger": {"count": 1},
                "evaluationMissingData": "EVALUATION_MISSING_DATA_NO_OP",
            },
        }],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--daily-cap-usd", required=True)
    parser.add_argument("--notification-channel", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", args.project):
        parser.error("project must be a 6–30 character Google Cloud project ID")
    if not re.fullmatch(r"(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,6})?", args.daily_cap_usd):
        parser.error("daily cap must be positive decimal USD with at most six fractional digits")
    micros = Decimal(args.daily_cap_usd) * 1_000_000
    if not 0 < micros <= 9_007_199_254_740_991:
        parser.error("daily cap must be positive and fit exact integer microdollars")
    if not re.fullmatch(r"projects/" + re.escape(args.project) + r"/notificationChannels/[0-9]+",
                        args.notification_channel):
        parser.error("notification destination must be a numeric notificationChannels resource in this project")
    output = args.output_dir.absolute()
    if any(part.is_symlink() for part in (output, *output.parents)):
        parser.error("output directory and its parents must not be symlinks")
    if output.exists() or not output.parent.is_dir():
        parser.error("output directory must be new, with an existing parent directory")

    policies = {
        "task-errors.json": policy(args.project, args.notification_channel, "task_error_ratio",
                                   "task errors above 5%", 0.05),
        "parse-latency.json": policy(args.project, args.notification_channel, "parse_p95_seconds",
                                     "parse p95 above 5 seconds", 5),
        "daily-spend.json": policy(args.project, args.notification_channel, "daily_spend_micros",
                                   "daily spend above 80% of cap", float(micros * Decimal("0.8"))),
    }
    staging = None
    try:
        staging = Path(tempfile.mkdtemp(prefix=".monitoring-", dir=output.parent))
        for filename, payload in policies.items():
            (staging / filename).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        # mkdir refuses even an empty existing destination; never replace an operator's files.
        output.mkdir()
        for path in staging.iterdir():
            path.rename(output / path.name)
    except OSError as error:
        parser.error(f"could not write policy drafts: {error.strerror}")
    finally:
        if staging is not None:
            shutil.rmtree(staging)
    print(f"Wrote 3 disabled policy drafts to {output}; telemetry and live acceptance remain blocked.")


if __name__ == "__main__":
    main()
