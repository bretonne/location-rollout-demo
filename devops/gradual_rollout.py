# gradual_rollout.py

import json
import os
import requests
from collections import defaultdict
import argparse

def main():
    parser = argparse.ArgumentParser(description="Gradual rollout of software route updates via API.")
    parser.add_argument("--percent", required=True, help="The target percentage for the rollout phase.")
    parser.add_argument("--route", required=True, help="The new software route (e.g., v2).")
    parser.add_argument("--api-url", default="http://demo.local:8080",
                        help="The API base URL (default: http://demo.local:8080)")
    args = parser.parse_args()

    try:
        percent = int(args.percent)
        new_route = args.route
        api_url = args.api_url.rstrip('/')

        # Validate percentage
        if percent < 0 or percent > 100:
            raise ValueError("Percentage must be between 0 and 100")

        print(f"Starting rollout phase {percent}% to route '{new_route}'")
        print(f"Using API URL: {api_url}")

        # Get all machines from API
        print("Fetching machine data from API...")
        response = requests.get(f"{api_url}/api/machines")

        if response.status_code != 200:
            print(f"Error: Failed to fetch machines from API. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return 1

        data = response.json()
        if 'machines' not in data:
            print("Error: 'machines' key not found in API response")
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

        print(f"Found {len(store_machines)} stores with machines")

        machines_to_update = []
        updated_count = 0

        # For each store, identify machines to update
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

                # Add the first 'to_update' machines to update list
                for i in range(min(to_update, len(old_machines))):
                    machines_to_update.append(old_machines[i])
                    updated_count += 1
                    print(f"Will update {old_machines[i]} in store {store} to {new_route}")
            else:
                print(f"Store {store}: Already at or above {percent}% target")

        if not machines_to_update:
            print("No machines need to be updated for this phase.")
            return 0

        # Make bulk update request to API
        print(f"\nUpdating {len(machines_to_update)} machines via API...")
        update_payload = {
            "machineIds": machines_to_update,
            "fieldName": "softwareRoute",
            "fieldValue": new_route
        }

        response = requests.post(f"{api_url}/api/profile/update_profiles", json=update_payload)

        if response.status_code != 200:
            print(f"Error: Failed to update machines via API. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return 1

        update_result = response.json()
        print(f"API Update Result: {update_result}")

        print(f"Rollout phase {percent}% completed. Updated {updated_count} machines total.")
        return 0

    except ValueError as e:
        print(f"Error: Invalid percentage value - {e}")
        return 1
    except requests.exceptions.RequestException as e:
        print(f"Error: Network request failed - {e}")
        return 1
    except json.JSONDecodeError:
        print("Error: Invalid JSON response from API")
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())