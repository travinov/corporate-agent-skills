#!/usr/bin/env python3
"""Allowlisted local renderer adapters for the diagram lifecycle.

The specialized adapters deliberately invoke the existing generator CLIs.  They
do not parse or rewrite their source models, so normalization, output bytes, and
generator-side validation stay owned by the established implementations.

The generic adapter accepts an injected renderer callable to avoid importing the
orchestration host (and creating a circular dependency).  Its plan normalizer is
an exact deep copy: page-scoped identities and edge ``route`` objects, including
pins and orthogonal waypoints, pass through without an adapter-specific shape.
"""
import copy
import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Callable, Mapping, Sequence

import jsonschema

from diagram_model_v2 import validate_semantic_plan
from lifecycle_contracts import canonical_json_sha256, require_valid_contract
from sequence_adapter import render_sequence


ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"


class AdapterError(RuntimeError):
    """Base error for deterministic adapter selection or execution."""


class AdapterConfigurationError(AdapterError):
    """The requested mode or option is outside the adapter allowlist."""


class AdapterExecutionError(AdapterError):
    """An allowlisted generator failed or did not emit its declared artifact."""

    def __init__(
        self,
        message: str,
        *,
        command: Sequence[str] = (),
        returncode: int | None = None,
        stdout: str = "",
        stderr: str = "",
    ) -> None:
        super().__init__(message)
        self.command = tuple(command)
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _normalized_type(value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AdapterConfigurationError("diagram_type must be a non-empty string")
    return "-".join(value.strip().lower().replace("_", "-").split())


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _implementation_hash(relative_paths: Sequence[str]) -> str:
    """Hash an ordered, path-bound local implementation file set."""
    digest = hashlib.sha256()
    for relative in relative_paths:
        path = ROOT / relative
        if not path.is_file():
            raise AdapterConfigurationError(f"adapter implementation is missing: {path}")
        encoded = relative.encode("utf-8")
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)
        data = path.read_bytes()
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    return digest.hexdigest()


@dataclass(frozen=True)
class RendererAdapter:
    """Immutable declaration for one local renderer implementation."""

    adapter_id: str
    diagram_type: str
    aliases: tuple[str, ...]
    input_schema: str
    input_schema_paths: tuple[str, ...]
    supported_modes: tuple[str, ...]
    implementation_paths: tuple[str, ...]
    validation_profile: str
    output_artifact: str
    source_model: str
    option_values: tuple[tuple[str, tuple[str, ...]], ...] = ()
    default_options: tuple[tuple[str, str], ...] = ()

    @property
    def implementation_hash(self) -> str:
        return _implementation_hash(self.implementation_paths)

    def normalize_options(self, options: Mapping[str, Any] | None = None) -> dict[str, str]:
        allowed = {key: values for key, values in self.option_values}
        normalized = dict(self.default_options)
        for key, value in dict(options or {}).items():
            if key not in allowed:
                raise AdapterConfigurationError(
                    f"option {key!r} is not allowed for adapter {self.adapter_id!r}"
                )
            rendered = str(value)
            if allowed[key] and rendered not in allowed[key]:
                choices = ", ".join(allowed[key])
                raise AdapterConfigurationError(
                    f"invalid {key!r} option {rendered!r}; expected one of: {choices}"
                )
            normalized[key] = rendered
        return normalized

    def record(self) -> dict[str, Any]:
        """Return the stable registry fields captured in lifecycle evidence."""
        return {
            "adapter_id": self.adapter_id,
            "diagram_type": self.diagram_type,
            "input_schema": self.input_schema,
            "input_schema_paths": list(self.input_schema_paths),
            "supported_modes": list(self.supported_modes),
            "implementation_hash": self.implementation_hash,
            "validation_profile": self.validation_profile,
            "output_artifact": self.output_artifact,
            "source_model": self.source_model,
        }


@dataclass(frozen=True)
class AdapterSelection:
    requested_diagram_type: str
    adapter: RendererAdapter
    fallback: bool

    def record(
        self,
        *,
        options: Mapping[str, Any] | None = None,
        output_hash: str | None = None,
    ) -> dict[str, Any]:
        result = self.adapter.record()
        result.update(
            {
                "requested_diagram_type": self.requested_diagram_type,
                "fallback": self.fallback,
                "options": self.adapter.normalize_options(options),
            }
        )
        if output_hash is not None:
            result["output_hash"] = output_hash
        return result


