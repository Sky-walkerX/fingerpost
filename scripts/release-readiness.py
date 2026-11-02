#!/usr/bin/env python3
"""Check numeric Day 7 evidence. Never performs a trial, deployment, tag or release."""
import argparse
import csv
import io
import itertools
import json
import math
import os
from pathlib import Path
import re
import statistics
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SCENES = ('adversarial', 'checkin', 'cooktop', 'fastfood', 'pinpad', 'ticket')
MATRIX_KEYS = ('scene', 'locale', 'hold_mode', 'privacy', 'status', 'operator', 'revision', 'issue', 'notes')
COMBINATIONS = set(itertools.product(SCENES, ('en', 'hi', 'es'),
                                     ('handheld', 'chest_mount'), ('normal', 'private')))
ACCEPTANCE = ('day6', 'fullLiveEval', 'privateMode', 'pinNoUpload', 'signedRcInstall', 'landingWaitlist', 'footage')
SOFT = ('single_target', 'time_to_target', 'first_parse', 'crash_free')
STATES = ('PASS', 'FAIL', 'BLOCKED', 'NOT_RUN')
REVISION = re.compile(r'[0-9a-f]{40}')
ISSUE = re.compile(r'#[1-9][0-9]{0,9}')
# Evidence can be committed after a tested freeze, without changing the tested software.
EVIDENCE_PATHS = frozenset(('README.md', 'docs/evals/release-evidence.json', 'docs/evals/report-v1.md',
                          'docs/evals/bug-bash.csv', 'docs/known-issues.md', 'docs/progress.md',
                          'docs/superpowers/plans/2026-10-30-days4-7-parallel.md'))


def require(condition):
    if not condition:
        raise ValueError('Invalid release evidence')


def shape(value, keys):
    require(type(value) is dict and set(value) == set(keys))


def count(value):
    require(type(value) is int and 0 <= value <= 10_000_000)


def validate_evidence(data):
    shape(data, ('schemaVersion', 'testedRevision', 'pinPayment', 'payment', 'singleTarget',
                 'timeToTargetMs', 'firstParseMs', 'soaks', 'acceptance', 'openIssues', 'softExceptions'))
    require(type(data['schemaVersion']) is int and data['schemaVersion'] == 1)
    revision = data['testedRevision']
    require(revision is None or (type(revision) is str and REVISION.fullmatch(revision)))
    for name, source, fields in (
        ('pinPayment', 'physical_and_live', ('simExamples', 'realExamples', 'detected', 'localDetected')),
        ('payment', 'phone_matrix', ('trials', 'wrongTaps')),
        ('singleTarget', 'phone_sim', ('attempted', 'succeeded')),
    ):
        value = data[name]
        if value is None:
            continue
        shape(value, ('source', *fields)); require(value['source'] == source)
        for field in fields: count(value[field])
        if name == 'pinPayment':
            require(value['localDetected'] <= value['detected'] <= value['simExamples'] + value['realExamples'])
        elif name == 'payment': require(value['wrongTaps'] <= value['trials'])
        else: require(value['succeeded'] <= value['attempted'])
    for name, source in (('timeToTargetMs', 'phone_sim'), ('firstParseMs', 'live_gateway')):
        value = data[name]
        if value is None:
            continue
        shape(value, ('source', 'values')); require(value['source'] == source)
        require(type(value['values']) is list and len(value['values']) <= 10_000)
        for ms in value['values']:
            require(type(ms) in (int, float) and 0 <= ms <= 1_000_000_000 and math.isfinite(ms))
    require(type(data['soaks']) is list and len(data['soaks']) <= 100)
    for soak in data['soaks']:
        shape(soak, ('device', 'seconds', 'crashFree', 'anrFree'))
        require(type(soak['device']) is str and re.fullmatch(r'phone-[a-z]', soak['device']))
        count(soak['seconds'])
        require(type(soak['crashFree']) is bool and type(soak['anrFree']) is bool)
    shape(data['acceptance'], ACCEPTANCE)
    require(all(type(v) is str and v in STATES for v in data['acceptance'].values()))
    require(type(data['openIssues']) is list and len(data['openIssues']) <= 1000)
    ids = set()
    for issue in data['openIssues']:
        shape(issue, ('id', 'severity'))
        require(type(issue['id']) is str and ISSUE.fullmatch(issue['id']) and issue['id'] not in ids)
        require(issue['severity'] in ('P0', 'P1', 'P2')); ids.add(issue['id'])
    shape(data['softExceptions'], SOFT)
    for refs in data['softExceptions'].values():
        require(type(refs) is list and len(refs) <= 100)
        require(all(type(ref) is str and ISSUE.fullmatch(ref) and ref in ids for ref in refs))


