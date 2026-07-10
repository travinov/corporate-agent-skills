## Context

`publish-drawio-skill/` is an installable, local-first skill package that extends the upstream draw.io skill with roadmap and git-flow generation. Both generators currently accept compact YAML or JSON models and emit deterministic-looking draw.io XML, but their contracts are enforced mostly by handwritten checks. The roadmap JSON Schema accepts five time scales while the renderer always builds a monthly axis, the roadmap generator escapes labels before passing them to an XML serializer, and some accepted fields are not represented in the artifact. Git-flow validation does not require every event-specific branch reference and layout assigns slots in source-array order instead of semantic time order.

The change is limited to `publish-drawio-skill/` and its OpenSpec artifacts. The BPMN skill remains an independent package and contract. Runtime processing remains local; configured corporate or public Python package registries are permitted only for installing declared dependencies. Package availability must be checked before setup or self-check proceeds. For this change, `PyYAML` and `jsonschema` are assumed available from the configured registry.

The existing unversioned roadmap fixtures and git-flow JSON files are already in use. They need a bounded compatibility path while new inputs adopt explicit schema versions. The skill also needs validation of the generated artifact, not only validation of its source model, because XML correctness alone does not prove label fidelity, chronology, lane placement, or exportability.

## Goals / Non-Goals

**Goals:**

- Define explicit versioned schemas for roadmap YAML and git-flow JSON using JSON Schema Draft 2020-12.
- Separate parse, schema, reference, semantic, generation, artifact, and export validation into identifiable stages.
- Preserve all five advertised roadmap scales with explicit calendar and ordinal contracts.
- Make accepted roadmap fields visible or report them as unsupported instead of silently losing them.
- Sort git-flow events by semantic time with a stable source-order tie-break before validation-dependent layout and edge construction.
- Produce deterministic draw.io XML whose decoded labels match source Unicode and XML-special-character text exactly.
- Emit machine-readable findings with stable codes, paths, severities, and validation layers.
- Declare Python dependencies and provide a preflight/self-check that verifies package availability and installed versions.

**Non-Goals:**

- Combining the draw.io and BPMN skills or adding BPMN generation to this package.
- Adding external SaaS, online renderers, or external MCP services.
- Reconstructing git history from a repository; git-flow v1 continues to render explicit input JSON only.
- Requiring Graphviz; builtin routing remains the supported deterministic fallback.
- Building a general visual-regression platform or guaranteeing pixel-identical exports across draw.io application versions.
- Changing release ZIP assembly, checksum publication, or cross-package release orchestration; those belong to the separate release-reproducibility change.

## Decisions

### Decision: Dispatch inputs to immutable major-version schemas

The package will add `data/roadmap.v1.schema.json` and `data/gitflow.v1.schema.json`, each with Draft 2020-12 `$schema`, a stable `$id`, a top-level integer `schema_version`, and `additionalProperties: false` on stable contract objects. A small dispatcher will inspect `schema_version` before full validation. Missing versions will be treated as effective version 1 for one compatibility release and will emit `contract.version.missing` as a deprecation warning. Unknown versions will fail before generation.

The compatibility path validates a copied in-memory model with `schema_version: 1`; it does not rewrite the user's source file. Newly generated examples and documentation will always include the version.

Alternatives considered:

- Replace the existing unversioned schema in place: rejected because it provides no safe route for future breaking changes.
- Require `schema_version` immediately: rejected because it would break all existing fixtures and user inputs without a migration window.
- Keep one mutable schema with optional fields: rejected because capability drift would remain difficult to detect and test.

### Decision: Use schema validation for shape and semantic validation for graph meaning

JSON Schema will own types, required fields, enums, patterns, event variants, time-mode variants, and unknown-field rejection. Handwritten semantic validators will own cross-record uniqueness, reference resolution, range ordering, branch lifecycle, baseline compatibility, and density policy. Validators will collect all practical findings instead of stopping at the first schema error.

