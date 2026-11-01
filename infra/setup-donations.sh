#!/usr/bin/env bash
# C5-4: restricted bucket and pointer TTL for opt-in donations (ADR 0005, design §4.7).
# Human step: needs a GCP project with billing. Nothing here runs in CI.
#   PROJECT=fingerpost-prod REGION=asia-south1 BUCKET=fingerpost-donations-prod \
#   SA=gateway@fingerpost-prod.iam.gserviceaccount.com infra/setup-donations.sh
# Then set DONATE_BUCKET=$BUCKET on the gateway.
set -euo pipefail
: "${PROJECT:?}" "${REGION:?}" "${BUCKET:?}" "${SA:?}"
here="$(cd "$(dirname "$0")" && pwd)"

# Private by construction: uniform access, public access blocked, no versioning (a deleted donation stays deleted).
gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$REGION" \
  --uniform-bucket-level-access --public-access-prevention --default-storage-class STANDARD
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file "$here/donations/lifecycle.json" --no-versioning

# The gateway only signs uploads: object create, no read or list. Signing V4 URLs on Cloud Run
# uses the IAM signBlob API, so the service account may create tokens for itself only.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectCreator
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountTokenCreator

# donations/{id}.expireAt deletes the pointer record at 90 days, together with the objects.
gcloud firestore fields ttls update expireAt --collection-group donations --enable-ttl --project "$PROJECT"