@dataclass(frozen=True)
class AdapterRun:
    selection: AdapterSelection
    source_path: str | None
    output_path: str
    output_hash: str
    options: Mapping[str, str]
    command: tuple[str, ...]
    stdout: str
    stderr: str

    def record(self) -> dict[str, Any]:
        result = self.selection.record(options=self.options, output_hash=self.output_hash)
        result.update(
            {
                "source_path": self.source_path,
                "output_path": self.output_path,
                "command": list(self.command),
            }
        )
        return result


@dataclass(frozen=True)
class LifecycleAdapterInput:
    """Host-selected adapter input bound to one immutable source bundle."""

    selection: AdapterSelection
    source_record: Mapping[str, Any] | None
    source_bundle_sha256: str
    options: Mapping[str, str]
    fallback_reason: str | None

    @property
    def source_content(self) -> Any:
        if self.source_record is None:
            return None
        return copy.deepcopy(self.source_record["content"])

    def record(self) -> dict[str, Any]:
        result = self.selection.record(options=self.options)
        result["source_bundle_sha256"] = self.source_bundle_sha256
        result["fallback_reason"] = self.fallback_reason
        result["source_binding"] = None
        if self.source_record is not None:
            result["source_binding"] = {
                key: self.source_record[key]
                for key in ("source_id", "kind", "uri", "content_sha256")
            }
        return result


_ADAPTERS = (
    RendererAdapter(
        adapter_id="generic-v2",
        diagram_type="generic",
        aliases=("diagram", "drawio"),
        input_schema="semantic-plan.v2",
        input_schema_paths=("data/semantic-plan.v2.schema.json",),
        supported_modes=("create", "improve"),
        implementation_paths=(
            "scripts/layout_model.py",
            "scripts/layout_backend.py",
            "scripts/layout_builtin.py",
            "scripts/layout_renderer.py",
            "scripts/elk_runner.mjs",
            "vendor/elkjs/elk.bundled.js",
        ),
        validation_profile="structural",
        output_artifact="drawio",
        source_model="semantic-plan.v2",
        option_values=(
            ("backend", ("auto", "elk", "python", "legacy-generic-v2")),
            ("reflow", ("preserve", "local", "full")),
        ),
        default_options=(("backend", "auto"), ("reflow", "preserve")),
    ),
    RendererAdapter(
        adapter_id="roadmap-local",
        diagram_type="roadmap",
        aliases=("product-roadmap",),
        input_schema="roadmap.v1-or-v2",
        input_schema_paths=("data/roadmap.v1.schema.json", "data/roadmap.v2.schema.json"),
        supported_modes=("create",),
        implementation_paths=(
            "scripts/roadmap.py",
            "scripts/roadmap_validate.py",
            "scripts/roadmap_timeline.py",
        ),
        validation_profile="roadmap",
        output_artifact="drawio",
        source_model="roadmap.v1-or-v2",
        option_values=(("report", ()),),
    ),
    RendererAdapter(
        adapter_id="git-flow-local",
        diagram_type="git-flow",
        aliases=("gitflow",),
        input_schema="gitflow.v1",
        input_schema_paths=("data/gitflow.v1.schema.json",),
        supported_modes=("create",),
        implementation_paths=("scripts/gitflow.py", "scripts/gitflow_validate.py"),
        validation_profile="gitflow",
        output_artifact="drawio",
        source_model="gitflow.v1",
        option_values=(("route", ("auto", "builtin", "graphviz")),),
        default_options=(("route", "auto"),),
    ),
    RendererAdapter(
        adapter_id="sequence-local",
        diagram_type="sequence",
        aliases=("sequence-diagram",),
        input_schema="semantic-plan.v2",
        input_schema_paths=("data/semantic-plan.v2.schema.json",),
        supported_modes=("create",),
        implementation_paths=("scripts/sequence_adapter.py", "scripts/seqlayout.py"),
        validation_profile="structural",
        output_artifact="drawio",
        source_model="semantic-plan.v2",
    ),
    RendererAdapter(
        adapter_id="c4-local",
        diagram_type="c4",
        aliases=("c4-architecture", "c4-model"),
        input_schema="c4.generator-input.v1",
        input_schema_paths=("scripts/c4.py#input-json-contract",),
        supported_modes=("create",),
        implementation_paths=("scripts/c4.py", "scripts/autolayout.py"),
        validation_profile="structural",
        output_artifact="drawio",
        source_model="c4.generator-input.v1",
        option_values=(("direction", ("TB", "LR")),),
        default_options=(("direction", "TB"),),
    ),
)


