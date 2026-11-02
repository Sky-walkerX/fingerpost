import copy
import csv
import importlib.util
import itertools
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/release-readiness.py'
REVISION = 'a' * 40
SCENES = ('adversarial', 'checkin', 'cooktop', 'fastfood', 'pinpad', 'ticket')


def matrix():
    return [dict(scene=s, locale=l, hold_mode=h, privacy=p, status='PASS',
                 operator='operator-a', revision=REVISION, issue='', notes='')
            for s, l, h, p in itertools.product(SCENES, ('en', 'hi', 'es'),
                                               ('handheld', 'chest_mount'), ('normal', 'private'))]


def evidence():
    return dict(schemaVersion=1, testedRevision=REVISION,
                pinPayment=dict(source='physical_and_live', simExamples=100, realExamples=50,
                                detected=147, localDetected=145),
                payment=dict(source='phone_matrix', trials=72, wrongTaps=0),
                singleTarget=dict(source='phone_sim', attempted=100, succeeded=90),
                timeToTargetMs=dict(source='phone_sim', values=[9000, 10000, 11000]),
                firstParseMs=dict(source='live_gateway', values=[2000, 2500, 3000]),
                soaks=[dict(device='phone-a', seconds=1800, crashFree=True, anrFree=True),
                       dict(device='phone-b', seconds=1800, crashFree=True, anrFree=True)],
                acceptance={k: 'PASS' for k in ('day6', 'fullLiveEval', 'privateMode', 'pinNoUpload',
                                               'signedRcInstall', 'landingWaitlist', 'footage')},
                openIssues=[], softExceptions={k: [] for k in ('single_target', 'time_to_target',
                                                              'first_parse', 'crash_free')})


class ReadinessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('readiness', SCRIPT)
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def assess(self, data=None, rows=None, known='', revision_ok=True):
        return self.module.assess(evidence() if data is None else data,
                                  matrix() if rows is None else rows, known, revision_ok)

    def row(self, result, key):
        return next(r for r in result['gates'] if r['id'] == key)

    def test_exact_spec_boundaries_pass(self):
        result = self.assess()
        self.assertEqual(result['status'], 'READY')
        self.assertTrue(all(r['status'] == 'PASS' for r in result['gates']))

    def test_missing_evidence_never_counts_as_a_zero_or_success(self):
        data = evidence()
        for k in ('testedRevision', 'pinPayment', 'payment', 'singleTarget', 'timeToTargetMs', 'firstParseMs'):
            data[k] = None
        data['soaks'] = []
        data['acceptance'] = {k: 'NOT_RUN' for k in data['acceptance']}
        rows = matrix()
        for row in rows: row.update(status='NOT_RUN', operator='', revision='')
        result = self.assess(data, rows, revision_ok=False)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertEqual(self.row(result, 'pin_recall')['status'], 'NOT_RUN')
        self.assertEqual(self.row(result, 'wrong_pay')['status'], 'NOT_RUN')
        self.assertEqual(self.row(result, 'single_target')['status'], 'NOT_RUN')

    def test_mock_only_or_single_layer_pin_data_cannot_authorize_release(self):
        for source in ('mock', 'sim_only', 'local_only'):
            data = evidence(); data['pinPayment']['source'] = source
            with self.subTest(source=source), self.assertRaises(ValueError): self.assess(data)
        for key in ('simExamples', 'realExamples'):
            data = evidence(); data['pinPayment'][key] = 0
            data['pinPayment'].update(detected=50, localDetected=50)
            self.assertEqual(self.assess(data)['status'], 'BLOCKED')

    def test_sensitive_minimum_and_recall_are_both_hard_gates(self):
        for change in (dict(simExamples=99, detected=147), dict(detected=146, localDetected=145)):
            data = evidence(); data['pinPayment'].update(change)
            self.assertEqual(self.row(self.assess(data), 'pin_recall')['status'], 'FAIL')

    def test_one_wrong_pay_tap_blocks_even_with_a_documented_issue(self):
        data = evidence(); data['payment']['wrongTaps'] = 1
        data['openIssues'] = [dict(id='#7', severity='P1')]
        result = self.assess(data, known='Known issue #7')
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertEqual(self.row(result, 'wrong_pay')['status'], 'FAIL')

    def test_zero_trials_and_empty_latency_samples_remain_unrun(self):
        data = evidence(); data['payment']['trials'] = 0
        data['singleTarget'].update(attempted=0, succeeded=0)
        data['timeToTargetMs']['values'] = []; data['firstParseMs']['values'] = []
        result = self.assess(data)
        for key in ('wrong_pay', 'single_target', 'time_to_target', 'first_parse'):
            self.assertEqual(self.row(result, key)['status'], 'NOT_RUN')
        self.assertEqual(result['status'], 'BLOCKED')

    def test_soft_misses_require_a_real_known_issue_reference(self):
        data = evidence(); data['singleTarget']['succeeded'] = 89
        self.assertEqual(self.assess(data)['status'], 'BLOCKED')
        data['openIssues'] = [dict(id='#12', severity='P2')]
        data['softExceptions']['single_target'] = ['#12']
        self.assertEqual(self.assess(data, known='Known #123')['status'], 'BLOCKED')
        result = self.assess(data, known='Known issue #12: measured beta limitation.')
        self.assertEqual(result['status'], 'READY_WITH_KNOWN_ISSUES')
        self.assertEqual(self.row(result, 'single_target')['status'], 'FAIL')

    def test_unknown_soft_metrics_cannot_be_waived_as_measured_misses(self):
        data = evidence(); data['firstParseMs'] = None
        data['openIssues'] = [dict(id='#12', severity='P2')]
        data['softExceptions']['first_parse'] = ['#12']
        self.assertEqual(self.assess(data, known='#12 unmeasured')['status'], 'BLOCKED')

    def test_latency_uses_median_for_guidance_and_existing_nearest_rank_for_parse(self):
        data = evidence()
        data['timeToTargetMs']['values'] = [9000, 11002]
        self.assertEqual(self.row(self.assess(data), 'time_to_target')['status'], 'FAIL')
        data['firstParseMs']['values'] = [2500, 2501]
        self.assertEqual(self.row(self.assess(data), 'first_parse')['status'], 'PASS')
        data['firstParseMs']['values'] = [2501, 2502]
        self.assertEqual(self.row(self.assess(data), 'first_parse')['status'], 'FAIL')

    def test_two_different_phones_and_full_duration_are_required(self):
        for mutate in (lambda d: d['soaks'].pop(),
                       lambda d: d['soaks'][1].update(device='phone-a'),
                       lambda d: d['soaks'][1].update(seconds=1799)):
            data = evidence(); mutate(data)
            self.assertEqual(self.row(self.assess(data), 'soak_coverage')['status'], 'FAIL')
        data = evidence(); data['soaks'][1]['anrFree'] = False
        self.assertEqual(self.row(self.assess(data), 'crash_free')['status'], 'FAIL')

    def test_p0_or_unmet_acceptance_blocks_release(self):
        data = evidence(); data['openIssues'] = [dict(id='#7', severity='P0')]
        self.assertEqual(self.assess(data, known='#7')['status'], 'BLOCKED')
        for field in evidence()['acceptance']:
            data = evidence(); data['acceptance'][field] = 'NOT_RUN'
            with self.subTest(field=field): self.assertEqual(self.assess(data)['status'], 'BLOCKED')

    def test_matrix_requires_all_72_unique_combinations_and_current_execution(self):
        for mutate in (lambda r: r.pop(), lambda r: r.append(copy.deepcopy(r[0])),
                       lambda r: r[0].update(status='NOT_RUN'),
                       lambda r: r[0].update(revision='b' * 40),
                       lambda r: r[0].update(operator='')):
            rows = matrix(); mutate(rows)
            try: result = self.assess(rows=rows)
            except ValueError: continue
            self.assertEqual(result['status'], 'BLOCKED')
        rows = matrix(); rows[0].update(status='FAIL', issue='#9')
        data = evidence(); data['openIssues'] = [dict(id='#9', severity='P2')]
        self.assertEqual(self.assess(data, rows, '#9 measured limitation')['status'], 'READY_WITH_KNOWN_ISSUES')

    def test_malformed_or_private_fields_never_reach_the_report(self):
        for change in (dict(extra='synthetic-private-token'), dict(testedRevision='--malicious'), dict(schemaVersion=2)):
            data = evidence(); data.update(change)
            with self.subTest(change=change), self.assertRaises(ValueError): self.assess(data)
        for value in (True, float('nan'), float('inf'), -1, 10**20, 10**400):
            data = evidence(); data['firstParseMs']['values'] = [value]
            with self.subTest(value=value), self.assertRaises(ValueError): self.assess(data)
        data = evidence(); data['pinPayment']['localDetected'] = 148
        with self.assertRaises(ValueError): self.assess(data)
        rows = matrix(); rows[0]['notes'] = 'synthetic-private-note'; rows[0]['operator'] = 'operator-private'
        result = self.assess(rows=rows)
        report = self.module.render_report(result, REVISION)
        self.assertNotIn('synthetic-private', report); self.assertNotIn('operator-private', report)

    def test_revision_mismatch_blocks_accepted_metrics(self):
        self.assertEqual(self.assess(revision_ok=False)['status'], 'BLOCKED')

    def test_git_binding_accepts_only_evidence_changes_after_the_tested_revision(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            def git(*args):
                return subprocess.check_output(['git', '-c', 'user.name=Synthetic', '-c',
                                                'user.email=synthetic@example.invalid', *args], cwd=repo, text=True).strip()
            git('init', '-q'); (repo / 'app.kt').write_text('synthetic')
            git('add', '.'); git('commit', '-qm', 'fixture')
            tested = git('rev-parse', 'HEAD')
            (repo / 'docs/evals').mkdir(parents=True)
            (repo / 'docs/evals/release-evidence.json').write_text('{}')
            (repo / 'README.md').write_text('Synthetic numeric eval documentation')
            git('add', '.'); git('commit', '-qm', 'evidence')
            candidate = git('rev-parse', 'HEAD')
            self.assertTrue(self.module.revision_matches(repo, tested, candidate))
            (repo / 'app.kt').write_text('changed')
            self.assertFalse(self.module.revision_matches(repo, tested, candidate))
            git('add', '.'); git('commit', '-qm', 'runtime change')
            self.assertFalse(self.module.revision_matches(repo, tested, git('rev-parse', 'HEAD')))
            self.assertFalse(self.module.revision_matches(repo, 'f' * 40, git('rev-parse', 'HEAD')))

    def test_only_rc_tags_are_draft_candidates(self):
        for tag in ('v1.0.0-rc1', 'v2.3.4-rc12'):
            self.assertTrue(self.module.is_draft_rc(tag))
        for tag in ('v1.0.0-beta', 'v1.0.0', 'v1.0.0-rc0', 'v1.0.0-rc1.extra', 'v1.0.0-rc1\nmalicious'):
            self.assertFalse(self.module.is_draft_rc(tag))

    def test_cli_fails_without_leaking_bad_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'evidence.json'; path.write_text(json.dumps(dict(token='synthetic-private-token')))
            run = subprocess.run([sys.executable, str(SCRIPT), '--evidence', str(path)], cwd=ROOT,
                                 text=True, capture_output=True, timeout=10)
            self.assertEqual(run.returncode, 1)
            self.assertNotIn('synthetic-private-token', run.stdout + run.stderr)
            self.assertIn('Invalid release evidence', run.stderr)

    def test_cli_unrun_fixture_blocks_beta_but_only_allows_a_draft_rc(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'outputs'
            data = evidence(); data['testedRevision'] = None
            data['acceptance'] = {k: 'NOT_RUN' for k in data['acceptance']}
            pending = Path(tmp) / 'pending.json'; pending.write_text(json.dumps(data))
            env = dict(os.environ, GITHUB_OUTPUT=str(output))
            for tag, status in (('v1.0.0-beta', 1), ('v1.0.0-rc1', 0)):
                run = subprocess.run([sys.executable, str(SCRIPT), '--evidence', str(pending), '--tag', tag], cwd=ROOT, env=env,
                                     text=True, capture_output=True, timeout=10)
                self.assertEqual(run.returncode, status, run.stderr)
                if status: self.assertFalse(output.exists())
                else:
                    self.assertEqual(output.read_text(), 'draft=true\n')
                    self.assertIn('public readiness remains BLOCKED', run.stdout)

    def test_cli_rejects_duplicate_json_keys_and_matrix_headers(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / 'input.json'; data.write_text('{"schemaVersion":1,"schemaVersion":1}')
            run = subprocess.run([sys.executable, str(SCRIPT), '--evidence', str(data)], cwd=ROOT,
                                 capture_output=True, text=True, timeout=10)
            self.assertEqual(run.returncode, 1); self.assertIn('Invalid release evidence', run.stderr)
            csv_path = Path(tmp) / 'matrix.csv'
            lines = (ROOT / 'docs/evals/bug-bash.csv').read_text().splitlines()
            csv_path.write_text(lines[0] + ',notes\n' + '\n'.join(line + ',' for line in lines[1:]) + '\n')
            run = subprocess.run([sys.executable, str(SCRIPT), '--bug-bash', str(csv_path)], cwd=ROOT,
                                 capture_output=True, text=True, timeout=10)
            self.assertEqual(run.returncode, 1); self.assertIn('Invalid release evidence', run.stderr)

    def test_cli_binds_completed_synthetic_records_to_an_isolated_frozen_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / 'repo'; (repo / 'scripts').mkdir(parents=True); (repo / 'docs/evals').mkdir(parents=True)
            script = repo / 'scripts/release-readiness.py'; script.write_text(SCRIPT.read_text())
            (repo / 'app.kt').write_text('synthetic source')
            (repo / 'docs/known-issues.md').write_text('No synthetic open issues.')
            def git(*args):
                return subprocess.check_output(['git', '-c', 'user.name=Synthetic', '-c',
                                                'user.email=synthetic@example.invalid', *args], cwd=repo, text=True).strip()
            git('init', '-q'); git('add', '.'); git('commit', '-qm', 'synthetic freeze')
            tested = git('rev-parse', 'HEAD')
            data = evidence(); data['testedRevision'] = tested
            (repo / 'docs/evals/release-evidence.json').write_text(json.dumps(data))
            with (repo / 'docs/evals/bug-bash.csv').open('w', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=self.module.MATRIX_KEYS); writer.writeheader()
                for row in matrix(): row['revision'] = tested; writer.writerow(row)
            git('add', '.'); git('commit', '-qm', 'synthetic observations')
            # GitHub's output file lives outside the checkout.
            output = Path(tmp) / 'outputs'; env = dict(os.environ, GITHUB_OUTPUT=str(output))
            try:
                command = [sys.executable, str(script), '--write-report', '--tag', 'v1.0.0-beta']
                run = subprocess.run(command, cwd=repo, env=env, capture_output=True, text=True, timeout=10)
                self.assertEqual(run.returncode, 0, run.stderr)
                self.assertEqual(output.read_text(), 'draft=false\n')
                report = repo / 'docs/evals/report-v1.md'
                self.assertIn('**READY**', report.read_text())
                (repo / 'app.kt').write_text('changed after synthetic freeze')
                output.unlink()
                run = subprocess.run(command, cwd=repo, env=env, capture_output=True, text=True, timeout=10)
                self.assertEqual(run.returncode, 1); self.assertFalse(output.exists())
                self.assertIn('**BLOCKED**', report.read_text())
                (repo / 'app.kt').write_text('synthetic source')
                report.unlink(); report.symlink_to(repo / 'app.kt')
                run = subprocess.run(command, cwd=repo, env=env, capture_output=True, text=True, timeout=10)
                self.assertEqual(run.returncode, 1)
                self.assertEqual((repo / 'app.kt').read_text(), 'synthetic source')
            finally: output.unlink(missing_ok=True)


class ReleaseWorkflowGateTest(unittest.TestCase):
    def test_readiness_runs_before_credentials_and_publication_and_rc_stays_draft(self):
        workflow = (ROOT / '.github/workflows/release.yml').read_text()
        self.assertIn('release-readiness.py', workflow)
        self.assertLess(workflow.index('release-readiness.py'), workflow.index('Decode release keystore'))
        self.assertIn('--draft', workflow); self.assertIn('--prerelease', workflow)
        self.assertIn('--verify-tag', workflow)
        self.assertIn('fetch-depth: 0', workflow)
        self.assertIn('steps.readiness.outputs.draft', workflow)
        self.assertIn('report-v1.md', workflow)

    def test_actual_publication_shell_keeps_rc_draft_and_fails_closed_without_a_channel(self):
        workflow = (ROOT / '.github/workflows/release.yml').read_text()
        block = workflow.split('      - name: Create GitHub Release\n', 1)[1].split('      - name:', 1)[0]
        shell = textwrap.dedent(block.split('        run: |\n', 1)[1])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); app = root / 'apps/android'; app.mkdir(parents=True)
            apk = app / 'app/build/outputs/apk/release/app-release.apk'; apk.parent.mkdir(parents=True)
            apk.write_text('synthetic APK fixture')
            (root / 'bin').mkdir(); gh = root / 'bin/gh'
            gh.write_text('#!' + sys.executable + '\nimport json,os,sys\n'
                          'open(os.environ["STUB_GH_ARGS"], "w").write(json.dumps(sys.argv[1:]))\n')
            gh.chmod(0o700); args = root / 'args.json'
            env = dict(os.environ, PATH=str(root / 'bin') + os.pathsep + os.environ['PATH'],
                       STUB_GH_ARGS=str(args), GITHUB_REF_NAME='v1.0.0-rc1')
            for channel in ('true', 'false', '', 'unexpected'):
                args.unlink(missing_ok=True)
                run = subprocess.run(['bash', '-e', '-c', shell], cwd=app, env=dict(env, RELEASE_DRAFT=channel),
                                     capture_output=True, text=True, timeout=10)
                if channel not in ('true', 'false'):
                    self.assertNotEqual(run.returncode, 0); self.assertFalse(args.exists()); continue
                self.assertEqual(run.returncode, 0, run.stderr)
                invocation = json.loads(args.read_text())
                self.assertIn('--verify-tag', invocation)
                self.assertIn('../../docs/evals/report-v1.md', invocation)
                self.assertEqual('--draft' in invocation, channel == 'true')
                self.assertEqual('--prerelease' in invocation, channel == 'true')


if __name__ == '__main__':
    unittest.main()
