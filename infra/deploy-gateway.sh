#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 2 ]]; then
  printf '%s\n' 'Usage: infra/deploy-gateway.sh <project> <asia-south1|us-central1>' >&2
  exit 2
fi
project_id=$1
region=$2
if [[ ! "$project_id" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] ||
   [[ "$region" != asia-south1 && "$region" != us-central1 ]]; then
  printf '%s\n' 'Use a valid project ID and one of the two ADR-0003 candidate regions.' >&2
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

gcloud builds submit . --project "$project_id" --region "$region" \
  --config infra/cloudbuild.yaml --ignore-file .gcloudignore --substitutions "_IMAGE=$image"
gcloud run deploy fingerpost-gateway --project "$project_id" --region "$region" --image "$image" \
  --timeout 3600 --concurrency 40 --min-instances 0 --max-instances 3 --allow-unauthenticated \
  --set-secrets META_API_KEY=meta-api-key:latest,DEBUG_TOKEN=debug-token:latest \
  --set-env-vars "MODEL_MODE=live,GIT_SHA=$git_sha,AUTH_REQUIRED=false,ALLOW_UNAUTHENTICATED_LIVE=true"
