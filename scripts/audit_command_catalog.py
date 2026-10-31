#!/usr/bin/env python3
"""Report near-duplicate command cards in NetCmd catalogue data.

This is an audit/report tool, not a CLI syntax validator. It normalizes common
interface/port identifiers so that per-port copies of the same command are
counted as one command pattern.
"""
import argparse
import json
import re
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
    value = re.sub(r"(?i)(show\s+interfaces(?:\s+<INTERFACE>)?)\s+\d+\b", r"\1 <PORT>", value)
    value = re.sub(r"(?i)(show\s+mac-address)\s+\d+\b", r"\1 <PORT>", value)
    value = re.sub(r"(?i)(show\s+spanning-tree)\s+\d+\b", r"\1 <PORT>", value)
    value = re.sub(r"\s+", " ", value)
    return value.lower()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", default="commands_2000_d.json",
                        help="Catalogue JSON filename under data/")
    parser.add_argument("--top", type=int, default=12,
                        help="Number of most repeated patterns to show")
    args = parser.parse_args()

    path = DATA / args.file
    items = json.loads(path.read_text(encoding="utf-8"))
    print(f"File: {path.relative_to(ROOT)}")
    print(f"Cards: {len(items)}")
    slugs = [item.get("slug", "") for item in items]
    print(f"Unique slugs: {len(set(slugs))}")
    if len(slugs) != len(set(slugs)):
        print(f"WARNING: duplicate slugs: {len(slugs) - len(set(slugs))}")

    for vendor in ("cisco", "huawei", "aruba", "juniper", "mikrotik"):
        patterns = Counter()
        for item in items:
            block = item.get(vendor) or {}
            commands = block.get("cmds") or []
            if commands:
                signature = " ; ".join(normalize_command(c) for c in commands)
                patterns[signature] += 1
        if not patterns:
            continue
        repeated_cards = sum(count for count in patterns.values() if count > 1)
        print(f"\n{vendor}: {sum(patterns.values())} cards, "
              f"{len(patterns)} normalized command patterns, "
              f"{repeated_cards} cards belong to repeated patterns")
        for signature, count in patterns.most_common(args.top):
            if count > 1:
                print(f"  x{count}: {signature}")

    print("\nNote: this audit detects repeated patterns; it does not verify "
          "command syntax against a device OS or software release.")


if __name__ == "__main__":
    main()