All validators will use a shared finding envelope containing `report_version`, effective `schema_version`, summary counts/status, and findings with `layer`, `severity`, `code`, JSON Pointer-style `path`, optional `element`, and `message`. Human-readable output remains the default; `--json` writes the same stable envelope. Strict mode promotes warnings to errors without changing finding codes or paths.

Alternatives considered:

- Express cross-record references entirely in JSON Schema: rejected because standard JSON Schema cannot clearly enforce graph and lifecycle semantics.
- Keep free-form strings as validator output: rejected because tests and agent repair loops need stable identifiers independent of wording.

### Decision: Model calendar and ordinal roadmaps as explicit variants

Roadmap v1 retains `week`, `month`, `quarter`, `date`, and `order`. Calendar modes use ISO `YYYY-MM-DD` values: tasks use `start` and `end`, and milestones use `date`. Order mode uses integer ordinal coordinates: tasks use `start_order` and `end_order`, and milestones use `order`. The schema uses conditional variants so calendar and ordinal coordinate fields cannot be mixed accidentally. Baseline entities use the same variant as the current model.

The renderer will build ticks and coordinate transforms specific to the selected scale. `week`, `month`, and `quarter` use corresponding calendar buckets, `date` uses day-level positions, and `order` uses sorted ordinal positions. No renderer fallback may silently substitute a monthly axis for another declared scale.

Alternatives considered:

- Remove `order` from v1: rejected because it is already advertised and is useful when precise dates do not exist.
- Interpret `order` from array position: rejected because source reordering would alter semantics and Git diffs.
- Reuse ISO date fields for ordinal mode: rejected because values and validation errors would be ambiguous.

### Decision: Make roadmap semantic preservation testable

The renderer will pass raw label strings to `ElementTree` exactly once and let the serializer perform XML escaping. Tasks and milestones will expose linked outcomes. Risk and status will have distinct, documented visual channels so one cannot overwrite the other. Baseline comparison will compute deterministic machine-readable changes for tasks, milestones, dependencies, and outcomes; milestone schedule shifts remain the primary visual delta, while other changes are represented in the validation/report summary unless a concise artifact annotation is defined.

Every schema field accepted for a rendered entity must be either represented in the draw.io artifact or validation report, or rejected with an `unsupported.*` error. This prevents silent semantic loss.

Alternatives considered:

- Test only XML parsing: rejected because double escaping and ignored fields still produce well-formed XML.
- Render all baseline changes as edges: rejected because dense diagrams would become unreadable; non-positional changes are better preserved in the report.

### Decision: Normalize git-flow chronology once and reuse it everywhere

Git-flow v1 will use event-specific schema variants. Lane-local events require `branch`; branch and merge events require both `from` and `to`. Date mode requires an ISO `at`; order mode requires an integer `order`. The semantic validator will resolve references and create one normalized event sequence sorted by `(at or order, original_index)`. Branch lifecycle checks, lane sequencing, edge construction, slot assignment, and deterministic output will all consume that sequence.

If a branch is the target of a branch event, lane-local activity and merges involving that branch before its creation are errors. Multiple creation events for the same target and merges into self are errors. Branches without a creation event are treated as pre-existing at the start of the supplied timeline. Canonical git-flow policy remains warnings in relaxed mode and errors in strict mode; custom workflow skips canonical policy while retaining structural and lifecycle validation.

Alternatives considered:

- Require users to pre-sort input arrays: rejected because a declared timestamp must be authoritative.
- Sort only X coordinates while retaining original order for edges: rejected because it produces backward or semantically incorrect connectors.

### Decision: Validate generated draw.io artifacts against their source model

`scripts/validate.py` will retain generic draw.io structural checks and gain stable finding codes plus an optional generator profile/source model. Profile checks will validate:

