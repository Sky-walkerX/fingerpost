# Operational Runbook

## Releasing

Fingerpost releases are distributed as signed APKs published to GitHub Releases via automated GitHub Actions workflow triggered on version tags (`v*`).

### 1. Keystore Generation (Human Step)

Generate the release signing keystore locally using `keytool`.

```bash
keytool -genkeypair -v -keystore release.jks -alias release -keyalg RSA -keysize 2048 -validity 10000
```

> **Security Note:** Never commit keystore files or passwords to the repository. The `.gitignore` covers `*.jks` and `*.keystore`. Keep the release keystore backed up securely offline.

### 2. Configure GitHub Secrets

Base64-encode the keystore and set the four release secrets in the GitHub repository using the GitHub CLI (`gh`):

```bash
# 1. Base64-encoded keystore
base64 -w 0 release.jks | gh secret set RELEASE_KEYSTORE

# 2. Keystore store password
gh secret set RELEASE_STORE_PASSWORD

# 3. Key alias (e.g., "release")
gh secret set RELEASE_KEY_ALIAS

# 4. Key password
gh secret set RELEASE_KEY_PASSWORD
```

### 3. Register Certificate Digest in Gateway `SIGNING_DIGESTS` (Human Step, needs GCP)

To allow the release APK to pass key attestation and authenticate against the live gateway, the signing certificate's SHA-256 digest (lowercase hex, no colons) must be included in the gateway's `SIGNING_DIGESTS` environment variable on Cloud Run.

Extract the digest:

```bash
keytool -list -v -keystore release.jks -alias release | awk '/SHA256:/ { print tolower($2) }' | tr -d ':'
```

*(The release workflow also computes and prints this digest to the GitHub Actions Job Summary).*

Update Cloud Run:

```bash
gcloud run services update gateway \
  --region asia-south1 \
  --update-env-vars '^@^SIGNING_DIGESTS=<existing_digests>,<release_digest>'
```

### 4. Tagging and Release Execution

To cut a release, tag the desired commit and push the tag:

```bash
git tag -a v1.0.0-rc1 -m "Release v1.0.0-rc1"
git push origin v1.0.0-rc1
```

The `.github/workflows/release.yml` workflow will:
1. Decode the keystore into `$RUNNER_TEMP/release.jks`.
2. Extract the certificate SHA-256 digest and print it to `$GITHUB_STEP_SUMMARY`.
3. Build the signed release APK (`:app:assembleRelease`).
4. Generate the `fingerpost-<tag>.apk.sha256` checksum.
5. Create a GitHub Release for `<tag>` with `fingerpost-<tag>.apk` and `fingerpost-<tag>.apk.sha256` attached.
6. Clean up `$RUNNER_TEMP/release.jks` in an `always()` post-step.


> The `^@^` prefix makes `@` the separator, because `SIGNING_DIGESTS` itself contains commas.

## Incident response and alerts

These are preparation steps, not evidence that production alerts are configured.

- Cloud pause: set `config/runtime.cloudEnabled=false` in the intended Firestore project. Confirm a fresh session and an existing session both refuse new billed calls; retain numeric outcomes only. Accounting failures must keep cloud work paused. Resume only after the cause is resolved and the cap is reviewed.
- Rollback: identify the previous verified Cloud Run revision, then route traffic to it with `gcloud run services update-traffic gateway --region <accepted-region> --to-revisions <verified-revision>=100`. Verify health, auth rejection and a synthetic task. Do not infer the accepted region from example commands above; ADR-0003 remains the authority.
- Secret rotation: create a new Secret Manager version, deploy a revision referencing it and verify access before retiring the old version. Rotating SESSION_SECRET invalidates existing tokens; expect clients to authenticate again. Never print values or put them in command-line history.
- Quota changes: review the task/spend limits and `DAILY_CAP_USD`, change the intended configuration, then test the boundary with synthetic identities. Increasing a cap needs the budget owner's authorization.
- Alerts to configure: error rate above 5%, parse p95 above 5 seconds and spend above 80% of the daily cap. Use content-free structured counters; exclude health checks from task error rates. Record each alert's window, notification destination and a delivered test notification before marking B6-3 complete. Missing latency samples must not appear as healthy zero latency.
- Incident record: UTC time, revision, affected surface, numeric impact, pause/rollback action, verification and owner. Exclude image/audio/OCR/transcripts, email addresses and credentials.

Production telemetry source is now wired but remains opt-in. Follow [monitoring setup](monitoring.md): one active serving writer/revision, metric-writer IAM, explicit project and fresh series are prerequisites. Defaults keep monitoring disabled; generated policies remain disabled until live notification acceptance.
