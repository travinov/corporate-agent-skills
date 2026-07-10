## Context

`publish-bpmn-skill` currently validates one permissive Draft 7 schema and then generates BPMN XML from a flat model containing one `process`, global `nodes`/`flows`, and optional participants. Unknown properties are accepted, sequence-flow `condition` is accepted but not emitted as `bpmn:conditionExpression`, and every generated participant points to the same process. The XML can therefore parse successfully while differing materially from the authored YAML.

The change spans the YAML contracts, reference validation, generator, XML parser, validation report, CLI, fixtures, and agent-facing guidance. It must remain local-first and use the dependencies available to the packaged Node toolchain. It must also keep common single-process authoring concise while providing an explicit path to correct multi-process collaboration.

## Goals / Non-Goals

**Goals:**

- Define explicit, independently addressable v1 and v2 process schemas with strict property contracts.
- Preserve supported v1 semantics end to end and reject unsupported fields or element families before generation.
- Detect semantic loss by comparing a normalized YAML projection with a normalized model parsed back from generated BPMN XML.
- Introduce a correct v2 collaboration model with process-scoped flow elements and explicit participant ownership.
- Provide a deterministic, non-destructive migration for unambiguous v1 single-process models.
- Publish stable finding codes and a tested capability matrix that distinguish supported, partial, and unsupported behavior.
- Accept unversioned legacy inputs as v1 for one transition release while making the compatibility behavior visible.

**Non-Goals:**

- Do not implement every BPMN 2.0 family in this change.
- Do not infer process ownership for ambiguous legacy models with multiple participants.
- Do not make engine-specific executable attributes mandatory for descriptive models.
- Do not replace `process.yaml` as the authored source of truth or introduce an external renderer, SaaS validator, public API, or MCP dependency.
- Do not redesign layout beyond the validation needed to classify supported and partial capabilities.

## Decisions

### 1. Dispatch validation by an explicit integer schema version

Canonical v1 and v2 documents contain `schema_version: 1` and `schema_version: 2` respectively. The dispatcher selects `process.v1.schema.json` or `process.v2.schema.json` before semantic validation. Both schemas use JSON Schema 2020-12, stable `$id` values, local `$ref` definitions, and `additionalProperties: false` on contract-owned objects.

An absent `schema_version` is treated as v1 for exactly one transition release and produces `schema.version_implicit` as a warning. An unknown, non-integer, or unsupported version produces an error and no fallback. The validation report records both the declared version and the resolved version.

This is preferred over mutating one schema in place because existing files remain reproducible and a breaking collaboration structure can be added without ambiguous conditionals. A single schema containing a root `oneOf` was considered, but separate files make documentation, fixtures, migration, and release compatibility easier to audit.

### 2. Keep v1 as a strict single-process authoring contract

The v1 root retains the familiar `process`, `participants`, `lanes`, `nodes`, `flows`, `message_flows`, `data`, `artifacts`, `extensions`, and `documentation` sections. The schema is tightened into discriminated node and event-definition shapes and no longer accepts arbitrary fields on those objects.

Sequence-flow conditions use a canonical object with required `body` and optional `language`; shorthand strings are not part of canonical versioned v1. A gateway `default` is a sequence-flow id and must reference an outgoing flow owned by that gateway. Extension fields are allowed only under documented `extensions` containers. A property or element family is admitted only when its semantic projection, XML mapping, parse-back mapping, and validation behavior are all defined.

This retains concise authoring for common processes while eliminating the current situation in which permissive schema success is mistaken for feature support. Keeping arbitrary properties and trying to pass them through was rejected because `bpmn-moddle` needs namespace descriptors and typed mappings; silent generic pass-through cannot guarantee valid or reviewable BPMN semantics.

### 3. Collect symbols before resolving references

Validation runs in ordered phases: parse, schema, symbol collection, reference resolution, semantic rules, generation, artifact parse, round-trip comparison, layout, BPMN lint, and engine checks. Symbol collection walks all in-scope elements before resolving references, so valid forward references such as a boundary event declared before its attached activity are accepted.

Reference rules are version-aware. In v1, sequence flows resolve within the one process. In v2, sequence flows resolve only within their owning process; participant `process_ref` resolves to one process; and message-flow endpoints resolve to participants or flow nodes owned by different participants/processes. Duplicate ids are rejected in the BPMN definitions-wide id namespace.

Resolving references during a single source-order traversal was rejected because it makes valid models depend on YAML ordering and currently rejects forward `attachedTo` references.

### 4. Define v2 collaboration around process ownership

The v2 root contains definitions metadata, `processes[]`, `participants[]`, `message_flows[]`, root `extensions`, and root `documentation`. Each process item owns its metadata, lanes, nodes, sequence flows, data, artifacts, extensions, and documentation. Each participant has an explicit `process_ref`, and each generated BPMN participant points only to that process.

Message-flow endpoints are explicit ids and must cross process/participant ownership boundaries. Sequence flows may never cross process boundaries. This structure maps directly to BPMN `definitions`, multiple `process` root elements, one `collaboration`, participants, and message flows.

Adding `process_ref` to the existing flat v1 participants without scoping nodes and flows was rejected because the generator still could not determine which flow elements belong to which process.

### 5. Normalize source and generated XML into a semantic projection

The round-trip validator creates one canonical projection from the validated YAML model and another from BPMN XML parsed by `bpmn-moddle`. The comparison is id-keyed and ordering-insensitive. It covers every field marked semantic in the capability matrix, including process ownership, participants, lanes, nodes, sequence-flow endpoints, condition body/language, gateway default-flow ids, boundary attachment, event definitions, message-flow endpoints, documentation, and supported engine extensions.

