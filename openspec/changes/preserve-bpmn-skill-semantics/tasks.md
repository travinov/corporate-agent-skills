## 1. Dependency and Capability Baseline

- [x] 1.1 Verify that every dependency pinned in `publish-bpmn-skill/scripts/corp-bpmn/package-lock.json` is resolvable from the configured approved npm registry, and record any unavailable package before implementation starts.
- [x] 1.2 Run a clean `npm ci` and the current BPMN test suite to capture the pre-change dependency and behavior baseline.
- [x] 1.3 Create a versioned capability-matrix data file for v1 and v2 with `supported`, `partial`, and `unsupported` states plus semantic, layout, engine, and test-evidence fields.
- [x] 1.4 Classify every currently advertised node type, event definition, condition, gateway default, participant, message flow, data/artifact field, and engine extension against actual end-to-end behavior.
- [x] 1.5 Add a self-check that rejects malformed capability rows and prevents `supported` status without linked positive, negative, and round-trip test evidence.

## 2. Versioned Process Schemas

- [x] 2.1 Create `process.v1.schema.json` as JSON Schema 2020-12 with a stable `$id`, required integer `schema_version: 1`, strict root properties, and reusable id and documentation definitions.
- [x] 2.2 Define strict discriminated v1 variants for every capability-matrix-supported task, event, gateway, activity, lane, participant, data, artifact, and flow shape.
- [x] 2.3 Define the canonical v1 sequence-flow condition object with required `body`, optional `language`, and compatibility constraints for flow and gateway types.
- [x] 2.4 Restrict v1 gateway `default` to an id-shaped sequence-flow reference and document that target-node defaults are invalid.
- [x] 2.5 Restrict vendor and engine data to documented `extensions` containers and reject arbitrary properties on all contract-owned v1 objects.
- [x] 2.6 Create `process.v2.schema.json` as JSON Schema 2020-12 with a stable `$id`, required integer `schema_version: 2`, strict definitions metadata, `processes`, `participants`, and `message_flows` roots.
- [x] 2.7 Define strict v2 process items that own lanes, nodes, sequence flows, data, artifacts, extensions, and documentation, and reject global v1 `nodes` and `flows`.
- [x] 2.8 Define v2 participants with required `process_ref` and message-flow endpoint shapes for documented participant and eligible flow-node endpoints.
- [x] 2.9 Add a schema-version dispatcher that selects exactly one shipped schema, treats an absent version as transitional v1 with `schema.version_implicit`, and rejects malformed or unsupported versions without fallback.
- [x] 2.10 Compile every shipped schema with the same Ajv 2020 configuration during startup/self-check and remove the permissive legacy single-schema path.
- [x] 2.11 Add positive and negative schema fixtures for every discriminated variant, required property, additional-property boundary, extension container, condition shape, and version-dispatch outcome.

## 3. Reference, Semantic, and Capability Validation

- [x] 3.1 Refactor id validation into a collect-then-resolve pipeline so forward references are order-independent and duplicate ids are checked definitions-wide.
- [x] 3.2 Implement v1 reference checks for lanes, participants, flow endpoints, boundary attachments, event references, message endpoints, and gateway defaults.
- [x] 3.3 Implement v2 scoped reference checks for process-local sequence flows, participant `process_ref`, cross-owner message flows, eligible endpoint types, and definitions-wide id uniqueness.
- [x] 3.4 Reject sequence flows whose v2 endpoints cross process boundaries and message flows whose endpoints remain within one ownership boundary.
- [x] 3.5 Validate that every gateway default resolves to a sequence flow whose source is that gateway and emit a path-specific stable finding otherwise.
- [x] 3.6 Validate condition placement and preserve the existing rule that explicit labeled or conditioned exclusive branches do not require an arbitrary default.
- [x] 3.7 Add capability validation that emits `capability.unsupported` before generation and emits warnings for partial capabilities that fail strict mode.
- [x] 3.8 Remove authored-type fallback behavior from the validation/generation boundary so an unknown or unsupported node can never become a generic task.
- [x] 3.9 Add regressions proving boundary-event forward references pass, unresolved references fail, duplicate ids fail, invalid defaults fail, and valid labeled/conditioned branching passes.

## 4. Stable Validation Report Contract

- [x] 4.1 Replace the report `version` field with independent `report_version` and add declared and resolved `schema_version` metadata without coupling the two version lifecycles.
- [x] 4.2 Normalize findings to stable parse, schema, references, semantics, generation, artifact-parse, round-trip, layout, BPMN lint, engine, capability, and migration layer names.
- [x] 4.3 Map Ajv keywords to stable codes such as `schema.required`, `schema.additional_property`, and variant-specific errors while retaining JSON Pointer paths and affected properties.
- [x] 4.4 Ensure all reference, capability, migration, and round-trip findings include stable codes plus `path` and `element` when applicable, and keep human message text non-normative.
- [x] 4.5 Make pre-generation error reports omit downstream success claims and make artifact-only validation state explicitly that source preservation was not evaluated.
- [x] 4.6 Add report-contract tests that assert `report_version`, schema resolution, summary behavior, strict-mode warning failure, and finding identity without parsing messages.