- parseable XML, required draw.io graph roots, unique cell IDs, resolved parent/source/target references, and finite geometry;
- exact decoded label fidelity for mapped source fields, including Unicode and `&`, `<`, `>`, quotes, and newlines;
- roadmap X ordering and lane Y containment for the selected scale;
- git-flow event X ordering and branch-lane placement from the normalized sequence;
- generator-specific cells and edges required by source outcomes, risks/statuses, dependencies, and milestone shifts;
- byte-identical output from two runs with the same normalized input and options.

An explicit export-smoke command will invoke an installed draw.io CLI, require a non-empty PNG, verify the PNG signature and terminal `IEND` chunk, and report an actionable dependency finding when the CLI is unavailable. Runtime artifact validation does not download draw.io or send content externally. Release/CI verification will invoke the export smoke in an environment where the CLI is provisioned.

Alternatives considered:

- Compare screenshots only: rejected because screenshots do not precisely identify broken refs or corrupted source text.
- Make export a silent best-effort check: rejected because a skipped quality gate can be mistaken for a pass.

### Decision: Declare and preflight Python dependencies

The skill will add a Python dependency manifest for `PyYAML` and `jsonschema`, constrained to supported major versions. A preflight/self-check will first query the configured package installer for resolvability, then verify imports, versions, schema compilation, and minimal roadmap/git-flow fixtures. It will never silently install from an unconfigured public source. Package-unavailable and package-missing conditions will be distinct findings with copyable remediation commands.

Alternatives considered:

- Continue relying on globally installed modules: rejected because clean installations are not reproducible.
- Vendor third-party packages into the skill: rejected because the user confirmed dependencies may be installed and registry policy can differ by environment.

## Risks / Trade-offs

- [Compatibility warnings are ignored until removal] -> Document the one-release migration window, emit the warning on every unversioned validation, and convert all bundled examples immediately.
- [Conditional JSON Schemas become harder to maintain] -> Keep shared definitions in `$defs`, compile every schema in tests, and provide positive/negative fixtures for every variant.
- [Ordinal fields are a breaking semantic clarification] -> Accept legacy unversioned calendar inputs as v1, document `start_order`/`end_order`/`order`, and fail ambiguous mixed coordinate models with precise paths.
- [Source-aware artifact validation couples validators to generator IDs] -> Treat generated cell-ID conventions as a documented internal contract and cover them with deterministic regression tests.
- [Exact byte determinism can vary if serializer behavior changes] -> Pin the supported Python major/minor range in verification, avoid timestamps and unordered iteration, and compare semantic canonical forms in diagnostics as well as bytes.
- [Real draw.io export may not be available on every workstation] -> Keep the check explicit and fail as unavailable rather than passed; require it in provisioned release/CI environments.
- [Additional baseline deltas can increase report size] -> Keep artifact annotations concise, sort delta records deterministically, and place full detail in the machine-readable report.

## Migration Plan

1. Add the v1 schemas, validation-report schema/definitions, and dependency manifest without removing the existing entry points.
2. Add version dispatch and the unversioned compatibility warning; update bundled fixtures and documentation to explicit `schema_version: 1`.
3. Add exhaustive schema fixtures and semantic-validator tests before changing generator behavior.
4. Correct roadmap coordinate transforms, escaping, outcomes, risk/status treatment, and full baseline-delta reporting behind the validated v1 model.
5. Normalize git-flow event order and use the normalized sequence for lifecycle checks, layout, and edges.
6. Add source-aware artifact validation, deterministic rerun checks, and provisioned draw.io export smoke tests.
7. Run package preflight, clean-environment tests, strict examples, and the existing focused draw.io tests.

Rollback keeps the old command names but reverts dispatch to the previous schema/validators and generator implementations. Inputs with explicit `schema_version: 1` remain structurally compatible because the version field can be ignored by the rollback adapter; no user source file is rewritten automatically.

## Open Questions

No blocking product decisions remain for this change. The implementation assumes all five documented roadmap scales remain supported, Draw.io and BPMN remain separate skills, and the configured package registry can resolve `PyYAML` and `jsonschema`. If package resolution fails during implementation, work stops at the preflight task and reports the exact package/version constraint instead of substituting a dependency.
