#!/usr/bin/env python3
"""Verify byte-deterministic roadmap or git-flow generation."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def first_difference(first: bytes, second: bytes):
    """Describe the first byte difference, including text position when useful."""
    common = min(len(first), len(second))
    offset = next((index for index in range(common) if first[index] != second[index]), common)
    detail = {
        "offset": offset,
        "first_size": len(first),
        "second_size": len(second),
        "first_byte": first[offset] if offset < len(first) else None,
        "second_byte": second[offset] if offset < len(second) else None,
    }
    try:
        prefix = first[:offset].decode("utf-8")
    except UnicodeDecodeError:
        return detail
    detail["line"] = prefix.count("\n") + 1
    detail["column"] = len(prefix.rsplit("\n", 1)[-1]) + 1
    return detail


def generator_command(profile: str, source: str, output: str, route: str):
    if profile == "roadmap":
        return [sys.executable, str(ROOT / "scripts" / "roadmap.py"), source, "-o", output]
    if profile == "gitflow":
        return [
            sys.executable,
            str(ROOT / "scripts" / "gitflow.py"),
            source,
            "-o",
            output,
            "--route",
            route,
        ]
    raise ValueError(f"unsupported profile: {profile}")


def run_once(profile: str, source: str, output: str, route: str):
    command = generator_command(profile, source, output, route)
    proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
    return proc, command


def verify(profile: str, source: str, route: str = "builtin"):
    source = os.path.abspath(source)
    if not os.path.isfile(source):
        return {
            "report_version": 1,
            "summary": {"status": "failed", "errors": 1},
            "findings": [{
                "layer": "generation",
                "severity": "error",
                "code": "determinism.source.missing",
                "path": "/source",
                "message": f"source does not exist: {source}",
            }],
            "profile": profile,
            "source": source,
        }

    with tempfile.TemporaryDirectory(prefix="drawio-determinism-") as temp:
        outputs = [os.path.join(temp, "run-1.drawio"), os.path.join(temp, "run-2.drawio")]
        commands = []
        for index, output in enumerate(outputs, start=1):
            proc, command = run_once(profile, source, output, route)
            commands.append(command)
            if proc.returncode != 0 or not os.path.isfile(output):
                diagnostic = (proc.stderr or proc.stdout or "generator produced no diagnostic output").strip()
                return {
                    "report_version": 1,
                    "summary": {"status": "failed", "errors": 1},
                    "findings": [{
                        "layer": "generation",
                        "severity": "error",
                        "code": "determinism.generation.failed",
                        "path": f"/runs/{index - 1}",
                        "message": f"generation run {index} failed with exit {proc.returncode}: {diagnostic}",
                    }],
                    "profile": profile,
                    "source": source,
                    "commands": commands,
                }
        first, second = Path(outputs[0]).read_bytes(), Path(outputs[1]).read_bytes()
        if first != second:
            difference = first_difference(first, second)
            position = f"byte {difference['offset']}"
            if "line" in difference:
                position += f" (line {difference['line']}, column {difference['column']})"
            return {
                "report_version": 1,
                "summary": {"status": "failed", "errors": 1},
                "findings": [{
                    "layer": "generation",
                    "severity": "error",
                    "code": "determinism.output.mismatch",
                    "path": "/runs/1",
                    "message": f"generated artifacts first differ at {position}",
                }],
                "profile": profile,
                "source": source,
                "commands": commands,
                "difference": difference,
            }
        return {
            "report_version": 1,
            "summary": {"status": "passed", "errors": 0},
            "findings": [],
            "profile": profile,
            "source": source,
            "route": route if profile == "gitflow" else None,
            "bytes": len(first),
            "sha256_equal": True,
            "commands": commands,
        }


def print_report(report: dict, as_json: bool):
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return
    if report["summary"]["status"] == "passed":
        print(f"determinism passed: {report['profile']} produced {report['bytes']} identical bytes twice")
    else:
        for finding in report["findings"]:
            print(f"error: [{finding['code']}] {finding['message']}", file=sys.stderr)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate a draw.io artifact twice and compare bytes.")
    parser.add_argument("profile", choices=("roadmap", "gitflow"))
    parser.add_argument("source", help="roadmap YAML or git-flow JSON source")
    parser.add_argument(
        "--route",
        choices=("builtin", "auto", "graphviz"),
        default="builtin",
        help="git-flow routing option; builtin is the deterministic default",
    )
    parser.add_argument("--json", action="store_true", help="print a machine-readable report")
    args = parser.parse_args(argv)
    report = verify(args.profile, args.source, args.route)
    print_report(report, args.json)
    return 1 if report["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
