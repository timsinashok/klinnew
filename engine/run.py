import argparse
import json
import math
import sys
from pathlib import Path

from engine import rules  # noqa: F401  (registers rules)
from engine.loader import load_data
from engine.registry import run_all


def _json_safe(obj):
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Klin consistency engine")
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)

    data = load_data(args.data)
    findings = run_all(data)

    payload = [_json_safe(f.to_dict()) for f in findings]
    text = json.dumps(payload, indent=2, default=str)

    if args.out:
        args.out.write_text(text)
        print(f"wrote {len(findings)} findings → {args.out}", file=sys.stderr)
    else:
        print(text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
