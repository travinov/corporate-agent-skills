#!/usr/bin/env python3
"""Frozen semantic-plan.v2 adapter for the existing sequence layout engine."""
from __future__ import annotations

import os
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import seqlayout
from diagram_model_v2 import validate_semantic_plan
from lifecycle_contracts import require_valid_contract


class SequenceAdapterError(RuntimeError):
    """A semantic plan cannot be represented by the frozen sequence engine."""


def semantic_plan_to_sequence(semantic_plan: Mapping[str, Any]) -> dict:
    """Translate one sequence page without changing participant/message order."""
    try:
        require_valid_contract(semantic_plan, "semantic-plan", 2)
    except Exception as exc:
        raise SequenceAdapterError(f"invalid semantic plan: {exc}") from exc
    diagnostics = validate_semantic_plan(semantic_plan)
    if diagnostics:
        first = diagnostics[0]
        raise SequenceAdapterError(
            f"invalid semantic plan: {first['code']}: {first['message']}"
        )
    result = semantic_plan["result"]
    if result["diagram_type"] != "sequence":
        raise SequenceAdapterError("sequence adapter requires diagram_type 'sequence'")
    if len(result["pages"]) != 1:
        raise SequenceAdapterError("sequence adapter requires exactly one semantic page")
    page = result["pages"][0]
    participants = [
        {
            "id": node["stable_identity"]["cell_id"],
            "label": node["label"],
            "actor": node["semantic_type"] in {"actor", "person"},
        }
        for node in page["nodes"]
    ]
    participant_ids = {participant["id"] for participant in participants}
    if len(participant_ids) != len(participants):
        raise SequenceAdapterError("sequence participants require unique stable identities")
    messages = []
    for index, edge in enumerate(page["edges"]):
        source, target = edge["source"], edge["target"]
        if source["page_id"] != page["page_id"] or target["page_id"] != page["page_id"]:
            raise SequenceAdapterError(f"sequence message {index} crosses a page boundary")
        if source["cell_id"] not in participant_ids or target["cell_id"] not in participant_ids:
            raise SequenceAdapterError(
                f"sequence message {index} references an unknown participant"
            )
        messages.append(
            {
                "from": source["cell_id"],
                "to": target["cell_id"],
                "label": edge["label"],
                "return": edge["relationship"] == "return",
                "async": edge["relationship"] == "async",
            }
        )
    return {
        "title": result["title"],
        "participants": participants,
        "messages": messages,
    }


def render_sequence(semantic_plan: Mapping[str, Any], output: str | Path) -> Path:
    """Render with ``seqlayout`` and publish atomically without clobbering."""
    spec = semantic_plan_to_sequence(semantic_plan)
    payload = seqlayout.layout(spec).encode("utf-8")
    target = Path(output).expanduser().resolve()
    if target.suffix.lower() != ".drawio":
        raise SequenceAdapterError("sequence output must use the .drawio suffix")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise SequenceAdapterError(f"refusing to overwrite existing output: {target}")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile("wb", dir=target.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.link(temporary, target)
        except FileExistsError as exc:
            raise SequenceAdapterError(f"refusing to overwrite existing output: {target}") from exc
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return target


__all__ = ["SequenceAdapterError", "render_sequence", "semantic_plan_to_sequence"]