def _build_allowlist() -> Mapping[str, RendererAdapter]:
    result: dict[str, RendererAdapter] = {}
    for adapter in _ADAPTERS:
        for name in (adapter.diagram_type, *adapter.aliases):
            key = _normalized_type(name)
            if key in result:
                raise AdapterConfigurationError(f"duplicate renderer adapter alias: {key}")
            result[key] = adapter
    return MappingProxyType(result)


ADAPTER_REGISTRY = MappingProxyType({adapter.diagram_type: adapter for adapter in _ADAPTERS})
ADAPTER_ALLOWLIST = _build_allowlist()
GENERIC_ADAPTER = ADAPTER_REGISTRY["generic"]


def list_adapters() -> tuple[RendererAdapter, ...]:
    """Return the fixed local registry in stable order."""
    return _ADAPTERS


def registry_manifest() -> list[dict[str, Any]]:
    """Return evidence-ready declarations without performing discovery."""
    return [adapter.record() for adapter in _ADAPTERS]


def select_adapter(diagram_type: str) -> AdapterSelection:
    requested = _normalized_type(diagram_type)
    adapter = ADAPTER_ALLOWLIST.get(requested)
    if adapter is None:
        return AdapterSelection(requested, GENERIC_ADAPTER, True)
    return AdapterSelection(requested, adapter, False)