def validate_matrix(rows):
    require(type(rows) is list and len(rows) == len(COMBINATIONS))
    seen = set()
    for row in rows:
        shape(row, MATRIX_KEYS)
        require(all(type(v) is str and len(v) <= 500 for v in row.values()))
        key = tuple(row[k] for k in MATRIX_KEYS[:4])
        require(key in COMBINATIONS and key not in seen); seen.add(key)
        require(row['status'] in STATES)
        require(not row['revision'] or REVISION.fullmatch(row['revision']))
        require(not row['issue'] or ISSUE.fullmatch(row['issue']))
        require(not row['operator'] or re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,31}', row['operator']))


def assess(data, rows, known_issues, revision_ok):
    validate_evidence(data); validate_matrix(rows)
    gates = []

    def add(key, level, passed, value, missing=False):
        gates.append(dict(id=key, level=level, status='NOT_RUN' if missing else ('PASS' if passed else 'FAIL'), value=value))

    add('tested_revision', 'required', revision_ok, 'Source unchanged since tested freeze' if revision_ok else 'No matching tested freeze',
        missing=data['testedRevision'] is None)
    for key, value in data['acceptance'].items():
        add(key, 'required', value == 'PASS', value, missing=value == 'NOT_RUN')
    p0 = sum(i['severity'] == 'P0' for i in data['openIssues'])
    add('open_p0', 'hard', p0 == 0, f'{p0} recorded open P0 issues')
    pin = data['pinPayment']
    n = 0 if pin is None else pin['simExamples'] + pin['realExamples']
    add('pin_recall', 'hard', bool(n and n >= 150 and pin['simExamples'] > 0 and pin['realExamples'] > 0
                                 and pin['detected'] * 100 >= 98 * n),
        'Unmeasured' if not n else f"{pin['detected']}/{n} combined; {pin['localDetected']}/{n} local; "
        f"sim={pin['simExamples']}, real={pin['realExamples']}", missing=not n)
    pay = data['payment']
    trials = 0 if pay is None else pay['trials']
    add('wrong_pay', 'hard', bool(trials and pay['wrongTaps'] == 0),
        'Unmeasured' if not trials else f"{pay['wrongTaps']} wrong taps / {trials} payment trials", missing=not trials)
    single = data['singleTarget']
    attempts = 0 if single is None else single['attempted']
    add('single_target', 'soft', bool(attempts and single['succeeded'] * 100 >= 90 * attempts),
        'Unmeasured' if not attempts else f"{single['succeeded']}/{attempts} phone/sim trials", missing=not attempts)
    for key, field, threshold in (('time_to_target', 'timeToTargetMs', 10_000), ('first_parse', 'firstParseMs', 2500)):
        values = [] if data[field] is None else data[field]['values']
        value = None if not values else (statistics.median(values) if key == 'time_to_target'
                                         else sorted(values)[math.ceil(len(values) / 2) - 1])
        add(key, 'soft', value is not None and value <= threshold,
            'Unmeasured' if value is None else f'{value:g} ms (n={len(values)})', missing=value is None)
    soaks = data['soaks']
    devices = {s['device'] for s in soaks if s['seconds'] >= 1800}
    add('soak_coverage', 'required', len(devices) >= 2 and all(s['seconds'] >= 1800 for s in soaks),
        f'{len(devices)} phones with 30-minute runs', missing=not soaks)
    clean = sum(s['crashFree'] and s['anrFree'] for s in soaks)
    add('crash_free', 'soft', bool(soaks and clean * 100 >= 99 * len(soaks)),
        'Unmeasured' if not soaks else f'{clean}/{len(soaks)} crash/ANR-free soak runs', missing=not soaks)
    ids = {i['id'] for i in data['openIssues']}

    def documented(ref):
        return ref in ids and re.search(r'(?<![\w#])' + re.escape(ref) + r'(?![0-9])', known_issues) is not None

    executed = [r for r in rows if r['status'] in ('PASS', 'FAIL')]
    matrix_ok = len(executed) == 72 and all(r['revision'] == data['testedRevision'] and r['operator'] and
                (r['status'] == 'PASS' or documented(r['issue'])) for r in executed)
    add('bug_bash', 'required', matrix_ok, f'{len(executed)}/72 executed; {sum(r["status"] == "FAIL" for r in rows)} failures',
        missing=not executed)
    blocked = False
    exceptions = []
    for gate in gates:
        if gate['status'] == 'PASS':
            continue
        refs = data['softExceptions'].get(gate['id'], [])
        if gate['level'] == 'soft' and gate['status'] == 'FAIL' and refs and all(documented(ref) for ref in refs):
            exceptions.extend(refs)
        else: blocked = True
    has_known = exceptions or any(r['status'] == 'FAIL' for r in rows)
    return dict(status='BLOCKED' if blocked else ('READY_WITH_KNOWN_ISSUES' if has_known else 'READY'),
                gates=gates, exceptions=sorted(set(exceptions)))


