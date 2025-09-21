# gradual_rollout.py

import json
import os
from collections import defaultdict
import argparse

def main():
    parser = argparse.ArgumentParser(description="Gradual rollout of software route updates.")
    parser.add_argument("--percent", required=True, help="The target percentage for the rollout phase.")
    parser.add_argument("--route", required=True, help="The new software route (e.g., v2).")
    args = parser.parse_args()

    try:
        percent = int(args.percent)
        new_route = args.route

        # Validate percentage
        if percent < 0 or percent > 100:
            raise ValueError("Percentage must be between 0 and 100")

        # Path to data.json (assuming script is run from devops folder)
        file_path = "backend/data/data.json"

        # Check if file exists
        if not os.path.exists(file_path):
            print(f"Error: File not found at {file_path}")
            print("Please make sure data.json exists in backend/data folder")
            return 1

        # Load the JSON data
        with open(file_path, 'r') as f:
            data = json.load(f)

        if 'machines' not in data:
            print("Error: 'machines' key not found in JSON data")
            return 1

        machines = data['machines']

        if not machines:
            print("Error: No machines found in data")
            return 1

        # Group machines by storeId
        store_machines = defaultdict(list)
        for machine_id, info in machines.items():
            if 'storeId' not in info or 'softwareRoute' not in info:
                print(f"Warning: Skipping machine {machine_id} - missing required fields")
                continue
            store_machines[info['storeId']].append(machine_id)

        if not store_machines:
            print("Error: No valid machines found to process")
            return 1

        print(f"Starting rollout phase {percent}% to route '{new_route}'")
        print(f"Found {len(store_machines)} stores with machines")

        updated_count = 0

        # For each store, update machines to reach the target percentage on the new route
        for store, mach_list in store_machines.items():
            N = len(mach_list)

            # Count current machines on the new route
            current_new = sum(1 for m in mach_list if machines[m]['softwareRoute'] == new_route)

            # Calculate target number on new route
            target = round(percent * N / 100)

            # Number to update
            to_update = max(0, target - current_new)

            if to_update > 0:
                # Get machines still on old route
                old_machines = [m for m in mach_list if machines[m]['softwareRoute'] != new_route]

                # Sort for deterministic order
                old_machines.sort()

                # Update the first 'to_update' machines
                for i in range(min(to_update, len(old_machines))):
                    machines[old_machines[i]]['softwareRoute'] = new_route
                    updated_count += 1
                    print(f"Updated {old_machines[i]} in store {store} to {new_route}")
            else:
                print(f"Store {store}: Already at or above {percent}% target")

        # Save the updated JSON
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Rollout phase {percent}% completed. Updated {updated_count} machines total.")
        return 0

    except ValueError as e:
        print(f"Error: Invalid percentage value - {e}")
        return 1
    except FileNotFoundError:
        print(f"Error: Could not open file {file_path}")
        return 1
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in data.json")
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())