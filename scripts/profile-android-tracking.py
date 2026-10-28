#!/usr/bin/env python3
"""Collect numeric, app-only Android tracking diagnostics. No frames are exported."""

import argparse
import json
import math
import os
from pathlib import Path
import re
import selectors
import shutil
import statistics
import subprocess
import sys
import time


APP = "io.github.fingerpost"
TRACKER = re.compile(
    r"delegate=(GPU|CPU) maxHands=([12]) fps=(\d+) inferenceMs=(\d+) "
    r"maxMs=(\d+) hands=(\d+) prepareMs=(\d+) submitMs=(\d+) callbackMs=(\d+)"
)
CAMERA = re.compile(
    r"windowMs=(\d+) received=(\d+) converted=(\d+) "
    r"conversionMaxMs=(\d+) rotationMaxMs=(\d+)"
)


def parse_line(line):
    """Accept only the documented numeric telemetry, never retain other logs."""
    match = TRACKER.fullmatch(line.strip())
    if match:
        fields = ("maxHands", "fps", "inferenceMs", "maxMs", "hands",
                  "prepareMs", "submitMs", "callbackMs")
        row = dict(zip(fields, map(int, match.groups()[1:])))
        if row["hands"] > row["maxHands"] or row["maxMs"] < row["inferenceMs"]:
            return None
        return {"kind": "tracker", "delegate": match.group(1), **row}
    match = CAMERA.fullmatch(line.strip())
    if match:
        fields = ("windowMs", "received", "converted", "conversionMaxMs", "rotationMaxMs")
        row = dict(zip(fields, map(int, match.groups())))
        if row["windowMs"] == 0 or row["converted"] > row["received"]:
            return None
        return {"kind": "camera", **row}
    return None


def distribution(values):
    ordered = sorted(values)
    return {
        "min": ordered[0], "median": statistics.median(ordered),
        "p95": ordered[math.ceil(0.95 * len(ordered)) - 1], "max": ordered[-1],
    }


def summarize(rows, delegate, hands):
    tracker = [row for row in rows if row["kind"] == "tracker"]
    camera = [row for row in rows if row["kind"] == "camera"]
    if not tracker:
        raise ValueError("No tracker samples after warmup; keep the screen awake and verify the debug app and camera permission")
    if any(row["delegate"] != delegate or row["maxHands"] != hands for row in tracker):
        raise ValueError("Actual tracker configuration does not match the requested configuration")
    report = {
        "actual_configuration": {"delegate": delegate, "max_hands": hands},
        "latency_sampling_note": (
            "Logged latency samples are not per-frame distributions. "
            "maxMs is the maximum within each logged rolling one-second window; "
            "p95 uses nearest rank over the retained log samples."
        ),
        "camera_sampling_note": (
            "source_fps measures analyzer-delivery FPS, not sensor FPS. "
            "CameraX frame drops and RGBA conversion occur before analyzer delivery."
        ),
        "tracker": {
            "sample_count": len(tracker),
            "fps": {"min": min(row["fps"] for row in tracker),
                    "max": max(row["fps"] for row in tracker)},
            "sampled_inference_ms": distribution([row["inferenceMs"] for row in tracker]),
            "window_inference_max_ms": max(row["maxMs"] for row in tracker),
            "sampled_prepare_ms": distribution([row["prepareMs"] for row in tracker]),
            "sampled_submit_ms": distribution([row["submitMs"] for row in tracker]),
            "sampled_callback_ms": distribution([row["callbackMs"] for row in tracker]),
            "observed_hand_counts": sorted({row["hands"] for row in tracker}),
        },
        "camera": None,
    }
    if camera:
        report["camera"] = {
            "sample_count": len(camera),
            "source_fps": distribution([1000 * row["received"] / row["windowMs"] for row in camera]),
            "converted_fps": distribution([1000 * row["converted"] / row["windowMs"] for row in camera]),
            "conversion_max_ms": max(row["conversionMaxMs"] for row in camera),
            "rotation_max_ms": max(row["rotationMaxMs"] for row in camera),
        }
    return report


def meets_budget(report):
    if report["actual_configuration"]["delegate"] != "GPU":
        raise ValueError("Budget acceptance requires the default GPU delegate")
    if report["actual_configuration"]["max_hands"] != 2:
        raise ValueError("Budget acceptance requires the default two-hand configuration")
    return (report["tracker"]["fps"]["min"] >= 25
            and report["tracker"]["window_inference_max_ms"] <= 25)


def parse_thermal_status(output):
    match = re.search(r"^\s*Thermal Status:\s*([0-6])\s*$", output, re.MULTILINE)
    return int(match.group(1)) if match else None


def parse_awake_status(output):
    match = re.search(r"^\s*mWakefulness=(Awake|Asleep)\s*$", output, re.MULTILINE)
    return match.group(1) == "Awake" if match else None


def bounded_seconds(minimum, maximum):
    def parse(value):
        try:
            number = float(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError("seconds must be numeric") from exc
        if not math.isfinite(number) or not minimum <= number <= maximum:
            raise argparse.ArgumentTypeError(f"seconds must be between {minimum} and {maximum}")
        return number
    return parse


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__, epilog=(
        "Launches a debug profiling session and leaves it foreground. Relaunch without "
        "profiling extras to restore GPU/two-hand defaults. Outputs numeric JSON only."
    ))
    parser.add_argument("--delegate", choices=("GPU", "CPU"), default="GPU")
    parser.add_argument("--hands", type=int, choices=(1, 2), default=2)
    parser.add_argument("--warmup-seconds", type=bounded_seconds(0, 60), default=5)
    parser.add_argument("--seconds", type=bounded_seconds(1, 600), default=15)
    parser.add_argument("--serial-file", type=Path, help="read the target device privately from a file; defaults to adb -d")
    parser.add_argument("--check-budget", action="store_true", help="check 25 FPS/25 ms with GPU, two hands and a complete awake measurement window")
    return parser


