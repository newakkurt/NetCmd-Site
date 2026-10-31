#!/usr/bin/env python3
"""Audit NetCmd command data for duplicate slugs and repeated CLI patterns.

This reports likely per-port clones after normalizing interface identifiers.
It does not prove that a command is valid for a particular device release.
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

INTERFACE_RE = re.compile(
    r"(?i)\b(?:GigabitEthernet|FastEthernet|TenGigabitEthernet|"
    r"TwentyFiveGigE|FortyGigabitEthernet|HundredGigE|Ethernet|"
    r"GE|XGigabitEthernet|Gi|Fa|Te|Eth)\s*\d+(?:/\d+){0,3}\b"
)


def normalize_command(command):
    value = INTERFACE_RE.sub("<INTERFACE>", command.strip())
    value = re.sub(r"\s+", " ", value)
    return value.lower()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="Audit one JSON file; default scans data/commands*.json")
    parser.add_argument("--top", type=int, default=15, help="Maximum repeated patterns per vendor")
    args = parser.parse_args()

    paths = [DATA / args.file] if args.file else sorted(DATA.glob("commands*.json"))
    paths = [p for p in paths if p.is_file()]
    if not paths:
        print("ERROR: no command JSON files found", file=sys.stderr)
        return 2

    all_items = []
    seen = {}
    duplicates = []
    for path in paths:
        try:
            items = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"ERROR: cannot read {path}: {exc}", file=sys.stderr)
            return 2
        if not isinstance(items, list):
            print(f"ERROR: expected a JSON list in {path}", file=sys.stderr)
            return 2
        for item in items:
            slug = item.get("slug", "")
            if slug in seen:
                duplicates.append((slug, seen[slug], path.name))
            else:
                seen[slug] = path.name
            all_items.append((path.name, item))

    print(f"Files: {len(paths)}")
    print(f"Cards: {len(all_items)}")
    print(f"Unique slugs: {len(seen)}")
    print(f"Duplicate slugs: {len(duplicates)}")
    for slug, first, second in duplicates:
        print(f"  DUPLICATE {slug}: {first} / {second}")

    has_errors = bool(duplicates)
    for vendor in ("cisco", "huawei", "aruba", "juniper", "mikrotik"):
        patterns = Counter()
        for _, item in all_items:
            block = item.get(vendor) or {}
            commands = block.get("cmds") or []
            if commands:
                signature = " ; ".join(normalize_command(c) for c in commands)
                patterns[signature] += 1
        if not patterns:
            continue
        repeated_cards = sum(count for count in patterns.values() if count > 1)
        print(f"\n{vendor}: {sum(patterns.values())} command cards, "
              f"{len(patterns)} normalized patterns, "
              f"{repeated_cards} cards in repeated patterns")
        for signature, count in patterns.most_common(args.top):
            if count > 1:
                print(f"  x{count}: {signature}")

    print("\nCLI syntax and release compatibility still require platform-specific validation.")
    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