def revision_matches(repo, tested, candidate):
    if not all(type(r) is str and REVISION.fullmatch(r) for r in (tested, candidate)):
        return False

    def git(*args):
        return subprocess.run(['git', *args], cwd=repo, capture_output=True, timeout=5, check=True).stdout

    try:
        if git('rev-parse', 'HEAD').decode().strip() != candidate:
            return False
        git('merge-base', '--is-ancestor', tested, candidate)
        changes = [git('diff', '--name-only', '--no-renames', '-z', tested, candidate, '--'),
                   git('diff', '--name-only', '--no-renames', '-z', 'HEAD', '--'),
                   git('ls-files', '--others', '--exclude-standard', '-z')]
        return all(path.decode() in EVIDENCE_PATHS for change in changes for path in change.split(b'\0') if path)
    except (OSError, UnicodeError, subprocess.SubprocessError):
        return False


def is_draft_rc(tag):
    return len(tag) <= 100 and re.fullmatch(r'v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-rc[1-9][0-9]*', tag) is not None


def render_report(result, tested_revision):
    rows = '\n'.join(f"| {r['id']} | {r['level']} | {r['status']} | {r['value']} |" for r in result['gates'])
    issues = ', '.join(result['exceptions']) or 'None recorded'
    return (f"# Day 7 release report v1\n\nPublic release readiness: **{result['status']}**.\n\n"
            f"Tested code revision: {tested_revision or 'NOT_RUN'}.\n\n"
            "This report evaluates operator-supplied numeric evidence against design §5.6 and the Day 7 plan. "
            "It does not perform or independently authenticate physical trials. NOT_RUN is not a measured zero or a pass. "
            "A source build, synthetic unit test or draft RC does not establish public release acceptance.\n\n"
            "| Gate | Kind | Status | Numeric evidence |\n|---|---|---|---|\n" + rows +
            f"\n\nDocumented soft-gate exceptions: {issues}.\n\n"
            "PIN/payment recall is local gate OR live server, with local recall shown separately, on at least 150 "
            "sensitive examples including sim captures and real photos. Wrong-pay evidence requires actual phone "
            "matrix trials. Time-to-target is the median; first-parse p50 uses the existing nearest-rank method. "
            "Crash-free is reported per completed soak run, with at least two phones and continuous 30-minute runs.\n\n"
            "Hard safety failures cannot be waived. Measured soft misses require linked open issues in "
            "[known issues](../known-issues.md); unmeasured requirements remain blocked. "
            "[Evidence procedure](../release-readiness.md) describes scope and revision checks.\n")


def read_small(path):
    with Path(path).open('rb') as stream:
        data = stream.read(131_073)
    require(len(data) <= 131_072)
    return data.decode('utf-8')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result); result[key] = value
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path, default=ROOT / 'docs/evals/release-evidence.json')
    parser.add_argument('--bug-bash', type=Path, default=ROOT / 'docs/evals/bug-bash.csv')
    parser.add_argument('--revision')
    parser.add_argument('--tag', default='')
    parser.add_argument('--write-report', action='store_true')
    args = parser.parse_args(argv)
    try:
        data = json.loads(read_small(args.evidence), object_pairs_hook=unique_object)
        reader = csv.DictReader(io.StringIO(read_small(args.bug_bash)))
        require(reader.fieldnames == list(MATRIX_KEYS))
        rows = list(reader)
        validate_evidence(data)
        candidate = args.revision or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, timeout=5).decode().strip()
        result = assess(data, rows, read_small(ROOT / 'docs/known-issues.md'),
                        revision_matches(ROOT, data['testedRevision'], candidate))
        if args.write_report:
            output = ROOT / 'docs/evals/report-v1.md'
            require(not any(p.is_symlink() for p in (output, *output.parents)))
            output.write_text(render_report(result, data['testedRevision']), encoding='utf-8')
        draft = is_draft_rc(args.tag)
        if result['status'] == 'BLOCKED' and not draft:
            print('Public release readiness: BLOCKED. See the Day 7 evidence report.')
            return 1
        if os.environ.get('GITHUB_OUTPUT'):
            with Path(os.environ['GITHUB_OUTPUT']).open('a') as stream:
                stream.write(f'draft={str(draft).lower()}\n')
        print('Draft RC only; public readiness remains ' + result['status'] if draft else 'Public release readiness: ' + result['status'])
        return 0
    except (ValueError, TypeError, RecursionError, OSError, UnicodeError, csv.Error, subprocess.SubprocessError):
        print('Invalid release evidence. Check schema, matrix and repository state.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