Generated ids that are intentionally derived, XML namespace boilerplate, BPMN DI coordinates, and serialization ordering are excluded from semantic equality. A mismatch produces a stable `roundtrip.*` error containing an element id and JSON Pointer where available. `build` always performs the comparison. `validate` performs it when source YAML is supplied; without YAML it reports that source-to-artifact preservation was not evaluated and does not claim semantic equivalence.

Snapshot-only XML tests were considered insufficient because a parseable snapshot can retain the same silent omissions. Comparing canonical projections makes each accepted contract field testable without tying tests to incidental XML formatting.

### 6. Make capability support fail closed

A versioned capability matrix is stored with the skill and identifies each schema field and BPMN family as `supported`, `partial`, or `unsupported`, with the applicable schema version and validation coverage. `supported` means schema, generation, parse-back, semantic comparison, and required validation are implemented. `partial` is permitted only when core semantics round-trip but a non-semantic layer such as automatic layout or an engine profile requires manual review; it produces a capability warning and fails strict mode. `unsupported` input is rejected before generation with `capability.unsupported`.

The schema remains the first boundary: known unsupported families are not part of canonical variants. The capability check provides a specific error when a recognizable BPMN type or extension is requested, instead of degrading it to a generic task or silently ignoring it. Generator type fallback is removed for authored nodes.

Claiming full BPMN support based on `bpmn-moddle` parse coverage was rejected because the toolchain also needs correct YAML mapping, generation, layout, validation, and round-trip behavior.

### 7. Version the validation report independently from the process model

Reports use `report_version: 1` independently of `schema_version`. Each finding includes stable `layer`, `severity`, `code`, and optional `path` and `element` fields. Required layers are `parse`, `schema`, `references`, `semantics`, `generation`, `artifact-parse`, `round-trip`, `layout`, `bpmnlint`, `engine`, `capability`, and `migration`; empty layers need not emit placeholder findings.

Human-readable messages remain useful but tests and automation key on `code`, `path`, `element`, and `severity`. Schema failures retain the relevant Ajv keyword in a stable code such as `schema.required` or `schema.additional_property` instead of collapsing all failures to `schema.invalid`.

Reusing the process schema version as the report version was rejected because report consumers and process authors have different compatibility timelines.

### 8. Provide explicit, non-destructive v1-to-v2 migration

`corp-bpmn migrate <input> --to-version 2 --out <output>` validates the source first and writes a new file; it does not overwrite the input by default. A v1 model with zero or one participant is unambiguous: the one process becomes one v2 process, lanes and flow elements move into it, and an existing or generated participant receives its `process_ref`.

A v1 model with multiple participants is rejected with `migration.ambiguous_process_ownership` unless future explicit mapping input is added. Migration output is validated against v2, generated, and round-trip checked in tests. The source file remains the rollback artifact; switching the CLI dispatcher back to the v1 document is the rollback path.

Automatically assigning every v1 participant to the same process was rejected because it would preserve the current invalid ownership assumption instead of correcting it.

## Risks / Trade-offs

- [Strict schemas reject files that previously passed] → Keep a one-release unversioned-v1 compatibility path, provide stable diagnostics, examples, and an explicit migration command; do not silently remove unknown data.
- [The capability matrix can drift from implementation] → Require every matrix row to reference positive, negative, and round-trip tests and validate the matrix during the package self-check.
- [Canonical comparison may report false mismatches caused by BPMN normalization] → Compare typed semantic projections rather than raw YAML/XML, document excluded non-semantic fields, and add normalization fixtures.
- [v2 is more verbose for simple models] → Keep v1 fully supported for single-process authoring and have `init` default to canonical v1 unless collaboration is requested.
- [Partial capability status can be misunderstood as semantic loss] → Permit `partial` only when semantic round-trip succeeds; reserve the status for layout or engine review and fail it under strict mode.
- [Migration cannot infer legacy multi-participant ownership] → Fail with an actionable finding and require the author to define processes and mappings explicitly.
- [A new schema draft can expose validator configuration differences] → Compile all shipped schemas with the same Ajv 2020 instance during tests and package self-check before accepting any model.

## Migration Plan

1. Add and compile v1/v2 schemas, the schema-version dispatcher, capability matrix, and stable finding normalization without changing generator output.
2. Make canonical `init` and examples emit `schema_version: 1`; retain absent-version fallback with `schema.version_implicit` for one transition release.
3. Tighten v1 variants and reference validation, add compatibility diagnostics, and stop generation on schema, reference, semantic, or unsupported-capability errors.
4. Implement complete v1 generation and parse-back mappings, then enable mandatory round-trip validation in `build`.
5. Add the v2 collaboration model and generator mappings, followed by explicit v1-to-v2 migration for unambiguous inputs.
6. Update the skill, references, examples, and capability claims only after the matching positive, negative, and round-trip tests pass.
7. Remove the implicit-version compatibility path in a later separately specified breaking release after usage and migration feedback are reviewed.

Rollback is non-destructive: v1 remains supported, migration writes a separate output, and no in-place rewrite is required. If v2 generation must be disabled, the dispatcher can reject v2 while existing v1 artifacts continue to build.

## Open Questions

- The exact release number or date after which unversioned v1 input becomes an error must be chosen before publishing the transition release.
- The first capability-matrix baseline must be approved during implementation; advanced families that lack proven semantic round-trip coverage will begin as unsupported.
- Explicit user-supplied ownership mapping for ambiguous multi-participant v1 migration is deferred; until specified, those migrations fail closed.