## 5. V1 Semantic Preservation and Round-Trip

- [x] 5.1 Update v1 generation to emit `bpmn:conditionExpression` with the documented condition body and language mapping.
- [x] 5.2 Update v1 generation to resolve gateway defaults only by outgoing sequence-flow id and fail generation if a validated reference cannot be mapped.
- [x] 5.3 Complete generation mappings for every v1 field marked supported, including boundary attachment, supported event definitions, documentation, lanes, participants, message flows, and supported extensions.
- [x] 5.4 Build an id-keyed canonical semantic projection from validated v1 and v2 source models, excluding only documented non-semantic serialization and DI details.
- [x] 5.5 Build the equivalent canonical projection from BPMN definitions parsed by `bpmn-moddle`, including ownership, conditions, defaults, events, documentation, message endpoints, and supported extensions.
- [x] 5.6 Implement deterministic projection comparison with stable `roundtrip.*` mismatch codes and element/path context.
- [x] 5.7 Integrate mandatory round-trip comparison into `build` and source-aware `validate`, while preserving artifact-only parse, structure, lint, layout, and engine checks.
- [x] 5.8 Add semantic regressions for preserved conditions, default-flow ids, forward boundary attachments, event definitions, documentation, and each supported extension field.
- [x] 5.9 Add negative round-trip tests that deliberately omit or alter each protected semantic family and verify that a parseable BPMN artifact still fails validation.

## 6. V2 Collaboration and Migration

- [x] 6.1 Refactor generation around normalized process scopes so v1 produces one BPMN process and v2 produces one BPMN process root element per process item.
- [x] 6.2 Generate one v2 participant per authored participant with the exact referenced BPMN process instead of assigning all participants to one process.
- [x] 6.3 Generate v2 process-local lanes, nodes, and sequence flows and preserve cross-participant message-flow endpoints in the collaboration.
- [x] 6.4 Adapt layout input and validation so multi-process collaboration preserves ownership and reports partial readability as a warning without changing semantics.
- [x] 6.5 Add `corp-bpmn migrate <input> --to-version 2 --out <output>` with source validation, explicit non-destructive output, target validation, and migration-layer findings.
- [x] 6.6 Implement deterministic migration for valid v1 inputs with zero or one participant, including a deterministic participant when v1 has none.
- [x] 6.7 Reject v1 migration with multiple participants as `migration.ambiguous_process_ownership` until an explicit ownership-mapping contract is separately specified.
- [x] 6.8 Validate migrated output against v2 and round-trip it through BPMN before reporting migration success, leaving the source unchanged on every failure.
- [x] 6.9 Add two-process, participant-level message flow, node-level message flow, invalid cross-process sequence flow, same-process message flow, missing process ref, and ambiguous migration fixtures.

## 7. CLI, Starter Artifacts, and Skill Guidance

- [x] 7.1 Update `init` to emit canonical `schema_version: 1` starter YAML and add an explicit option for a canonical v2 collaboration starter.
- [x] 7.2 Update `generate`, `validate`, and `build` to use version dispatch, stop before output on pre-generation errors, and preserve reports when failure reporting is possible.
- [x] 7.3 Add the `migrate` command, documented exit behavior, and help text to the CLI command registry.
- [x] 7.4 Update `process.md` generation with process schema version, capability status, validation outcome, migration provenance, assumptions, and advanced-element rationale.
- [x] 7.5 Update `publish-bpmn-skill/SKILL.md` to choose v1 for common single-process work, route true multi-pool ownership to v2, and avoid unsupported BPMN claims.
- [x] 7.6 Update `references/process-yaml.md` with complete v1/v2 skeletons, canonical conditions, default-flow ids, extensions, and migration examples.
- [x] 7.7 Update authoring, intake, validation, engine, and troubleshooting references with capability states, strict-mode effects, collaboration ownership questions, and stable finding codes.
- [x] 7.8 Update all checked-in BPMN examples to explicit schema versions and ensure starter and example content matches the strict schemas and documented capability matrix.

## 8. Verification and Skill Packaging

- [x] 8.1 Add scenario-to-test traceability covering every requirement and scenario in the six change specs, with positive and negative cases keyed to stable finding codes.
- [x] 8.2 Run all schema, reference, semantic, generation, round-trip, migration, CLI, layout, and report tests from a clean dependency install.
- [x] 8.3 Run `init` and every checked-in example through `corp-bpmn build --strict` and resolve all warnings or explicitly reclassify unsupported/partial capabilities.
- [x] 8.4 Run two identical builds for representative v1 and v2 fixtures and verify deterministic YAML migration, BPMN semantic projections, and validation reports apart from documented source paths.
- [x] 8.5 Run the package self-check from a temporary copy containing only files intended for `publish-bpmn-skill`, proving schemas, capability data, dependencies, and fixtures are locally available.
- [x] 8.6 Rebuild the BPMN skill ZIP through the repository release workflow and verify its unpacked CLI passes schema compilation, v1 build, v2 collaboration build, migration, and round-trip smoke tests.
- [x] 8.7 Re-run `openspec validate preserve-bpmn-skill-semantics --strict` after implementation and mark tasks complete only when the strict validation and scoped BPMN checks pass.
