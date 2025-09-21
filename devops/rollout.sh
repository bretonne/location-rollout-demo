#!/bin/bash

# rollout.sh

set -e  # Exit on any error

percentages=$1
route=$2

# Check if parameters are provided
if [ -z "$percentages" ] || [ -z "$route" ]; then
  echo "Usage: ./rollout.sh \"20, 40, 60, 80, 100\" v2"
  exit 1
fi

echo "Starting gradual rollout to route '$route'"
echo "Phases: $percentages"

# Check if Python script exists
if [ ! -f "devops/gradual_rollout.py" ]; then
    echo "Error: gradual_rollout.py not found in current directory"
    exit 1
fi

# Split the percentages by comma
IFS=',' read -r -a perc_array <<< "$percentages"

phase_num=1
total_phases=${#perc_array[@]}

for perc in "${perc_array[@]}"; do
  # Trim any leading/trailing spaces
  perc=$(echo "$perc" | sed 's/^[ \t]*//;s/[ \t]*$//')

  echo ""
  echo "=== Phase $phase_num/$total_phases: ${perc}% rollout ==="

  # Call the Python script and capture exit code
  python3 devops/gradual_rollout.py --percent "$perc" --route "$route"
  python_exit_code=$?

  if [ $python_exit_code -ne 0 ]; then
    echo "Error: Python script failed with exit code $python_exit_code"
    exit $python_exit_code
  fi

  # If this is not the last phase, sleep for 1 minute
  if [ $phase_num -lt $total_phases ]; then
    echo "Waiting 60 seconds before next phase..."
    sleep 60
  fi

  phase_num=$((phase_num + 1))
done

echo ""
echo "=== Rollout completed successfully ==="