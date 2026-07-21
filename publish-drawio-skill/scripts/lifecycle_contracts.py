#!/usr/bin/env python3
"""Strict versioned lifecycle contracts and atomic snapshot primitives.

This module is intentionally independent from the v1 orchestrator.  New mutable
runs use the v2 contracts, while trace and manual-handoff callers may inspect a
v1 document without silently upgrading or rewriting it.
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import jsonschema


EXTENSION_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = EXTENSION_ROOT / "data"
CONTROL_PLANE_KINDS = frozenset(
    {
        "workflow",
        "run-state",
        "checkpoint",
        "decision",
        "publication-transaction",
        "source-bundle",
    }
)
READ_ONLY_V1_PURPOSES = frozenset({"trace", "manual_handoff"})
MUTABLE_PURPOSES = frozenset({"create", "improve", "resume", "mutate", "publish"})


def json_pointer(parts: Iterable[Any]) -> str:
    encoded = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "" if not encoded else "/" + "/".join(encoded)


def canonical_json_bytes(value: Any) -> bytes:
    """Return the stable UTF-8 representation used by all v2 JSON hashes."""
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def canonical_json_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def file_sha256(path: os.PathLike[str] | str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def contained_path(root: os.PathLike[str] | str, candidate: os.PathLike[str] | str) -> Path:
    """Resolve *candidate* and require it to remain under *root*.

    Relative candidates are interpreted below root.  The function resolves
    symlinks in existing ancestors, so a symlink escape is rejected too.
    """
    root_path = Path(root).expanduser().resolve()
    candidate_path = Path(candidate).expanduser()
    if not candidate_path.is_absolute():
        candidate_path = root_path / candidate_path
    resolved = candidate_path.resolve(strict=False)
    try:
        resolved.relative_to(root_path)
    except ValueError as exc:
        raise ContractError(
            "path.outside_root",
            f"path {resolved} is outside trusted root {root_path}",
            pointer="/path",
        ) from exc
    return resolved


def relative_contained_path(
    root: os.PathLike[str] | str,
    candidate: os.PathLike[str] | str,
) -> str:
    return contained_path(root, candidate).relative_to(Path(root).expanduser().resolve()).as_posix()


def schema_path(kind: str, version: int) -> Path:
    return DATA_ROOT / f"{kind}.v{version}.schema.json"


def load_schema(kind: str, version: int) -> dict[str, Any]:
    path = schema_path(kind, version)
    if not path.is_file():
        raise ContractError(
            "contract.schema_missing",
            f"no bundled schema for {kind} v{version}: {path}",
            pointer="/schema_version",
        )
    try:
        schema = json.loads(path.read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator.check_schema(schema)
    except (OSError, json.JSONDecodeError, jsonschema.SchemaError) as exc:
        raise ContractError(
            "contract.schema_invalid",
            f"cannot load {kind} v{version} schema: {exc}",
            pointer="/schema_version",
        ) from exc
    return schema


@dataclass(frozen=True)
class ContractDiagnostic:
    code: str
    pointer: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "pointer": self.pointer, "message": self.message}


class ContractError(ValueError):
    def __init__(self, code: str, message: str, *, pointer: str = "") -> None:
        super().__init__(message)
        self.code = code
        self.pointer = pointer

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "pointer": self.pointer, "message": str(self)}


@dataclass(frozen=True)
class ContractDispatch:
    kind: str
    version: int
    purpose: str
    mutable: bool
    schema_validated: bool
    document: dict[str, Any]


def _schema_diagnostics(document: Any, kind: str, version: int) -> list[ContractDiagnostic]:
    validator = jsonschema.Draft202012Validator(
        load_schema(kind, version),
        format_checker=jsonschema.FormatChecker(),
    )
    diagnostics = []
    for error in sorted(
        validator.iter_errors(document),
        key=lambda item: (list(item.absolute_path), item.validator or "", item.message),
    ):
        diagnostics.append(
            ContractDiagnostic(
                code=f"schema.{error.validator or 'invalid'}",
                pointer=json_pointer(error.absolute_path),
                message=error.message,
            )
        )
    return diagnostics


def validate_contract(document: Any, kind: str, version: int = 2) -> list[dict[str, str]]:
    """Return deterministic JSON-Pointer diagnostics without throwing."""
    try:
        return [item.as_dict() for item in _schema_diagnostics(document, kind, version)]
    except ContractError as exc:
        return [exc.as_dict()]


def require_valid_contract(document: Any, kind: str, version: int = 2) -> None:
    diagnostics = _schema_diagnostics(document, kind, version)
    if diagnostics:
        first = diagnostics[0]
        error = ContractError(first.code, first.message, pointer=first.pointer)
        error.diagnostics = [item.as_dict() for item in diagnostics]
        raise error


def dispatch_contract(document: Any, kind: str, *, purpose: str = "trace") -> ContractDispatch:
    """Dispatch a versioned artifact without mutating the caller's document.

    Missing ``schema_version`` is interpreted as v1 solely for compatibility
    inspection.  Pending v1 control-plane artifacts are never mutable.
    """
    if not isinstance(document, dict):
        raise ContractError("contract.type", "contract document must be an object")
    version = document.get("schema_version", 1)
    if not isinstance(version, int) or isinstance(version, bool):
        raise ContractError(
            "contract.version_invalid",
            "schema_version must be an integer",
            pointer="/schema_version",
        )
    if version not in (1, 2):
        raise ContractError(
            "contract.version_unsupported",
            f"unsupported {kind} schema version {version}",
            pointer="/schema_version",
        )
    mutable = purpose in MUTABLE_PURPOSES
    if mutable and version == 1 and kind in CONTROL_PLANE_KINDS:
        raise ContractError(
            "contract.v1_mutation_refused",
            f"{kind} v1 is read-only; use trace or manual handoff instead of resume",
            pointer="/schema_version",
        )
    if version == 1 and purpose not in READ_ONLY_V1_PURPOSES and mutable:
        raise ContractError(
            "contract.v1_mutation_refused",
            f"{kind} v1 cannot be used for a mutable {purpose} operation",
            pointer="/schema_version",
        )
    available = schema_path(kind, version).is_file()
    if available:
        require_valid_contract(document, kind, version)
    elif version == 2:
        raise ContractError(
            "contract.schema_missing",
            f"no bundled schema for {kind} v2",
            pointer="/schema_version",
        )
    return ContractDispatch(
        kind=kind,
        version=version,
        purpose=purpose,
        mutable=mutable,
        schema_validated=available,
        document=json.loads(json.dumps(document, ensure_ascii=False)),
    )


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = None
    try:
        descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
        with os.fdopen(descriptor, "wb") as handle:
            descriptor = None
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if descriptor is not None:
            os.close(descriptor)
        temporary_path = locals().get("temporary")
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)


def write_snapshot(
    path: os.PathLike[str] | str,
    document: dict[str, Any],
    *,
    kind: str,
    trusted_root: os.PathLike[str] | str,
    predecessor_sha256: str | None = None,
    transaction_id: str,
) -> dict[str, Any]:
    """Validate and atomically persist one v2 snapshot.

    The returned descriptor is suitable for inclusion in a v2 run event.  The
    caller appends that event only after this function returns successfully.
    """
    destination = contained_path(trusted_root, path)
    if document.get("schema_version") != 2:
        raise ContractError(
            "contract.snapshot_requires_v2",
            "mutable snapshots must use schema_version 2",
            pointer="/schema_version",
        )
    recorded_predecessor = document.get("previous_snapshot_sha256")
    if recorded_predecessor != predecessor_sha256:
        raise ContractError(
            "contract.predecessor_mismatch",
            "snapshot previous_snapshot_sha256 does not match the expected predecessor",
            pointer="/previous_snapshot_sha256",
        )
    if document.get("transaction_id") != transaction_id:
        raise ContractError(
            "contract.transaction_mismatch",
            "snapshot transaction_id does not match the active transaction",
            pointer="/transaction_id",
        )
    require_valid_contract(document, kind, 2)
    payload = canonical_json_bytes(document) + b"\n"
    atomic_write_bytes(destination, payload)
    return {
        "schema_version": 2,
        "schema_kind": kind,
        "path": relative_contained_path(trusted_root, destination),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "canonical_sha256": canonical_json_sha256(document),
        "byte_length": len(payload),
        "previous_snapshot_sha256": predecessor_sha256,
        "transaction_id": transaction_id,
    }


def verify_snapshot_descriptor(
    descriptor: dict[str, Any],
    *,
    trusted_root: os.PathLike[str] | str,
) -> list[dict[str, str]]:
    """Verify a snapshot descriptor and its referenced schema-valid document."""
    diagnostics: list[dict[str, str]] = []
    try:
        path = contained_path(trusted_root, descriptor.get("path", ""))
    except ContractError as exc:
        return [exc.as_dict()]
    try:
        payload = path.read_bytes()
    except OSError as exc:
        return [{"code": "snapshot.read_failed", "pointer": "/path", "message": str(exc)}]
    if len(payload) != descriptor.get("byte_length"):
        diagnostics.append({"code": "snapshot.byte_length_mismatch", "pointer": "/byte_length", "message": "snapshot byte length differs from descriptor"})
    if hashlib.sha256(payload).hexdigest() != descriptor.get("sha256"):
        diagnostics.append({"code": "snapshot.hash_mismatch", "pointer": "/sha256", "message": "snapshot file hash differs from descriptor"})
    try:
        document = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        diagnostics.append({"code": "snapshot.json_invalid", "pointer": "/path", "message": str(exc)})
        return diagnostics
    canonical = canonical_json_sha256(document)
    if canonical != descriptor.get("canonical_sha256"):
        diagnostics.append({"code": "snapshot.canonical_hash_mismatch", "pointer": "/canonical_sha256", "message": "canonical JSON hash differs from descriptor"})
    diagnostics.extend(validate_contract(document, descriptor.get("schema_kind", ""), 2))
    if document.get("transaction_id") != descriptor.get("transaction_id"):
        diagnostics.append({"code": "snapshot.transaction_mismatch", "pointer": "/transaction_id", "message": "snapshot and descriptor transaction identifiers differ"})
    if document.get("previous_snapshot_sha256") != descriptor.get("previous_snapshot_sha256"):
        diagnostics.append({"code": "snapshot.predecessor_mismatch", "pointer": "/previous_snapshot_sha256", "message": "snapshot and descriptor predecessor hashes differ"})
    return diagnostics
