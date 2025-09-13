#!/usr/bin/env bash
set -euo pipefail
# Usage: ./rollout.sh "20,40,60,80,100" 60
STEPS="${1:-20,40,60,80,100}"
SLEEP="${2:-60}"
API_BASE="${API_BASE:-http://demo.local:9090/api}"
export API_BASE
python3 "$(dirname "$0")/gradual_rollout.py" "$STEPS" "$SLEEP"