def _schema_accepts(schema_path: str, content: Any) -> bool:
    schema = json.loads((ROOT / schema_path).read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(
        schema, format_checker=jsonschema.FormatChecker(),
    )
    return not any(validator.iter_errors(content))


def _c4_source_valid(content: Any) -> bool:
    """Validate the documented c4.py JSON contract without rewriting it."""
    if not isinstance(content, dict):
        return False
    levels = content.get("levels")
    if not isinstance(levels, list) or not levels:
        return False
    level_names: set[str] = set()
    element_ids: set[str] = set()
    children: list[str] = []
    relations: list[tuple[str, str]] = []
    allowed_types = {"person", "system", "external", "container", "component", "database"}
    for level in levels:
        if not isinstance(level, dict):
            return False
        name = level.get("name")
        elements = level.get("elements", [])
        level_relations = level.get("relations", [])
        if (
            not isinstance(name, str) or not name
            or name in level_names
            or not isinstance(elements, list)
            or not isinstance(level_relations, list)
        ):
            return False
        level_names.add(name)
        for element in elements:
            if not isinstance(element, dict):
                return False
            element_id = element.get("id")
            element_type = element.get("type", "system")
            if (
                not isinstance(element_id, str) or not element_id
                or element_id in element_ids
                or element_type not in allowed_types
            ):
                return False
            element_ids.add(element_id)
            if element.get("children") is not None:
                if not isinstance(element["children"], str) or not element["children"]:
                    return False
                children.append(element["children"])
        for relation in level_relations:
            if not isinstance(relation, dict):
                return False
            source = relation.get("from")
            target = relation.get("to")
            if not isinstance(source, str) or not source or not isinstance(target, str) or not target:
                return False
            relations.append((source, target))
    return all(child in level_names for child in children) and all(
        source in element_ids and target in element_ids
        for source, target in relations
    )


def source_matches_adapter(adapter: RendererAdapter, content: Any) -> bool:
    """Return whether explicit source content satisfies the adapter contract."""
    if adapter is GENERIC_ADAPTER:
        return False
    if adapter.diagram_type == "c4":
        return _c4_source_valid(content)
    return any(
        _schema_accepts(path, content)
        for path in adapter.input_schema_paths
        if "#" not in path
    )


def select_lifecycle_adapter_input(
    semantic_plan: Mapping[str, Any],
    source_bundle: Mapping[str, Any],
    *,
    mode: str = "create",
) -> LifecycleAdapterInput:
    """Select a renderer only when its plan and source model are trustworthy.

    The validated semantic plan selects the diagram type.  A specialized
    renderer additionally requires a schema-valid, explicitly supplied source
    document from the immutable source bundle.  Missing or invalid specialized
    input falls back to the generic adapter; no source model is invented.
    """
    plan = copy.deepcopy(dict(semantic_plan))
    bundle = copy.deepcopy(dict(source_bundle))
    require_valid_contract(plan, "semantic-plan", 2)
    require_valid_contract(bundle, "source-bundle", 2)
    diagnostics = validate_semantic_plan(plan)
    if diagnostics:
        first = diagnostics[0]
        raise AdapterConfigurationError(
            f"semantic plan is not executable: {first.get('code')}: {first.get('message')}"
        )
    bundle_sha256 = canonical_json_sha256(bundle)
    if plan["source_bundle_sha256"] != bundle_sha256:
        raise AdapterConfigurationError(
            "semantic plan source bundle binding differs from the selected source bundle"
        )
    requested = plan["result"]["diagram_type"]
    selection = select_adapter(requested)
    options: dict[str, str] = {}

    if selection.adapter is GENERIC_ADAPTER:
        options = selection.adapter.normalize_options(options)
        return LifecycleAdapterInput(
            selection=selection,
            source_record=None,
            source_bundle_sha256=bundle_sha256,
            options=MappingProxyType(options),
            fallback_reason="unsupported_diagram_type" if selection.fallback else None,
        )
    if selection.adapter.diagram_type == "sequence" and mode == "create":
        return LifecycleAdapterInput(
            selection=selection,
            source_record=None,
            source_bundle_sha256=bundle_sha256,
            options=MappingProxyType(selection.adapter.normalize_options(options)),
            fallback_reason=None,
        )
    if mode not in selection.adapter.supported_modes:
        generic_options = GENERIC_ADAPTER.normalize_options({"reflow": "preserve"})
        return LifecycleAdapterInput(
            selection=AdapterSelection(
                selection.requested_diagram_type, GENERIC_ADAPTER, True,
            ),
            source_record=None,
            source_bundle_sha256=bundle_sha256,
            options=MappingProxyType(generic_options),
            fallback_reason="specialized_mode_unsupported",
        )

    chosen = None
    for source in bundle["sources"]:
        if source.get("kind") != "explicit_user_document":
            continue
        if source.get("content_sha256") != canonical_json_sha256(source.get("content")):
            continue
        if source_matches_adapter(selection.adapter, source.get("content")):
            chosen = source
            break
    if chosen is None:
        return LifecycleAdapterInput(
            selection=AdapterSelection(
                selection.requested_diagram_type, GENERIC_ADAPTER, True,
            ),
            source_record=None,
            source_bundle_sha256=bundle_sha256,
            options=MappingProxyType(GENERIC_ADAPTER.normalize_options(options)),
            fallback_reason="specialized_source_missing_or_invalid",
        )
    if selection.adapter.diagram_type == "c4":
        options["direction"] = plan["result"]["direction"]
    return LifecycleAdapterInput(
        selection=selection,
        source_record=MappingProxyType(chosen),
        source_bundle_sha256=bundle_sha256,
        options=MappingProxyType(selection.adapter.normalize_options(options)),
        fallback_reason=None,
    )


def normalize_generic_plan(plan: Mapping[str, Any]) -> dict[str, Any]:
    """Return an exact structural copy of a schema-validated semantic plan.

    Validation belongs to the v2 contract dispatcher.  In particular, this
    helper neither translates nor drops ``edge.route``; the strict route object
    reaches the injected generic renderer unchanged.
    """
    if not isinstance(plan, Mapping):
        raise AdapterConfigurationError("generic adapter input must be a semantic-plan object")
    return copy.deepcopy(dict(plan))


def _source_path(source: str | Path) -> Path:
    path = Path(source).expanduser().resolve()
    if not path.is_file():
        raise AdapterConfigurationError(f"adapter source does not exist: {path}")
    return path


def _output_path(output: str | Path) -> Path:
    path = Path(output).expanduser().resolve()
    if path.suffix.lower() != ".drawio":
        raise AdapterConfigurationError("adapter output must use the .drawio suffix")
    if not path.parent.is_dir():
        raise AdapterConfigurationError(f"adapter output directory does not exist: {path.parent}")
    return path


def _generator_command(
    adapter: RendererAdapter,
    source: Path,
    output: Path,
    options: Mapping[str, str],
) -> list[str]:
    if adapter.diagram_type == "roadmap":
        command = [sys.executable, str(SCRIPTS / "roadmap.py"), str(source), "-o", str(output)]
        if options.get("report"):
            command.extend(("--report", options["report"]))
        return command
    if adapter.diagram_type == "git-flow":
        return [
            sys.executable,
            str(SCRIPTS / "gitflow.py"),
            str(source),
            "-o",
            str(output),
            "--route",
            options["route"],
        ]
    if adapter.diagram_type == "c4":
        return [
            sys.executable,
            str(SCRIPTS / "c4.py"),
            str(source),
            "-o",
            str(output),
            "--direction",
            options["direction"],
        ]
    raise AdapterConfigurationError(f"adapter {adapter.adapter_id!r} has no generator command")


def render_with_adapter(
    diagram_type: str,
    source: str | Path | Mapping[str, Any],
    output: str | Path,
    *,
    mode: str = "create",
    options: Mapping[str, Any] | None = None,
    generic_renderer: Callable[[dict[str, Any], Path], Any] | None = None,
    timeout: float | None = None,
) -> AdapterRun:
    """Render through an allowlisted adapter without publishing the artifact."""
    selection = select_adapter(diagram_type)
    adapter = selection.adapter
    if mode not in adapter.supported_modes:
        raise AdapterConfigurationError(
            f"mode {mode!r} is not supported by adapter {adapter.adapter_id!r}"
        )
    normalized_options = adapter.normalize_options(options)
    output_path = _output_path(output)

    if adapter is GENERIC_ADAPTER:
        if generic_renderer is None:
            raise AdapterConfigurationError("generic adapter requires an injected local renderer")
        if normalized_options.get("backend") != "legacy-generic-v2":
            raise AdapterConfigurationError(
                "the injected generic renderer is legacy-generic-v2 and requires "
                "options={'backend': 'legacy-generic-v2'}"
            )
        if isinstance(source, Mapping):
            plan = normalize_generic_plan(source)
            source_path: Path | None = None
        else:
            source_path = _source_path(source)
            try:
                plan = normalize_generic_plan(json.loads(source_path.read_text(encoding="utf-8")))
            except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                raise AdapterConfigurationError(f"cannot read generic semantic plan: {exc}") from exc
        generic_renderer(plan, output_path)
        command: tuple[str, ...] = ("injected:generic_renderer",)
        stdout = ""
        stderr = ""
    elif adapter.diagram_type == "sequence":
        if not isinstance(source, Mapping):
            raise AdapterConfigurationError(
                "sequence-local requires a semantic-plan.v2 object"
            )
        source_path = None
        try:
            render_sequence(source, output_path)
        except Exception as exc:
            raise AdapterExecutionError(
                f"adapter {adapter.adapter_id!r} failed: {exc}",
                command=("in-process:sequence_adapter",),
            ) from exc
        command = ("in-process:sequence_adapter",)
        stdout = ""
        stderr = ""
    else:
        if isinstance(source, Mapping):
            raise AdapterConfigurationError(
                f"adapter {adapter.adapter_id!r} requires its existing source file format"
            )
        source_path = _source_path(source)
        command_list = _generator_command(adapter, source_path, output_path, normalized_options)
        try:
            process = subprocess.run(
                command_list,
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise AdapterExecutionError(
                f"adapter {adapter.adapter_id!r} timed out",
                command=command_list,
                stdout=exc.stdout or "",
                stderr=exc.stderr or "",
            ) from exc
        command = tuple(command_list)
        stdout = process.stdout
        stderr = process.stderr
        if process.returncode != 0:
            raise AdapterExecutionError(
                f"adapter {adapter.adapter_id!r} failed with exit {process.returncode}",
                command=command,
                returncode=process.returncode,
                stdout=stdout,
                stderr=stderr,
            )

    if not output_path.is_file():
        raise AdapterExecutionError(
            f"adapter {adapter.adapter_id!r} did not produce {output_path}",
            command=command,
            stdout=stdout,
            stderr=stderr,
        )
    return AdapterRun(
        selection=selection,
        source_path=str(source_path) if source_path is not None else None,
        output_path=str(output_path),
        output_hash=_sha256_file(output_path),
        options=MappingProxyType(normalized_options),
        command=command,
        stdout=stdout,
        stderr=stderr,
    )


def validation_command(
    run: AdapterRun,
    *,
    strict: bool = True,
    json_output: bool = True,
) -> tuple[str, ...]:
    """Build the common validator command declared by the selected adapter."""
    command = [sys.executable, str(SCRIPTS / "validate.py"), run.output_path]
    if strict:
        command.append("--strict")
    if json_output:
        command.append("--json")
    profile = run.selection.adapter.validation_profile
    if profile in {"roadmap", "gitflow"}:
        if run.source_path is None:
            raise AdapterConfigurationError(f"validation profile {profile!r} requires a source path")
        command.extend(("--profile", profile, "--source", run.source_path))
    elif profile != "structural":
        raise AdapterConfigurationError(f"unsupported validation profile: {profile!r}")
    return tuple(command)


__all__ = [
    "ADAPTER_ALLOWLIST",
    "ADAPTER_REGISTRY",
    "GENERIC_ADAPTER",
    "AdapterConfigurationError",
    "AdapterError",
    "AdapterExecutionError",
    "LifecycleAdapterInput",
    "AdapterRun",
    "AdapterSelection",
    "RendererAdapter",
    "list_adapters",
    "normalize_generic_plan",
    "registry_manifest",
    "render_with_adapter",
    "select_adapter",
    "select_lifecycle_adapter_input",
    "source_matches_adapter",
    "validation_command",
]
