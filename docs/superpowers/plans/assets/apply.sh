#!/usr/bin/env bash
# Copy plan assets into the repo, byte for byte.
#   docs/superpowers/plans/assets/apply.sh <day> <path-or-dir> [more…]     e.g.  apply.sh 1 packages/protocol
# Paths are relative to assets/day<N>/ and land at the same path under the repo root.
# Refuses to overwrite a file that already exists with different content (your work) unless --force is given.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
force=0; args=()
for a in "$@"; do [[ "$a" == --force ]] && force=1 || args+=("$a"); done
day="${args[0]:?usage: apply.sh <day> <path>...}"; src="$here/day$day"
[[ -d "$src" ]] || { echo "no assets for day $day"; exit 2; }
for rel in "${args[@]:1}"; do
  [[ -e "$src/$rel" ]] || { echo "missing asset: day$day/$rel"; exit 2; }
  while IFS= read -r -d '' f; do
    r="${f#"$src/"}"; dst="$root/$r"
    if [[ -e "$dst" ]] && ! cmp -s "$f" "$dst" && [[ $force -eq 0 ]]; then echo "SKIP (differs; use --force to overwrite): $r"; continue; fi
    mkdir -p "$(dirname "$dst")"; cp "$f" "$dst"; echo "copied $r"
  done < <(find "$src/$rel" -type f -print0)
done