def find_adb():
    candidates = []
    if os.environ.get("ADB"):
        candidates.append(os.environ["ADB"])
    candidates.append(shutil.which("adb"))
    if os.environ.get("ANDROID_HOME"):
        candidates.append(str(Path(os.environ["ANDROID_HOME"]) / "platform-tools" / "adb"))
    candidates.append(str(Path.home() / "Android" / "Sdk" / "platform-tools" / "adb"))
    for candidate in candidates:
        if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise ValueError("adb not found; set ADB or ANDROID_HOME")


def adb_target(serial_file):
    if serial_file is None:
        return ["-d"]
    try:
        serial = Path(serial_file).read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError) as exc:
        raise ValueError("Could not read the private device selector file") from exc
    if not serial or any(character.isspace() or not character.isprintable() for character in serial):
        raise ValueError("Private device selector must contain one nonempty device identifier")
    return ["-s", serial]


def adb_output(adb, args, operation, timeout=10, target=None):
    try:
        result = subprocess.run([adb, *(target or ["-d"]), *args], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise ValueError(f"{operation} timed out") from exc
    if result.returncode:
        raise ValueError(f"{operation} failed (exit {result.returncode}); check the USB connection and authorization")
    return result.stdout


def thermal_status(adb, target=None):
    try:
        return parse_thermal_status(adb_output(adb, ["shell", "dumpsys", "thermalservice"], "Thermal status read", target=target))
    except ValueError:
        return None


def awake_status(adb, target=None):
    try:
        return parse_awake_status(adb_output(adb, ["shell", "dumpsys", "power"], "Screen state read", target=target))
    except ValueError:
        return None


def collect(adb, pid, warmup_seconds, seconds, target=None):
    # Explicit shell transport avoids the observed early exit of adb's logcat shortcut.
    # Disable the PTY so line framing stays independent of terminal processing.
    command = [adb, *(target or ["-d"]), "shell", "-T", "logcat", "-b", "main", "--pid=" + pid, "-v", "raw", "-T", "1", "-s",
               "FingerpostTracker:I", "FingerpostCamera:I", "*:S"]
    rows = []
    with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0) as process:
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        started = time.monotonic()
        retain_after = started + warmup_seconds
        deadline = retain_after + seconds
        pending = b""
        try:
            while time.monotonic() < deadline:
                events = selector.select(timeout=min(0.5, max(0, deadline - time.monotonic())))
                if not events:
                    if process.poll() is not None:
                        raise ValueError("App log stream ended before profiling completed")
                    continue
                chunk = os.read(process.stdout.fileno(), 4096)
                if not chunk:
                    raise ValueError("App log stream ended before profiling completed")
                pending += chunk
                lines = pending.split(b"\n")
                pending = lines.pop()
                # Bound unexpected text without preserving or printing it.
                if len(pending) > 4096:
                    pending = b""
                received = time.monotonic()
                for line in lines:
                    if retain_after <= received <= deadline:
                        row = parse_line(line.decode("ascii", errors="ignore"))
                        if row is not None:
                            rows.append(row)
        finally:
            selector.close()
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
    return rows


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.check_budget and (args.hands != 2 or args.delegate != "GPU"):
        parser.error("--check-budget requires the default GPU/two-hand configuration")
    try:
        adb = find_adb()
        target = adb_target(args.serial_file)
        awake_before = awake_status(adb, target=target)
        if awake_before is False:
            raise ValueError("Wake and unlock the selected phone before profiling")
        thermal_before = thermal_status(adb, target=target)
        adb_output(adb, ["shell", "am", "force-stop", APP], "App stop", target=target)
        launch = adb_output(adb, ["shell", "am", "start", "-W", "-n", APP + "/.MainActivity",
                                 "--es", "fp.profile.delegate", args.delegate,
                                 "--ei", "fp.profile.hands", str(args.hands)], "App launch", timeout=30, target=target)
        if not re.search(r"^Status:\s*ok\s*$", launch, re.MULTILINE):
            raise ValueError("App launch did not report success")
        pid = adb_output(adb, ["shell", "pidof", APP], "App process lookup", target=target).strip()
        if not re.fullmatch(r"[1-9]\d*", pid):
            raise ValueError("Expected one running app process")
        rows = collect(adb, pid, args.warmup_seconds, args.seconds, target=target)
        report = summarize(rows, args.delegate, args.hands)
        report["measurement"] = {"warmup_seconds": args.warmup_seconds, "seconds": args.seconds}
        report["thermal_status"] = {"before": thermal_before, "after": thermal_status(adb, target=target)}
        report["awake_before"] = awake_before
        report["awake_after"] = awake_status(adb, target=target)
        if args.check_budget:
            # At most one tracker line is emitted per second; allow one boundary window.
            minimum_windows = max(1, math.floor(args.seconds) - 1)
            if (awake_before is not True or report["awake_after"] is not True
                    or report["tracker"]["sample_count"] < minimum_windows):
                raise ValueError("Incomplete performance evidence; verify the awake state and capture the full measurement window")
        report["budget_pass"] = meets_budget(report) if args.check_budget else None
        print(json.dumps(report, indent=2, sort_keys=True))
        return 1 if report["budget_pass"] is False else 0
    except (ValueError, OSError) as exc:
        # Only our fixed errors are exposed; subprocess output may contain identifiers.
        message = str(exc) if isinstance(exc, ValueError) else "Could not execute the Android diagnostic command"
        print(json.dumps({"error": message}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
