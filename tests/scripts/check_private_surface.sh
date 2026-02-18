#!/usr/bin/env bash
set -euo pipefail

# Fail if known-private paths are tracked in git.
PATTERNS=(
  '^agents/qa/'
  '^backend/BLOCKERS\.md$'
  '^backend/RUNBOOK_DISPATCH_HARDENING\.md$'
  '^backend/SPIKE_RESULTS\.md$'
  '^docs/FAST_DEV_PROCESS_SKILL_PROPOSAL\.md$'
  '^docs/POSTMORTEM_ARCH_OVERHAUL_2026-02-17\.md$'
  '^docs/archive/historical-2026-02-17/'
)

tracked_files="$(git ls-files)"
violations=()

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    violations+=("$match")
  done < <(printf '%s\n' "$tracked_files" | grep -E "$pattern" || true)
done

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "❌ Private surface policy violation:"
  printf ' - %s\n' "${violations[@]}" | sort -u
  exit 1
fi

echo "✅ Private surface policy check passed"
