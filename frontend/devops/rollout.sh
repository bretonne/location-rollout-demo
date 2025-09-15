#!/usr/bin/env bash
set -euo pipefail
# Usage: ./rollout.sh "20,40,60,80,100" 60

# Source shared version helper so VERSION is available to frontend scripts
COMMON_VERSION_SH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../" && pwd)/devops/version.sh"
if [[ -f "${COMMON_VERSION_SH}" ]]; then
  # shellcheck source=/dev/null
  source "${COMMON_VERSION_SH}"
  # populate VERSION (no bump by default)
  get_current_version
else
  echo "Warning: shared version helper not found: ${COMMON_VERSION_SH} — continuing without VERSION"
fi

STEPS="${1:-20,40,60,80,100}"
SLEEP="${2:-60}"
API_BASE="${API_BASE:-http://demo.local:9090/api}"
export API_BASE
python3 "$(dirname "$0")/gradual_rollout.py" "$STEPS" "$SLEEP"
