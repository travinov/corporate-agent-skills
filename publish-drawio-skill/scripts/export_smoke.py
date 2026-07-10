#!/usr/bin/env python3
"""Export a draw.io document to PNG and verify basic PNG framing.

The draw.io executable is selected in this order:

1. ``--drawio``;
2. ``DRAWIO_CLI``;
3. a known executable on ``PATH`` or a standard desktop-app location.

No executable is downloaded and no remote renderer is used.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_IEND = b"\x00\x00\x00\x00IEND\xaeB`\x82"
ENV_NAME = "DRAWIO_CLI"
PATH_CANDIDATES = ("drawio", "draw.io", "diagrams-net", "diagrams.net")
APP_CANDIDATES = (
    "/Applications/draw.io.app/Contents/MacOS/draw.io",
    "/Applications/diagrams.net.app/Contents/MacOS/diagrams.net",
)


def _is_executable(path: str) -> bool:
    return os.path.isfile(path) and os.access(path, os.X_OK)


def _resolve_configured(value: str | None) -> str | None:
    if not value:
        return None
    expanded = os.path.abspath(os.path.expanduser(value)) if os.sep in value else value
    if os.sep in value:
        return expanded if _is_executable(expanded) else None
    resolved = shutil.which(value)
    return os.path.abspath(resolved) if resolved else None


def discover_drawio(explicit: str | None = None, environ: dict[str, str] | None = None):
    """Return ``(executable, source, configured_value)``.

    An invalid explicit or environment configuration is authoritative: it is
    reported instead of being hidden by an unrelated executable on ``PATH``.
    """
    environ = os.environ if environ is None else environ
    if explicit:
        return _resolve_configured(explicit), "argument", explicit
    configured = environ.get(ENV_NAME)
    if configured:
        return _resolve_configured(configured), "environment", configured
    for name in PATH_CANDIDATES:
        resolved = shutil.which(name)
        if resolved:
            return os.path.abspath(resolved), "path", name
    for candidate in APP_CANDIDATES:
        if _is_executable(candidate):
            return candidate, "application", candidate
    return None, "discovery", None


def inspect_png(path: str | os.PathLike[str]):
    """Return a stable list of PNG-integrity findings for ``path``."""
    png = Path(path)
    if not png.is_file():
        return [{"code": "export.png.missing", "message": f"PNG output was not created: {png}"}]
    data = png.read_bytes()
    findings = []
    if not data:
        findings.append({"code": "export.png.empty", "message": f"PNG output is empty: {png}"})
        return findings
    if not data.startswith(PNG_SIGNATURE):
        findings.append({"code": "export.png.signature", "message": "PNG signature is missing or invalid"})
    if not data.endswith(PNG_IEND):
        findings.append({"code": "export.png.iend", "message": "PNG does not end with a complete IEND chunk"})
    return findings


def _report(status: str, findings: list[dict], **details):
    result = {
        "report_version": 1,
        "summary": {"status": status, "errors": len(findings)},
        "findings": [
            {
                "layer": "export",
                "severity": "error",
                "path": "/export",
                **finding,
            }
            for finding in findings
        ],
    }
    result.update(details)
    return result


def _print_report(report: dict, as_json: bool):
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return
    for finding in report["findings"]:
        print(f"error: [{finding['code']}] {finding['message']}", file=sys.stderr)
    if report["summary"]["status"] == "passed":
        print(f"export smoke passed: {report['output']} ({report['bytes']} bytes)")


def run_export(input_path: str, output_path: str, executable: str):
    command = [
        executable,
        "--export",
        "--format",
        "png",
        "--output",
        output_path,
        input_path,
    ]
    try:
        proc = subprocess.run(command, text=True, capture_output=True, check=False)
    except OSError as exc:
        return None, command, str(exc)
    return proc, command, None


def main(argv=None):
    parser = argparse.ArgumentParser(description="Locally export .drawio to PNG and verify PNG framing.")
    parser.add_argument("input", help="source .drawio file")
    parser.add_argument("-o", "--output", help="PNG path; omitted output is checked in a temporary directory")
    parser.add_argument("--drawio", help=f"draw.io CLI executable (overrides {ENV_NAME} and discovery)")
    parser.add_argument("--json", action="store_true", help="print a machine-readable report")
    args = parser.parse_args(argv)

    source = os.path.abspath(args.input)
    if not os.path.isfile(source):
        report = _report(
            "failed",
            [{"code": "export.source.missing", "message": f"draw.io source does not exist: {source}"}],
            source=source,
        )
        _print_report(report, args.json)
        return 1

    executable, discovery_source, configured = discover_drawio(args.drawio)
    if executable is None:
        detail = f"configured value {configured!r} is not executable" if configured else "no draw.io CLI was discovered"
        report = _report(
            "unavailable",
            [{
                "code": "export.cli.unavailable",
                "message": (
                    f"{detail}; install draw.io Desktop or set {ENV_NAME}=/path/to/drawio "
                    "(or pass --drawio /path/to/drawio)"
                ),
            }],
            source=source,
            discovery=discovery_source,
        )
        _print_report(report, args.json)
        return 2

    temporary = tempfile.TemporaryDirectory() if args.output is None else None
    try:
        output = os.path.abspath(args.output) if args.output else os.path.join(temporary.name, "export.png")
        os.makedirs(os.path.dirname(output), exist_ok=True)
        proc, command, launch_error = run_export(source, output, executable)
        if launch_error is not None:
            findings = [{"code": "export.command.launch", "message": f"cannot launch draw.io CLI: {launch_error}"}]
        elif proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "no diagnostic output").strip()
            findings = [{
                "code": "export.command.failed",
                "message": f"draw.io CLI exited with {proc.returncode}: {detail}",
            }]
        else:
            findings = inspect_png(output)
        report = _report(
            "failed" if findings else "passed",
            findings,
            source=source,
            output=output,
            bytes=os.path.getsize(output) if os.path.isfile(output) else 0,
            executable=executable,
            discovery=discovery_source,
            command=command,
        )
        _print_report(report, args.json)
        return 1 if findings else 0
    finally:
        if temporary is not None:
            temporary.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
