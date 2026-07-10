#!/usr/bin/env python3
"""Validate versioned git-flow timeline JSON with stable findings."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys

from validation_common import (
    ValidationReport, dispatch_version, messages, print_report, validate_schema,
)


BRANCH_KINDS = {"main", "master", "develop", "feature", "release", "hotfix", "support", "custom"}


def branch_kind(branch):
    kind = str(branch.get("kind", "")).lower()
    label = str(branch.get("label", branch.get("id", ""))).lower()
    bid = str(branch.get("id", "")).lower()
    if kind:
        return kind
    if bid in ("main", "master") or label in ("main", "master"):
        return "main"
    for prefix in ("feature", "release", "hotfix", "support"):
        if bid.startswith(prefix + "_") or label.startswith(prefix + "/"):
            return prefix
    if bid == "develop" or label == "develop":
        return "develop"
    return "custom"


def event_time(event, mode):
    return event.get("at") if mode == "date" else event.get("order")


def normalize_events(spec):
    mode = spec.get("timeMode", "date")
    return [event for _, event in sorted(
        enumerate(spec.get("events", [])),
        key=lambda pair: (event_time(pair[1], mode), pair[0]),
    )]


def event_branch(event):
    if event.get("type") in ("branch", "merge"):
        return event.get("to")
    return event.get("branch")


def _validate_semantics(spec, report):
    branches = spec.get("branches", [])
    events = spec.get("events", [])
    by_branch = {}
    for i, branch in enumerate(branches):
        if not isinstance(branch, dict):
            continue
        bid = branch.get("id")
        if bid in by_branch:
            report.add("references", "error", "reference.branch.duplicate", f"/branches/{i}/id", f"duplicate branch id {bid!r}", bid)
        by_branch[bid] = branch

    by_event = {}
    for i, event in enumerate(events):
        if not isinstance(event, dict):
            continue
        eid = event.get("id")
        if eid in by_event:
            report.add("references", "error", "reference.event.duplicate", f"/events/{i}/id", f"duplicate event id {eid!r}", eid)
        by_event[eid] = event
        for field in ("branch", "from", "to"):
            ref = event.get(field)
            if ref is not None and ref not in by_branch:
                report.add("references", "error", "reference.branch.unknown", f"/events/{i}/{field}", f"event {eid!r} references unknown branch {ref!r} via {field}", eid)
        if event.get("type") in ("branch", "merge") and event.get("from") == event.get("to"):
            code = "gitflow.branch.self" if event.get("type") == "branch" else "gitflow.merge.self"
            message = f"event {eid!r} {'branches' if event.get('type') == 'branch' else 'cannot merge'} into itself"
            report.add("semantics", "error", code, f"/events/{i}/to", message, eid)

    if any(f["severity"] == "error" for f in report.findings):
        return

    normalized = normalize_events(spec)
    original_index = {id(event): i for i, event in enumerate(events)}
    creation = {}
    for event in normalized:
        if event.get("type") == "branch":
            target = event["to"]
            if target in creation:
                i = original_index[id(event)]
                report.add("semantics", "error", "gitflow.branch.duplicate_creation", f"/events/{i}/to", f"branch {target!r} is created more than once", event["id"])
            else:
                creation[target] = event_time(event, spec.get("timeMode", "date"))

    active = {bid for bid in by_branch if bid not in creation}
    created_from = {}
    merged_to = {}
    for event in normalized:
        i = original_index[id(event)]
        etype = event.get("type")
        if etype == "branch":
            if event["from"] not in active:
                report.add("semantics", "error", "gitflow.branch.source_inactive", f"/events/{i}/from", f"source branch {event['from']!r} is used before creation", event["id"])
            active.add(event["to"])
            created_from[event["to"]] = event["from"]
        elif etype == "merge":
            for field in ("from", "to"):
                if event[field] not in active:
                    report.add("semantics", "error", "gitflow.branch.used_before_creation", f"/events/{i}/{field}", f"branch {event[field]!r} is used before creation", event["id"])
            merged_to.setdefault(event["from"], set()).add(event["to"])
        else:
            branch = event.get("branch")
            if branch not in active:
                report.add("semantics", "error", "gitflow.branch.used_before_creation", f"/events/{i}/branch", f"branch {branch!r} is used before creation", event["id"])

    workflow = spec.get("workflow", "git-flow")
    if workflow != "git-flow":
        return
    main = {bid for bid, branch in by_branch.items() if branch_kind(branch) in ("main", "master")}
    develop = {bid for bid, branch in by_branch.items() if branch_kind(branch) == "develop"}
    release = {bid for bid, branch in by_branch.items() if branch_kind(branch) == "release"}
    if not main:
        report.add("semantics", "error", "gitflow.policy.main_required", "/branches", "git-flow requires a main/master production branch")
    if not develop:
        report.add("semantics", "warning", "gitflow.policy.develop_missing", "/branches", "git-flow usually has a develop integration branch; use workflow='custom' when intentional")
    for bid, branch in by_branch.items():
        kind = branch_kind(branch)
        source = created_from.get(bid)
        targets = merged_to.get(bid, set())
        if kind == "feature":
            if source and source not in develop:
                report.add("semantics", "warning", "gitflow.policy.feature_source", f"/branches/{branches.index(branch)}", f"feature branch {bid!r} should branch from develop", bid)
            if targets and not targets & develop:
                report.add("semantics", "warning", "gitflow.policy.feature_target", f"/branches/{branches.index(branch)}", f"feature branch {bid!r} should merge back into develop", bid)
        elif kind == "release":
            if source and source not in develop:
                report.add("semantics", "warning", "gitflow.policy.release_source", f"/branches/{branches.index(branch)}", f"release branch {bid!r} should branch from develop", bid)
            if targets and not targets & main:
                report.add("semantics", "warning", "gitflow.policy.release_main_target", f"/branches/{branches.index(branch)}", f"release branch {bid!r} should merge into main/master", bid)
            if targets and not targets & develop:
                report.add("semantics", "warning", "gitflow.policy.release_develop_target", f"/branches/{branches.index(branch)}", f"release branch {bid!r} should merge back into develop", bid)
        elif kind == "hotfix":
            if source and source not in main:
                report.add("semantics", "warning", "gitflow.policy.hotfix_source", f"/branches/{branches.index(branch)}", f"hotfix branch {bid!r} should branch from main/master", bid)
            if targets and not targets & main:
                report.add("semantics", "warning", "gitflow.policy.hotfix_main_target", f"/branches/{branches.index(branch)}", f"hotfix branch {bid!r} should merge into main/master", bid)
            if targets and not (targets & develop or targets & release):
                report.add("semantics", "warning", "gitflow.policy.hotfix_back_target", f"/branches/{branches.index(branch)}", f"hotfix branch {bid!r} should merge back into develop or active release", bid)


def validate_document(spec, strict=False):
    report = ValidationReport()
    normalized = dispatch_version(spec, "gitflow", report)
    if normalized is not None:
        schema_ok = validate_schema(normalized, "gitflow", report.schema_version, report)
        if schema_ok:
            _validate_semantics(normalized, report)
    return normalized, report.finish(strict=strict)


def validate_spec(spec, strict=False):
    _, report = validate_document(spec, strict=strict)
    return messages(report)


def load_spec(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Validate versioned git-flow diagram JSON.")
    ap.add_argument("input", help="flow JSON file")
    ap.add_argument("--strict", action="store_true", help="treat policy warnings as errors")
    ap.add_argument("--json", action="store_true", help="print the stable machine-readable report")
    args = ap.parse_args(argv)
    try:
        spec = load_spec(args.input)
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"error: cannot read {args.input}: {exc}")
    _, report = validate_document(spec, strict=args.strict)
    print_report(report, as_json=args.json)
    return 1 if report["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
