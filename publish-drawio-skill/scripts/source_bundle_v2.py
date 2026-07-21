#!/usr/bin/env python3
"""Immutable source-bundle construction for diagram lifecycle v2.

The module accepts sources explicitly passed by its caller.  It deliberately
contains no repository search or OpenSpec discovery path.
"""
from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any, Iterable

from lifecycle_contracts import canonical_json_sha256, require_valid_contract


SOURCE_PRIORITY = (
    "explicit_user_decision",
    "confirmed_clarification",
    "original_user_request",
    "explicit_user_document",
    "existing_diagram",
    "agent_assumption",
)
SOURCE_KINDS = frozenset(SOURCE_PRIORITY)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def source_record(
    *,
    source_id: str,
    kind: str,
    uri: str,
    content: Any,
    revision: str | None = None,
    fragment: str | None = None,
    confidence: float = 1.0,
) -> dict[str, Any]:
    if kind not in SOURCE_KINDS:
        raise ValueError(f"unsupported explicit source kind: {kind}")
    if kind == "explicit_user_document" and not uri:
        raise ValueError("explicit user documents require a caller-supplied URI")
    return {
        "source_id": source_id,
        "kind": kind,
        "uri": uri,
        "revision": revision,
        "fragment": fragment,
        "content_sha256": canonical_json_sha256(content),
        "confidence": confidence,
        "content": copy.deepcopy(content),
    }


def _default_evidence() -> dict[str, None]:
    return {
        "imported_diagramspec": None,
        "baseline_validation": None,
        "eligible_review_handoff": None,
    }


def build_source_bundle(
    *,
    bundle_id: str,
    run_id: str,
    sources: Iterable[dict[str, Any]],
    transaction_id: str,
    evidence: dict[str, Any] | None = None,
    created_at: str | None = None,
    revision: int = 1,
    previous_bundle_sha256: str | None = None,
    previous_snapshot_sha256: str | None = None,
) -> dict[str, Any]:
    records = [copy.deepcopy(item) for item in sources]
    if not records:
        raise ValueError("a source bundle requires at least the original user request")
    document = {
        "schema_version": 2,
        "bundle_id": bundle_id,
        "run_id": run_id,
        "revision": revision,
        "created_at": created_at or utc_now(),
        "source_priority": list(SOURCE_PRIORITY),
        "sources": records,
        "evidence": copy.deepcopy(evidence) if evidence is not None else _default_evidence(),
        "transaction_id": transaction_id,
        "previous_bundle_sha256": previous_bundle_sha256,
        "previous_snapshot_sha256": previous_snapshot_sha256,
    }
    diagnostics = validate_source_bundle(document)
    if diagnostics:
        raise ValueError(diagnostics)
    require_valid_contract(document, "source-bundle", 2)
    return document


def append_source_revision(
    previous: dict[str, Any],
    *,
    new_sources: Iterable[dict[str, Any]],
    transaction_id: str,
    evidence: dict[str, Any] | None = None,
    created_at: str | None = None,
    previous_snapshot_sha256: str | None = None,
) -> dict[str, Any]:
    require_valid_contract(previous, "source-bundle", 2)
    previous_hash = canonical_json_sha256(previous)
    appended = [copy.deepcopy(item) for item in new_sources]
    if not appended and evidence is None:
        raise ValueError("a source-bundle revision must add a source or update evidence")
    return build_source_bundle(
        bundle_id=previous["bundle_id"],
        run_id=previous["run_id"],
        sources=[*previous["sources"], *appended],
        evidence=evidence if evidence is not None else previous["evidence"],
        transaction_id=transaction_id,
        created_at=created_at,
        revision=previous["revision"] + 1,
        previous_bundle_sha256=previous_hash,
        previous_snapshot_sha256=previous_hash if previous_snapshot_sha256 is None else previous_snapshot_sha256,
    )


def validate_source_bundle(document: dict[str, Any]) -> list[dict[str, str]]:
    diagnostics: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, source in enumerate(document.get("sources", [])):
        pointer = f"/sources/{index}"
        source_id = source.get("source_id")
        if source_id in seen:
            diagnostics.append({"code": "source.duplicate_id", "pointer": f"{pointer}/source_id", "message": f"duplicate source_id {source_id!r}"})
        seen.add(source_id)
        if source.get("kind") not in SOURCE_KINDS:
            diagnostics.append({"code": "source.kind_invalid", "pointer": f"{pointer}/kind", "message": "only explicitly supplied source kinds are allowed"})
        try:
            actual_hash = canonical_json_sha256(source.get("content"))
        except (TypeError, ValueError) as exc:
            diagnostics.append({"code": "source.content_invalid", "pointer": f"{pointer}/content", "message": str(exc)})
            continue
        if source.get("content_sha256") != actual_hash:
            diagnostics.append({"code": "source.content_hash_mismatch", "pointer": f"{pointer}/content_sha256", "message": "source content hash does not match canonical content"})
    original_requests = [item for item in document.get("sources", []) if item.get("kind") == "original_user_request"]
    if len(original_requests) != 1:
        diagnostics.append({"code": "source.original_request_count", "pointer": "/sources", "message": "source bundle must contain exactly one original_user_request"})
    if document.get("source_priority") != list(SOURCE_PRIORITY):
        diagnostics.append({"code": "source.priority_invalid", "pointer": "/source_priority", "message": "source priority does not match the product contract"})
    return diagnostics


def source_bundle_sha256(document: dict[str, Any]) -> str:
    require_valid_contract(document, "source-bundle", 2)
    diagnostics = validate_source_bundle(document)
    if diagnostics:
        raise ValueError(diagnostics)
    return canonical_json_sha256(document)
