#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 3 || $# -gt 4 || ( $# -eq 4 && "$4" != --with-sim ) ]]; then
  printf '%s\n' 'Usage: infra/deploy-gateway.sh <project> <asia-south1|us-central1> <signing-digests> [--with-sim]' >&2
  exit 2
fi
project_id=$1
region=$2
signing_digests=$3
if [[ ! "$project_id" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] ||
   [[ "$region" != asia-south1 && "$region" != us-central1 ]] ||
   [[ ! "$signing_digests" =~ ^[0-9a-f]{64}(,[0-9a-f]{64})*$ ]]; then
  printf '%s\n' 'Use a valid project ID, one of the two ADR-0003 candidate regions, and lowercase hex SHA-256 signing digests.' >&2
  exit 2
fi
if ! command -v gcloud >/dev/null; then
  printf '%s\n' 'Install and authenticate the Google Cloud CLI before deployment.' >&2
  exit 2
fi
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd -- "$repo_root"
if [[ -n "$(git status --porcelain)" ]]; then
  printf '%s\n' 'Commit and verify the working tree before deploying a revision.' >&2
  exit 2
fi
git_sha=$(git rev-parse --short HEAD)
image="$region-docker.pkg.dev/$project_id/fp/gateway:$git_sha"
secrets='META_API_KEY=meta-api-key:latest,DEBUG_TOKEN=debug-token:latest,SESSION_SECRET=session-secret:latest'
if [[ ${4:-} == --with-sim ]]; then
  secrets+=',SIM_TOKEN=sim-token:latest'
fi

gcloud builds submit . --project "$project_id" --region "$region" \
  --config infra/cloudbuild.yaml --ignore-file .gcloudignore --substitutions "_IMAGE=$image"
# v1 challenges and per-client limits live in this instance's memory.
gcloud run deploy fingerpost-gateway --project "$project_id" --region "$region" --image "$image" \
  --timeout 3600 --concurrency 40 --min-instances 0 --max-instances 1 --allow-unauthenticated \
  --set-secrets "$secrets" \
  --set-env-vars "^;^MODEL_MODE=live;GIT_SHA=$git_sha;AUTH_REQUIRED=true;SIGNING_DIGESTS=$signing_digests;FIREBASE_PROJECT_ID=$project_id;DAILY_CAP_USD=12"
