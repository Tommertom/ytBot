#!/usr/bin/env python3
import json
import sys

try:
    from soco import discover
except Exception as exc:
    print(f"Failed to import soco: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    devices = discover(timeout=5)
    results = []
    if devices:
        for device in devices:
            results.append({
                "name": device.player_name,
                "ip": device.ip_address,
                "uid": getattr(device, "uid", None),
                "household": getattr(device, "household_id", None)
            })

    print(json.dumps(results))
except Exception as exc:
    print(f"Sonos discovery failed: {exc}", file=sys.stderr)
    sys.exit(1)
