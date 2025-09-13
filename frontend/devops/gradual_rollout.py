#!/usr/bin/env python3
import time, math, requests, sys, os
API = os.environ.get("API_BASE", "http://demo.local:9090/api")

def groups_by_location(machines):
    by = {}
    for mid, m in machines.items():
        store = m.get("storeId","unknown")
        by.setdefault(store, []).append(mid)
    return by

def pick_prefix(lst, pct):
    if not lst: return []
    n = math.ceil(len(lst) * pct / 100.0)
    return sorted(lst)[:n]

def set_route(mid, route):
    r = requests.post(f"{API}/profile/set", json={
        "machineId": mid, "fieldName":"softwareRoute", "fieldValue": route
    })
    r.raise_for_status()

def main(steps=(20,40,60,80,100), sleep_sec=60):
    allm = requests.get(f"{API}/machines").json()["machines"]
    groups = groups_by_location(allm)

    for pct in steps:
        print(f"\n==> Rolling {pct}% per location to v2")
        for store, mids in groups.items():
            target = set(pick_prefix(mids, pct))
            for mid in mids:
                route = "v2" if mid in target else "v1"
                set_route(mid, route)
            print(f"  {store}: {len(target)}/{len(mids)} -> v2")
        if pct != steps[-1]:
            print(f"Sleeping {sleep_sec}s...")
            time.sleep(sleep_sec)

if __name__ == "__main__":
    steps = [int(x) for x in sys.argv[1].split(",")] if len(sys.argv)>1 else None
    sleep = int(sys.argv[2]) if len(sys.argv)>2 else 60
    main(steps or (20,40,60,80,100), sleep)
