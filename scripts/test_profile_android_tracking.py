import importlib.util
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).with_name("profile-android-tracking.py")
spec = importlib.util.spec_from_file_location("profile_android_tracking", SCRIPT)
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)


TRACKER = (
    "delegate=GPU maxHands=2 fps=10 inferenceMs=52 maxMs=81 hands=0 "
    "prepareMs=3 submitMs=1 callbackMs=2"
)
CAMERA = "windowMs=1005 received=30 converted=11 conversionMaxMs=8 rotationMaxMs=2"


class ParserTest(unittest.TestCase):
    def test_default_device_selector(self):
        self.assertEqual(profile.adb_target(None), ["-d"])

    def test_serial_file_selects_device_without_reporting_it(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "target"
            path.write_text("  synthetic.device:5555\n", encoding="utf-8")
            self.assertEqual(profile.adb_target(path), ["-s", "synthetic.device:5555"])

    def test_invalid_serial_files_have_generic_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic-sensitive-path"
            for content in [None, "", " \n", "synthetic-first\nsynthetic-second", "synthetic device"]:
                if content is not None:
                    path.write_text(content, encoding="utf-8")
                with self.subTest(content=content):
                    with self.assertRaises(ValueError) as error:
                        profile.adb_target(path)
                    self.assertNotIn("synthetic", str(error.exception))
                    self.assertNotIn(directory, str(error.exception))

    def test_selected_target_reaches_every_adb_operation_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "target"
            path.write_text("synthetic-private-device", encoding="utf-8")
            output = StringIO()
            with (mock.patch.object(profile, "find_adb", return_value="synthetic-adb"),
                  mock.patch.object(profile, "thermal_status", return_value=0) as thermal,
                  mock.patch.object(profile, "awake_status", return_value=True, create=True) as awake,
                  mock.patch.object(profile, "adb_output", side_effect=["", "Status: ok\n", "123"]) as command,
                  mock.patch.object(profile, "collect", return_value=[profile.parse_line(TRACKER)]) as collect,
                  redirect_stdout(output)):
                self.assertEqual(profile.main(["--serial-file", str(path)]), 0)
            expected = ["-s", "synthetic-private-device"]
            self.assertEqual(command.call_count, 3)
            self.assertEqual(thermal.call_count, 2)
            self.assertEqual(awake.call_count, 2)
            for call in [*command.call_args_list, *thermal.call_args_list, *awake.call_args_list, collect.call_args]:
                self.assertEqual(call.kwargs["target"], expected)
            self.assertNotIn("synthetic-private-device", output.getvalue())
            self.assertNotIn(directory, output.getvalue())

    def test_sleeping_phone_is_rejected_before_app_commands(self):
        errors = StringIO()
        with (mock.patch.object(profile, "find_adb", return_value="synthetic-adb"),
              mock.patch.object(profile, "awake_status", return_value=False, create=True),
              mock.patch.object(profile, "thermal_status", return_value=0),
              mock.patch.object(profile, "adb_output", side_effect=["", "Status: ok\n", "123"]) as command,
              mock.patch.object(profile, "collect", return_value=[profile.parse_line(TRACKER)]),
              redirect_stdout(StringIO()), redirect_stderr(errors)):
            self.assertEqual(profile.main([]), 1)
        command.assert_not_called()
        self.assertIn("Wake and unlock the selected phone before profiling", errors.getvalue())

    def test_logcat_shell_transport_reads_main_buffer_and_only_own_numeric_tags(self):
        with mock.patch.object(profile.subprocess, "Popen", side_effect=RuntimeError("synthetic stop")) as popen:
            with self.assertRaisesRegex(RuntimeError, "synthetic stop"):
                profile.collect("synthetic-adb", "123", 0, 1, target=["-s", "synthetic-private-device"])
        self.assertEqual(popen.call_args.args[0], [
            "synthetic-adb", "-s", "synthetic-private-device", "shell", "-T", "logcat", "-b", "main", "--pid=123",
            "-v", "raw", "-T", "1", "-s", "FingerpostTracker:I", "FingerpostCamera:I", "*:S",
        ])

    def test_complete_capture_retains_only_numeric_rows_and_stops_child(self):
        popen = profile.subprocess.Popen
        children = []

        def start_child(*args, **kwargs):
            child = popen([sys.executable, "-u", "-c",
                           "import time; print('synthetic private text'); "
                           f"print({TRACKER!r}); print({CAMERA!r}); time.sleep(30)"], **kwargs)
            children.append(child)
            return child

        with mock.patch.object(profile.subprocess, "Popen", side_effect=start_child):
            rows = profile.collect("synthetic-adb", "123", 0, 1)
        self.assertEqual(rows, [profile.parse_line(TRACKER), profile.parse_line(CAMERA)])
        self.assertIsNotNone(children[0].poll())

    def test_early_eof_rejects_even_valid_partial_rows(self):
        popen = profile.subprocess.Popen

        def start_child(*args, **kwargs):
            return popen([sys.executable, "-u", "-c", f"print({TRACKER!r})"], **kwargs)

        with mock.patch.object(profile.subprocess, "Popen", side_effect=start_child):
            with self.assertRaisesRegex(ValueError, "App log stream ended before profiling completed"):
                profile.collect("synthetic-adb", "123", 0, 2)

    def test_tracker_numeric_fields(self):
        row = profile.parse_line(TRACKER)
        self.assertEqual(row["kind"], "tracker")
        self.assertEqual(row["delegate"], "GPU")
        self.assertEqual(row["maxHands"], 2)
        self.assertEqual(row["inferenceMs"], 52)

    def test_camera_source_fps_uses_actual_window(self):
        summary = profile.summarize(
            [profile.parse_line(TRACKER), profile.parse_line(CAMERA)], "GPU", 2
        )
        self.assertAlmostEqual(summary["camera"]["source_fps"]["median"], 30000 / 1005)
        self.assertEqual(summary["camera"]["conversion_max_ms"], 8)
        self.assertIn("analyzer-delivery", summary["camera_sampling_note"])
        self.assertIn("not sensor", summary["camera_sampling_note"])

    def test_cpu_single_hand_configuration_is_reported(self):
        line = TRACKER.replace("delegate=GPU", "delegate=CPU").replace("maxHands=2", "maxHands=1")
        summary = profile.summarize([profile.parse_line(line)], "CPU", 1)
        self.assertEqual(summary["actual_configuration"], {"delegate": "CPU", "max_hands": 1})

    def test_unrelated_or_malformed_lines_are_ignored(self):
        for line in [
            "private text",
            "I/FingerpostTracker: " + TRACKER,
            TRACKER + " extra=value",
            TRACKER.replace("fps=10", "fps=-1"),
            TRACKER.replace("inferenceMs=52", "inferenceMs=NaN"),
            TRACKER.replace("maxMs=81", "maxMs=51"),
            TRACKER.replace("hands=0", "hands=3"),
            CAMERA.replace("windowMs=1005", "windowMs=0"),
            CAMERA.replace("converted=11", "converted=31"),
        ]:
            with self.subTest(line=line):
                self.assertIsNone(profile.parse_line(line))

    def test_no_tracker_samples_fails(self):
        with self.assertRaisesRegex(ValueError, "No tracker samples"):
            profile.summarize([profile.parse_line(CAMERA)], "GPU", 2)

    def test_actual_configuration_must_match_request(self):
        for delegate, hands in [("CPU", 2), ("GPU", 1)]:
            with self.subTest(delegate=delegate, hands=hands):
                with self.assertRaisesRegex(ValueError, "configuration"):
                    profile.summarize([profile.parse_line(TRACKER)], delegate, hands)

    def test_configuration_change_mid_sample_also_fails(self):
        rows = [profile.parse_line(TRACKER), profile.parse_line(TRACKER.replace("delegate=GPU", "delegate=CPU"))]
        with self.assertRaisesRegex(ValueError, "configuration"):
            profile.summarize(rows, "GPU", 2)

    def test_summary_separates_samples_from_window_maxima(self):
        rows = [profile.parse_line(TRACKER)]
        rows += [profile.parse_line(TRACKER.replace("inferenceMs=52", "inferenceMs=20")
                                   .replace("maxMs=81", "maxMs=42")
                                   .replace("fps=10", "fps=15")
                                   .replace("hands=0", "hands=1"))]
        summary = profile.summarize(rows, "GPU", 2)
        self.assertEqual(summary["tracker"]["sampled_inference_ms"],
                         {"min": 20, "median": 36.0, "p95": 52, "max": 52})
        self.assertEqual(summary["tracker"]["window_inference_max_ms"], 81)
        self.assertEqual(summary["tracker"]["fps"], {"min": 10, "max": 15})
        self.assertEqual(summary["tracker"]["observed_hand_counts"], [0, 1])
        self.assertIsNone(summary["camera"])
        self.assertIn("not per-frame", summary["latency_sampling_note"])

    def test_budget_checks_window_maximum_and_default_hand_count(self):
        good = (TRACKER.replace("fps=10", "fps=25").replace("maxMs=81", "maxMs=25")
                .replace("inferenceMs=52", "inferenceMs=25"))
        summary = profile.summarize([profile.parse_line(good)], "GPU", 2)
        self.assertTrue(profile.meets_budget(summary))
        summary = profile.summarize([profile.parse_line(good.replace("maxMs=25", "maxMs=26"))], "GPU", 2)
        self.assertFalse(profile.meets_budget(summary))
        summary = profile.summarize([profile.parse_line(good.replace("maxHands=2", "maxHands=1"))], "GPU", 1)
        with self.assertRaisesRegex(ValueError, "two-hand"):
            profile.meets_budget(summary)

    def test_cpu_diagnostic_cannot_pass_gpu_acceptance(self):
        line = (TRACKER.replace("delegate=GPU", "delegate=CPU").replace("fps=10", "fps=30")
                .replace("inferenceMs=52", "inferenceMs=20").replace("maxMs=81", "maxMs=22"))
        summary = profile.summarize([profile.parse_line(line)], "CPU", 2)
        with self.assertRaisesRegex(ValueError, "GPU"):
            profile.meets_budget(summary)

    def test_budget_cli_rejects_cpu_before_device_operations(self):
        with (mock.patch.object(profile, "find_adb") as find,
              redirect_stderr(StringIO()), self.assertRaises(SystemExit)):
            profile.main(["--delegate", "CPU", "--check-budget"])
        find.assert_not_called()

    def test_budget_requires_awake_evidence_and_enough_measurement_windows(self):
        good = (TRACKER.replace("fps=10", "fps=30").replace("inferenceMs=52", "inferenceMs=20")
                .replace("maxMs=81", "maxMs=22"))
        row = profile.parse_line(good)
        for awake, count in [([True, False], 14), ([None, True], 14), ([True, None], 14), ([True, True], 1)]:
            with self.subTest(awake=awake, count=count):
                errors, output = StringIO(), StringIO()
                with (mock.patch.object(profile, "find_adb", return_value="synthetic-adb"),
                      mock.patch.object(profile, "thermal_status", return_value=0),
                      mock.patch.object(profile, "awake_status", side_effect=awake),
                      mock.patch.object(profile, "adb_output", side_effect=["", "Status: ok\n", "123"]),
                      mock.patch.object(profile, "collect", return_value=[row] * count),
                      redirect_stdout(output), redirect_stderr(errors)):
                    self.assertEqual(profile.main(["--check-budget"]), 1)
                self.assertEqual(output.getvalue(), "")
                self.assertIn("Incomplete performance evidence", errors.getvalue())

    def test_complete_default_gpu_evidence_can_pass_without_changing_thresholds(self):
        good = (TRACKER.replace("fps=10", "fps=25").replace("inferenceMs=52", "inferenceMs=25")
                .replace("maxMs=81", "maxMs=25"))
        output = StringIO()
        with (mock.patch.object(profile, "find_adb", return_value="synthetic-adb"),
              mock.patch.object(profile, "thermal_status", return_value=0),
              mock.patch.object(profile, "awake_status", return_value=True),
              mock.patch.object(profile, "adb_output", side_effect=["", "Status: ok\n", "123"]),
              mock.patch.object(profile, "collect", return_value=[profile.parse_line(good)] * 14),
              redirect_stdout(output)):
            self.assertEqual(profile.main(["--check-budget"]), 0)
        self.assertIn('"budget_pass": true', output.getvalue())

    def test_thermal_parser_exposes_only_numeric_status(self):
        self.assertEqual(profile.parse_thermal_status("Other private data\nThermal Status: 1\nMore data"), 1)
        self.assertIsNone(profile.parse_thermal_status("not available"))
        self.assertIsNone(profile.parse_thermal_status("Thermal Status: -1"))

    def test_awake_parser_preserves_unknown_state(self):
        self.assertTrue(profile.parse_awake_status("Private power data\n  mWakefulness=Awake\nMore data"))
        self.assertFalse(profile.parse_awake_status("mWakefulness=Asleep"))
        self.assertIsNone(profile.parse_awake_status("Unavailable"))

    def test_duration_validation_is_bounded(self):
        self.assertEqual(profile.build_parser().parse_args([]).seconds, 15)
        for args in [["--seconds", "0"], ["--seconds", "601"], ["--warmup-seconds", "-1"]]:
            with self.subTest(args=args), redirect_stderr(StringIO()), self.assertRaises(SystemExit):
                profile.build_parser().parse_args(args)


if __name__ == "__main__":
    unittest.main()
