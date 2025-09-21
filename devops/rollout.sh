#!/bin/bash

# rollout.sh

set -e  # Exit on any error

percentages="$1"
route=$2
api_url="${3:-http://demo.local:8080}"  # Default to localhost:8000 if not provided

# Check if parameters are provided
if [ -z "$percentages" ] || [ -z "$route" ]; then
  echo "Usage: ./rollout.sh \"20 40 60 80 100\" v2 [API_URL]"
  echo "Example: ./rollout.sh \"20,40,60,80,100\" v2"
  echo "Example: ./rollout.sh \"20 40 60 80 100\" v2 http://my-api:8000"
  exit 1
fi

echo "Starting gradual rollout to route '$route'"
echo "Phases: $percentages"
echo "API URL: $api_url"

# Check if Python script exists
if [ ! -f "devops/gradual_rollout.py" ]; then
    echo "Error: gradual_rollout.py not found in current directory"
    exit 1
fi

# Convert both spaces and commas to comma-separated
percentages_comma=$(echo "$percentages" | tr ' ' ',' | sed 's/,,/,/g; s/,$//; s/^,//')

# Split the percentages by comma
IFS=',' read -r -a perc_array <<< "$percentages_comma"

phase_num=1
total_phases=${#perc_array[@]}

for perc in "${perc_array[@]}"; do
  # Trim any leading/trailing spaces
  perc=$(echo "$perc" | sed 's/^[ \t]*//;s/[ \t]*$//')

  echo ""
  echo "=== Phase $phase_num/$total_phases: ${perc}% rollout ==="

  # Call the Python script and capture exit code
  python3 devops/gradual_rollout.py --percent "$perc" --route "$route" --api-url "$api_url"
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