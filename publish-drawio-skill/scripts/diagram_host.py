#!/usr/bin/env python3
"""Deterministic extension-host entry points for corporate GigaCode commands."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import jsonschema

import agent_runtime
import command_ux
import diagram_supervisor as supervisor
import lifecycle_host_v2 as lifecycle_v2
from diagram_model_v2 import validate_diagramspec, with_model_view
from lifecycle_contracts import (
    ContractError,
    atomic_write_bytes,
    canonical_json_bytes,
    require_valid_contract,
)
from run_lock_v2 import RunAlreadyLocked, RunLock


ROOT = Path(__file__).resolve().parent.parent
RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def utc_slug():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"review-{stamp}-{uuid.uuid4().hex[:8]}"


def write_review_workflow(run_dir, workflow):
    workflow["updated_at"] = supervisor.utc_now()
    supervisor.write_json(Path(run_dir) / "workflow.json", workflow)


def require_workspace_artifact(workspace, artifact):
    workspace = Path(workspace).expanduser().resolve()
    artifact = Path(artifact).expanduser().resolve()
    if not workspace.is_dir():
        raise supervisor.SupervisorError(f"workspace is not a directory: {workspace}")
    if not artifact.is_file():
        raise supervisor.SupervisorError(f"diagram artifact is not a file: {artifact}")
    if artifact.suffix.lower() != ".drawio":
        raise supervisor.SupervisorError("review requires a .drawio artifact")
    if not supervisor._is_within(artifact, workspace):
        raise supervisor.SupervisorError("diagram artifact must be inside the current workspace")
    return workspace, artifact


def audit_input(run_dir, artifact, spec_path, report_path, receipt_path):
    spec = supervisor.load_json(spec_path)
    report = supervisor.load_json(report_path)
    receipt = supervisor.load_json(receipt_path)
    verification = supervisor.verify_receipt(receipt_path, artifact)
    if not verification["valid"]:
        raise supervisor.SupervisorError(
            f"review audit receipt evidence failed: {verification['checks']}"
        )
    result = {
        "schema_version": 1,
        "review_kind": "baseline_audit",
        "run_id": receipt["run_id"],
        "artifact": {
            "path": str(artifact),
            "sha256": supervisor.sha256_file(artifact),
        },
        "spec": {
            "path": str(spec_path),
            "sha256": supervisor.sha256_file(spec_path),
            "content": spec,
        },
        "report": {
            "path": str(report_path),
            "sha256": supervisor.sha256_file(report_path),
            "content": report,
        },
        "receipt": {
            "path": str(receipt_path),
            "sha256": supervisor.sha256_file(receipt_path),
            "content": receipt,
        },
        "strict_passed": verification["passed"],
        "context": {
            "source_refs": spec.get("source_refs", []),
            "requested_reviewer_model": supervisor.load_json(
                ROOT / "data" / "model-routing.default.json"
            )["roles"]["reviewer"]["requested_model"],
        },
    }
    schema = supervisor.load_json(ROOT / "data" / "reviewer-audit-input.v1.schema.json")
    jsonschema.Draft202012Validator(
        schema, format_checker=jsonschema.FormatChecker()
    ).validate(result)
    return result


def _v1_spec_to_v2(run_dir, spec):
    pages = []
    for page in spec["pages"]:
        page_id = page["id"]
        cells = []
        for cell in page["cells"]:
            cell_id = cell["id"]
            technical = cell_id in {"0", "1"} or cell["kind"] == "layer"

            def identity(value):
                return None if value is None else {"page_id": page_id, "cell_id": value}

            value = {
                "id": cell_id,
                "stable_identity": {"page_id": page_id, "cell_id": cell_id},
                "kind": "root" if cell_id == "0" else cell["kind"],
                "semantic_type": cell["semantic_type"],
                "label": cell["label"],
                "technical": technical,
                "parent": identity(cell.get("parent_id")),
                "source": identity(cell.get("source_id")),
                "target": identity(cell.get("target_id")),
                "relationship": cell.get("relationship"),
                "style": cell.get("style", ""),
                "raw_attributes": {},
            }
            cells.append(value)
        pages.append({"id": page_id, "name": page.get("name", ""), "cells": cells})
    artifact_path = Path(spec["artifact"]["uri"]).resolve()
    result = with_model_view({
        "schema_version": 2,
        "diagram_id": spec["diagram_id"],
        "title": spec.get("title", spec["diagram_id"]),
        "artifact": {
            "path": artifact_path.relative_to(Path(run_dir).resolve()).as_posix(),
            "sha256": spec["artifact"]["sha256"],
            "byte_length": spec["artifact"]["byte_length"],
            "format": spec["artifact"]["format"],
            "imported_at": spec["artifact"]["imported_at"],
            "preservation_policy": "patch-original-xml",
        },
        "source_bundle_sha256": None,
        "pages": pages,
        "model_view": {"technical_cells_excluded": True, "pages": []},
        "semantic_digest": {
            "algorithm": "sha256", "canonicalization": "diagramspec-model-view-v2",
            "value": "0" * 64,
        },
    })
    diagnostics = validate_diagramspec(result)
    if diagnostics:
        raise supervisor.SupervisorError(f"review DiagramSpec v2 failed: {diagnostics[0]}")
    return result


def _document(run_dir, path):
    descriptor = lifecycle_v2.make_file_descriptor(path, root=run_dir)
    return {
        "path": descriptor["path"], "sha256": descriptor["sha256"],
        "content": supervisor.load_json(path),
    }


def _reviewer_input_v2(run_dir, workflow, artifact, spec_path, report_path, receipt_path):
    receipt_verification = lifecycle_v2.verify_v2_receipt(run_dir, receipt_path)
    if not receipt_verification["valid"]:
        raise supervisor.SupervisorError(
            f"review receipt v2 failed before model call: {receipt_verification['diagnostics']}"
        )
    receipt = supervisor.load_json(receipt_path)
    source_bundle, source_descriptor = lifecycle_v2.latest_document(run_dir, "source-bundle")
    value = {
        "schema_version": 2,
        "run_id": workflow["run_id"],
        "review_kind": "baseline_audit",
        "baseline": None,
        "candidate": {
            "artifact": lifecycle_v2.make_file_descriptor(artifact, root=run_dir),
            "report": _document(run_dir, report_path),
            "receipt": _document(run_dir, receipt_path),
            "strict_passed": receipt_verification["strict_passed"],
        },
        "baseline_spec": None,
        "candidate_spec": _document(run_dir, spec_path),
        "patch": None,
        "semantic_plan": None,
        "semantic_delta": None,
        "source_bundle": {
            "path": source_descriptor["path"],
            "sha256": source_descriptor["sha256"],
            "content": source_bundle,
        },
        "comparison": None,
        "model_resolutions": [],
        # Transitional read-only aliases keep the proven standalone reviewer
        # adapter working.  They are host-derived copies; reviewer identity and
        # final evidence bindings remain absent and host-owned.
        "artifact": {
            "path": str(Path(artifact).resolve()),
            "sha256": supervisor.sha256_file(artifact),
        },
        "spec": {
            "path": str(Path(spec_path).resolve()),
            "sha256": supervisor.sha256_file(spec_path),
            "content": supervisor.load_json(spec_path),
        },
        "report": {
            "path": str(Path(report_path).resolve()),
            "sha256": supervisor.sha256_file(report_path),
            "content": supervisor.load_json(report_path),
        },
        "receipt": {
            "path": str(Path(receipt_path).resolve()),
            "sha256": supervisor.sha256_file(receipt_path),
            "content": supervisor.load_json(receipt_path),
        },
        "strict_passed": receipt_verification["strict_passed"],
        "context": {
            "source_refs": [],
            "requested_reviewer_model": supervisor.load_json(
                ROOT / "data" / "model-routing.default.json"
            )["roles"]["reviewer"]["requested_model"],
        },
    }
    require_valid_contract(value, "reviewer-input", 2)
    return value


def _bind_reviewer_v2(run_dir, workflow, analysis, runtime, input_path, output_path, artifact, report, receipt):
    require_valid_contract(analysis, "reviewer-analysis", 2)
    metadata = runtime.get("runtime_metadata") or {}
    resolution = runtime["resolution"]
    compatibility_adapter = not runtime.get("runtime_capture")
    reported_model = metadata.get("reported_model") or (
        resolution.get("resolved_model") if compatibility_adapter else None
    )
    isolation_proof = metadata.get("isolation_proof") or (
        {"verified": True, "tool_calls": 0} if compatibility_adapter else {}
    )
    if not all((
        (metadata.get("model_proof") or {}).get("verified") is True,
        isolation_proof.get("verified") is True,
        reported_model == resolution.get("resolved_model"),
        resolution.get("resolution_mode") == "isolated_cli",
    )):
        raise supervisor.SupervisorError("Reviewer v2 runtime proof is invalid")
    if analysis["verdict"] == "approve" and any(
        item["severity"] == "error" for item in analysis["findings"]
    ):
        raise supervisor.SupervisorError("Reviewer cannot approve with error findings")
    source_hash = lifecycle_v2.require_mutable(run_dir)["latest_snapshots"]["source-bundle"]["canonical_sha256"]
    value = {
        "schema_version": 2,
        "verdict_id": "verdict-" + hashlib.sha256(
            f"{workflow['run_id']}:{analysis['analysis_id']}:{supervisor.sha256_file(artifact)}".encode("utf-8")
        ).hexdigest()[:24],
        "analysis_id": analysis["analysis_id"],
        "run_id": workflow["run_id"],
        "analysis_sha256": supervisor.sha256_file(output_path),
        "role_input_sha256": supervisor.sha256_file(input_path),
        "role_output_sha256": supervisor.sha256_file(output_path),
        "bindings": {
            "candidate_sha256": supervisor.sha256_file(artifact),
            "report_sha256": supervisor.sha256_file(report),
            "receipt_sha256": supervisor.sha256_file(receipt),
            "source_bundle_sha256": source_hash,
            "semantic_plan_sha256": None,
            "semantic_delta_sha256": None,
        },
        "runtime_proof": {
            "requested_model": resolution["requested_model"],
            "resolved_model": resolution["resolved_model"],
            "provider": resolution.get("provider") or (
                "vllm" if str(resolution["resolved_model"]).startswith("vllm/") else "gigacode"
            ),
            "resolution_mode": resolution["resolution_mode"],
            "attempt_id": runtime.get("attempt_id") or Path(output_path).parent.name,
            "evidence_sha256": supervisor.sha256_file(
                runtime.get("runtime_capture") or output_path
            ),
        },
        "verdict": analysis["verdict"],
        "reviewed_at": analysis["reviewed_at"],
        "findings": copy.deepcopy(analysis["findings"]),
    }
    require_valid_contract(value, "reviewer-verdict", 2)
    path = Path(output_path).with_name("verdict.v2.json")
    atomic_write_bytes(path, canonical_json_bytes(value) + b"\n")
    return value, path


def run_review(artifact, workspace, cli, *, run_id=None, profile=None, source=None, timeout=600):
    workspace, artifact = require_workspace_artifact(workspace, artifact)
    run_id = run_id or utc_slug()
    if not RUN_ID_RE.fullmatch(run_id):
        raise supervisor.SupervisorError("run-id must be an opaque slug")
    run_dir = (workspace / ".diagram-runs" / run_id).resolve()
    if run_dir.exists():
        raise supervisor.SupervisorError(f"run directory already exists: {run_dir}")
    try:
        with RunLock(workspace=workspace, run_dir=run_dir, run_id=run_id) as run_lock:
            try:
                return _run_review_impl(
                    artifact, workspace, cli, run_id=run_id,
                    profile=profile, source=source, timeout=timeout,
                    lock_recoveries=run_lock.recovery_records,
                )
            except Exception as exc:
                if run_dir.is_dir():
                    supervisor.write_json(run_dir / "host-result.json", {
                        "schema_version": 2,
                        "mode": "review",
                        "status": "error",
                        "run_id": run_id,
                        "run_dir": str(run_dir),
                        "message": str(exc),
                    })
                raise
    except RunAlreadyLocked as exc:
        raise supervisor.SupervisorError(json.dumps(exc.as_result(), ensure_ascii=False)) from exc


def _run_review_impl(
    artifact, workspace, cli, *, run_id, profile=None, source=None, timeout=600,
    lock_recoveries=(),
):
    run_dir = (workspace / ".diagram-runs" / run_id).resolve()
    if any(path.name != ".run-lock" for path in run_dir.iterdir()):
        raise supervisor.SupervisorError(f"run directory already exists: {run_dir}")

    original_sha256 = supervisor.sha256_file(artifact)
    preflight = supervisor.host_preflight(workspace, run_dir, cli)
    workflow = {
        "schema_version": 1,
        "run_id": preflight["run_id"],
        "mode": "review",
        "workspace": str(workspace),
        "target": str(artifact),
        "request": "Read-only deterministic validation and independent review",
        "status": "running",
        "created_at": supervisor.utc_now(),
        "checkpoint": None,
    }
    write_review_workflow(run_dir, workflow)
    lifecycle_v2.initialize(
        run_dir=run_dir, workspace=workspace, target=artifact,
        run_id=preflight["run_id"], mode="review", request=workflow["request"],
        extension_root=ROOT,
    )
    lifecycle_v2.record_lock_recovery(run_dir, lock_recoveries)
    reviewed_copy = run_dir / "inputs" / "reviewed.drawio"
    atomic_write_bytes(reviewed_copy, artifact.read_bytes())
    spec_path = run_dir / "diagram-spec.json"
    spec_v1 = supervisor.make_spec(reviewed_copy)
    supervisor.write_json(spec_path, spec_v1)
    source_hash = lifecycle_v2.require_mutable(run_dir)["latest_snapshots"]["source-bundle"]["canonical_sha256"]
    spec_v2 = _v1_spec_to_v2(run_dir, spec_v1)
    spec_v2["source_bundle_sha256"] = source_hash
    spec_v2_path = run_dir / "diagram-spec.v2.json"
    atomic_write_bytes(spec_v2_path, canonical_json_bytes(spec_v2) + b"\n")
    supervisor.transition(run_dir, "analyzed", artifact=reviewed_copy)
    receipt = supervisor.run_validation(
        reviewed_copy, run_dir, profile=profile, source=source, attempt_id="baseline"
    )
    report_path = run_dir / "attempts" / "baseline" / "validation-report.json"
    receipt_path = run_dir / "attempts" / "baseline" / "validation-receipt.json"
    _, receipt_v2_path = lifecycle_v2.mirror_validation_receipt(
        run_dir, legacy_receipt_path=receipt_path,
    )
    receipt_v2_verification = lifecycle_v2.verify_v2_receipt(run_dir, receipt_v2_path)
    if not receipt_v2_verification["valid"]:
        raise supervisor.SupervisorError(
            f"review validation receipt v2 failed: {receipt_v2_verification['diagnostics']}"
        )
    workflow["accepted_artifact"] = {
        "path": str(reviewed_copy),
        "sha256": original_sha256,
    }
    workflow["accepted_validation"] = {
        "report": str(report_path),
        "report_sha256": supervisor.sha256_file(report_path),
        "receipt": str(receipt_path),
        "receipt_sha256": supervisor.sha256_file(receipt_path),
        "strict_passed": receipt["result"] == "passed",
    }
    workflow["validation_receipt_v2"] = {
        "path": str(receipt_v2_path), "sha256": supervisor.sha256_file(receipt_v2_path),
    }
    evidence = {
        "imported_diagramspec": lifecycle_v2.make_file_descriptor(spec_v2_path, root=run_dir),
        "baseline_validation": {
            "artifact": lifecycle_v2.make_file_descriptor(reviewed_copy, root=run_dir),
            "report": lifecycle_v2.make_file_descriptor(report_path, root=run_dir),
            "receipt": lifecycle_v2.make_file_descriptor(receipt_v2_path, root=run_dir),
        },
        "eligible_review_handoff": None,
    }
    lifecycle_v2.revise_sources(
        run_dir, evidence=evidence,
        event_payload={"kind": "review_baseline", "artifact_sha256": original_sha256},
    )
    lifecycle_v2.transition(
        run_dir, "reviewing",
        accepted_artifact=lifecycle_v2.make_file_descriptor(reviewed_copy, root=run_dir),
        validation_report=lifecycle_v2.make_file_descriptor(report_path, root=run_dir),
        validation_receipt=lifecycle_v2.make_file_descriptor(receipt_v2_path, root=run_dir),
        payload={"read_only_review": True},
    )
    write_review_workflow(run_dir, workflow)
    reviewer_input_path = run_dir / "reviewer-audit-input.v2.json"
    supervisor.write_json(
        reviewer_input_path,
        _reviewer_input_v2(
            run_dir, workflow, reviewed_copy, spec_v2_path, report_path, receipt_v2_path,
        ),
    )
    # Keep the v1 read-only audit artifact for trace/manual-handoff consumers;
    # it is not the v2 role input or source of final Reviewer identity.
    legacy_reviewer_input_path = run_dir / "reviewer-audit-input.json"
    supervisor.write_json(
        legacy_reviewer_input_path,
        audit_input(run_dir, reviewed_copy, spec_path, report_path, receipt_path),
    )
    reviewer_output_path = run_dir / "reviewer-analysis.v2.json"

    try:
        runtime = agent_runtime.invoke_role(
            "reviewer",
            reviewer_input_path,
            reviewer_output_path,
            cli=str(Path(cli).expanduser()),
            run_dir=run_dir,
            timeout=timeout,
            cwd=workspace,
        )
        raw_analysis = supervisor.load_json(reviewer_output_path)
        reviewer_input_value = supervisor.load_json(reviewer_input_path)
        compatibility_output_path = None
        compatibility_binding = None
        if raw_analysis.get("schema_version") == 1:
            expected = {
                "run_id": reviewer_input_value["run_id"],
                "candidate_sha256": reviewer_input_value["artifact"]["sha256"],
                "report_sha256": reviewer_input_value["report"]["sha256"],
                "receipt_sha256": reviewer_input_value["receipt"]["sha256"],
            }
            declared_mismatches = sorted(
                key for key, value in expected.items()
                if key in raw_analysis and raw_analysis.get(key) != value
            )
            compatibility_value = {
                key: raw_analysis[key]
                for key in ("schema_version", "verdict_id", "verdict", "reviewed_at", "findings")
            }
            if "reviewer" in raw_analysis:
                compatibility_value["reviewer"] = raw_analysis["reviewer"]
            compatibility_value.update(expected)
            compatibility_output_path = run_dir / "reviewer-verdict.json"
            supervisor.write_json(compatibility_output_path, compatibility_value)
            compatibility_binding = {
                "verified": True,
                "source": "host-derived-v1-compatibility",
                "declared_mismatches": declared_mismatches,
                "expected": expected,
            }
        validated_analysis = agent_runtime.validate_role_output(
            "reviewer", raw_analysis, reviewer_input_value,
        )
        analysis, direct_binding = agent_runtime.finalize_role_output(
            "reviewer", reviewer_input_value, validated_analysis,
        )
        if direct_binding is not None:
            runtime.setdefault("runtime_metadata", {})["binding_proof"] = direct_binding
        if analysis != raw_analysis:
            supervisor.write_json(reviewer_output_path, analysis)
        verdict, verdict_path = _bind_reviewer_v2(
            run_dir, workflow, analysis, runtime, reviewer_input_path,
            reviewer_output_path, reviewed_copy, report_path, receipt_v2_path,
        )
        host_binding_proof = {
            "verified": True,
            "source": "host-bound-reviewer-verdict-v2",
            "verdict": {
                "path": str(verdict_path.resolve()),
                "sha256": supervisor.sha256_file(verdict_path),
            },
            "analysis_id": verdict["analysis_id"],
            "analysis_sha256": verdict["analysis_sha256"],
            "role_input_sha256": verdict["role_input_sha256"],
            "role_output_sha256": verdict["role_output_sha256"],
            "bindings": copy.deepcopy(verdict["bindings"]),
            "runtime_evidence_sha256": verdict["runtime_proof"]["evidence_sha256"],
        }
        source_bundle = lifecycle_v2.latest_document(run_dir, "source-bundle")[0]
        review_evidence = copy.deepcopy(source_bundle["evidence"])
        review_evidence["eligible_review_handoff"] = {
            "artifact": lifecycle_v2.make_file_descriptor(reviewed_copy, root=run_dir),
            "report": lifecycle_v2.make_file_descriptor(report_path, root=run_dir),
            "receipt": lifecycle_v2.make_file_descriptor(receipt_v2_path, root=run_dir),
            "verdict": lifecycle_v2.make_file_descriptor(verdict_path, root=run_dir),
            "findings_sha256": supervisor.canonical_hash(verdict["findings"]),
        }
        lifecycle_v2.revise_sources(
            run_dir, evidence=review_evidence,
            event_payload={"kind": "review_handoff", "verdict": verdict["verdict"]},
        )
        lifecycle_v2.transition(
            run_dir, "final_review",
            accepted_artifact=lifecycle_v2.make_file_descriptor(reviewed_copy, root=run_dir),
            validation_report=lifecycle_v2.make_file_descriptor(report_path, root=run_dir),
            validation_receipt=lifecycle_v2.make_file_descriptor(receipt_v2_path, root=run_dir),
            reviewer_verdict=lifecycle_v2.make_file_descriptor(verdict_path, root=run_dir),
            payload={"read_only_review": True, "verdict": verdict["verdict"]},
        )
        reviewer = {
            "status": "completed",
            "verdict": verdict["verdict"],
            "findings": verdict["findings"],
            "requested_model": runtime["resolution"]["requested_model"],
            "resolved_model": runtime["resolution"]["resolved_model"],
            "resolution_mode": runtime["resolution"]["resolution_mode"],
            "fallback_used": runtime["resolution"]["fallback_used"],
            "model_proof": runtime["runtime_metadata"]["model_proof"],
            "binding_proof": host_binding_proof,
            "output": str(compatibility_output_path or verdict_path),
            "analysis": str(reviewer_output_path),
            "verdict_v2": str(verdict_path),
        }
    except agent_runtime.RoleOutputContractError as exc:
        reviewer = {
            "status": "failed",
            "error": str(exc),
            "requested_model": exc.resolution["requested_model"],
            "resolved_model": exc.resolution["resolved_model"],
            "resolution_mode": exc.resolution["resolution_mode"],
            "fallback_used": exc.resolution["fallback_used"],
            "model_proof": exc.runtime_metadata["model_proof"],
            "reported_model": exc.runtime_metadata.get("reported_model"),
            "runtime_version": exc.runtime_metadata.get("runtime_version"),
            "invalid_output_sha256": exc.invalid_output_sha256,
        }
    except (OSError, json.JSONDecodeError, supervisor.SupervisorError) as exc:
        reviewer = {
            "status": "failed",
            "error": str(exc),
            "requested_model": supervisor.load_json(
                ROOT / "data" / "model-routing.default.json"
            )["roles"]["reviewer"]["requested_model"],
        }

    if supervisor.sha256_file(artifact) != original_sha256:
        raise supervisor.SupervisorError("source diagram changed during read-only review")
    if reviewer.get("status") != "completed":
        lifecycle_v2.transition(
            run_dir, "final_review",
            accepted_artifact=lifecycle_v2.make_file_descriptor(reviewed_copy, root=run_dir),
            validation_report=lifecycle_v2.make_file_descriptor(report_path, root=run_dir),
            validation_receipt=lifecycle_v2.make_file_descriptor(receipt_v2_path, root=run_dir),
            last_error={
                "code": "reviewer.failed", "message": reviewer.get("error", "Reviewer failed"),
                "recoverable": True, "evidence_path": None,
            },
            payload={"read_only_review": True, "reviewer_status": "failed"},
        )
    supervisor.transition(run_dir, "final_review", artifact=artifact)
    validation_passed = receipt["result"] == "passed"
    reviewer_passed = reviewer.get("status") == "completed" and reviewer.get("verdict") == "approve"
    workflow["status"] = "passed" if validation_passed and reviewer_passed else "findings"
    write_review_workflow(run_dir, workflow)
    result = {
        "schema_version": 1,
        "mode": "review",
        "status": "passed" if validation_passed and reviewer_passed else "findings",
        "run_id": preflight["run_id"],
        "run_dir": str(run_dir),
        "artifact": {"path": str(artifact), "sha256": original_sha256, "modified": False},
        "validation": {
            "passed": validation_passed,
            "exit_code": receipt["exit_code"],
            "summary": supervisor.load_json(report_path).get("summary", {}),
            "report": str(report_path),
            "receipt": str(receipt_path),
        },
        "reviewer": reviewer,
        "evidence": {
            "host_preflight": str(run_dir / "host-preflight.json"),
            "manifest": str(run_dir / "run-manifest.jsonl"),
            "manifest_v2": str(lifecycle_v2.manifest_path(run_dir)),
            "diagram_spec": str(spec_path),
            "diagram_spec_v2": str(spec_v2_path),
            "reviewer_input": str(reviewer_input_path),
            "reviewer_input_v1_compatibility": str(legacy_reviewer_input_path),
            "reviewer_verdict": reviewer.get("verdict_v2"),
            "validation_receipt_v2": str(receipt_v2_path),
            "workflow": str(run_dir / "workflow.json"),
        },
        "next_action": (
            "user_final_review"
            if validation_passed and reviewer_passed
            else "inspect_findings_before_any_repair"
        ),
        "improve_handoff": {
            "diagram": str(artifact),
            "artifact_sha256": original_sha256,
            "default_request": command_ux.DEFAULT_IMPROVE_REQUEST,
            "reviewer_verdict_v2": reviewer.get("verdict_v2"),
            "review_findings": reviewer.get("findings", []),
            "validation_report": str(report_path),
            "validation_receipt_v2": str(receipt_v2_path),
        },
    }
    supervisor.write_json(run_dir / "host-result.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description="Deterministic Draw.io extension command host")
    sub = parser.add_subparsers(dest="command", required=True)
    review = sub.add_parser("review", help="run strict validation and isolated independent review")
    review.add_argument("artifact_positional", nargs="?")
    review.add_argument("--artifact")
    review.add_argument("--workspace", default=str(Path.cwd()))
    review.add_argument("--cli", default=str(Path.home() / ".gigacode/bin/gigacode"))
    review.add_argument("--run-id")
    review.add_argument("--profile", choices=("roadmap", "gitflow"))
    review.add_argument("--source")
    review.add_argument("--timeout", type=int, default=600)
    try:
        args = parser.parse_args(command_ux.argv_with_qwen_command_args())
        artifact, selection = command_ux.select_diagram(
            args.workspace, args.artifact or args.artifact_positional,
        )
        result = run_review(
            artifact,
            args.workspace,
            args.cli,
            run_id=args.run_id,
            profile=args.profile,
            source=args.source,
            timeout=args.timeout,
        )
        result["command_resolution"] = {
            "workspace": str(command_ux.workspace_path(args.workspace)),
            "diagram": str(artifact),
            "diagram_selection": selection,
        }
        result["next_commands"] = {
            "improve": "/drawio:improve",
            "improve_explicit": (
                "/drawio:improve --diagram "
                f"{command_ux.quote_command_value(artifact)} --request "
                f"{command_ux.quote_command_value(command_ux.DEFAULT_IMPROVE_REQUEST)}"
            ),
            "trace": (
                "/drawio:trace --run "
                f"{command_ux.quote_command_value(result['run_id'])}"
            ),
        }
        supervisor.write_json(Path(result["run_dir"]) / "host-result.json", result)
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    except (OSError, ValueError, json.JSONDecodeError, supervisor.SupervisorError) as exc:
        print(
            json.dumps(command_ux.error_result(exc), ensure_ascii=False),
            file=sys.stderr,
        )
        raise SystemExit(2)


if __name__ == "__main__":
    main()
