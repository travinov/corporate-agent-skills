## 1. Dependency and Contract Foundations

- [x] 1.1 Verify that the configured Python package source can resolve the intended supported ranges of `PyYAML` and `jsonschema`, and record the tested versions without changing package sources.
- [x] 1.2 Add a dependency manifest under `publish-drawio-skill/` for the supported `PyYAML` and `jsonschema` ranges and add a clean-environment import/version test.
- [x] 1.3 Add a shared validation finding/report module with stable layers, severities, codes, JSON Pointer paths, summary counts, deterministic ordering, JSON output, and strict warning promotion.
- [x] 1.4 Add version dispatch that selects bundled major schemas, treats missing versions as effective v1 with `contract.version.missing`, rejects unsupported versions, and never rewrites source files.

## 2. Versioned Roadmap Contract

- [x] 2.1 Replace the mutable roadmap schema entry point with `data/roadmap.v1.schema.json` using Draft 2020-12 metadata, strict object properties, reusable definitions, and explicit v1 version handling.
- [x] 2.2 Define and test exclusive calendar (`week`, `month`, `quarter`, `date`) and ordinal (`order`) roadmap variants, including task and milestone coordinate fields and matching baseline variants.
- [x] 2.3 Refactor `roadmap_validate.py` to collect schema findings separately from reference and semantic findings, including global duplicate ids, current and baseline refs, real calendar dates, range ordering, self-dependencies, and baseline compatibility.
- [x] 2.4 Extend roadmap comparison to deterministic task, milestone, dependency, and outcome deltas while preserving threshold-aware delayed, accelerated, unchanged, added, and removed milestone states.
- [x] 2.5 Add positive fixtures for every roadmap scale and baseline variant plus negative fixtures for every roadmap schema/reference/semantic finding code.
- [x] 2.6 Add regression tests for unversioned compatibility warnings, unsupported versions, unknown properties, mixed coordinates, invalid dates, duplicate ids, unresolved baseline refs, and deterministic delta ordering.

## 3. Roadmap Rendering Corrections

- [x] 3.1 Implement separate tick and coordinate transforms for week, month, quarter, date, and explicit ordinal scales, with deterministic default-lane behavior.
- [x] 3.2 Remove manual pre-escaping from `roadmap.py`, pass raw labels through one XML serializer, and add exact decoded-text tests for `&`, `<`, `>`, quotes, newlines, and Cyrillic.
- [x] 3.3 Render linked outcomes for both tasks and milestones using stable source-mapped cell ids.
- [x] 3.4 Render status and risk through distinct documented visual channels and add coverage tests for items that declare both values.
- [x] 3.5 Preserve required task, milestone, dependency, impact, and baseline-delta semantics in generated cells, edges, annotations, or the validation report, and reject any still-unsupported accepted field explicitly.
- [x] 3.6 Remove volatile or unordered output behavior and add a two-run byte-determinism regression test for every roadmap scale.

## 4. Versioned Git-flow Contract

- [x] 4.1 Add `data/gitflow.v1.schema.json` with Draft 2020-12 metadata, strict branch objects, discriminated event variants, and exclusive date/order time-mode variants.
- [x] 4.2 Refactor `gitflow_validate.py` to use version dispatch and shared reports while enforcing event-specific branch/from/to requirements before generator access.
- [x] 4.3 Add semantic checks for duplicate ids, resolved branch refs, real dates, self operations, duplicate branch creation, use-before-creation, and pre-existing branches.
- [x] 4.4 Normalize events once by semantic coordinate and original index, then use the normalized sequence for policy checks, lane sequencing, edge construction, and slot layout.
- [x] 4.5 Preserve relaxed versus strict canonical git-flow policy with stable finding codes, and keep custom workflow free of canonical-policy warnings.
- [x] 4.6 Add positive date/order/custom fixtures and negative fixtures for every structural, reference, chronology, lifecycle, and policy finding code.
- [x] 4.7 Add regressions proving an out-of-order input renders chronologically, same-time ties preserve source order, and a commit without `branch` fails before generation.
- [x] 4.8 Add two-run byte-determinism tests for builtin git-flow routing and verify automatic routing still falls back locally when Graphviz is unavailable.

## 5. Source-aware Draw.io Artifact Validation

- [x] 5.1 Extend `scripts/validate.py` with stable structural findings for XML parsing, graph roots, duplicate cell ids, parent/source/target refs, vertex/edge shape, and finite geometry while preserving existing CLI behavior.
- [x] 5.2 Add roadmap-profile validation that maps source ids to cells and verifies exact labels, selected-scale X coordinates, lane Y containment, dependencies, outcomes, status/risk channels, and milestone shift coverage.
- [x] 5.3 Add git-flow-profile validation that maps source events/branches to cells and verifies normalized chronology, lane placement, and required sequence/branch/merge edges.
- [x] 5.4 Add generic overlap, overflow, and text-fit warnings to the shared report without weakening existing strict readability checks.
- [x] 5.5 Add an explicit deterministic verification command that generates twice with identical normalized input/options and reports the first practical output difference.
- [x] 5.6 Add a local real-export smoke command that invokes a configured draw.io CLI, validates non-empty PNG signature and terminal `IEND`, and reports unavailable versus invalid export distinctly.
- [x] 5.7 Add malformed-artifact and semantic-mismatch fixtures covering every artifact validation finding code, including double-escaped labels and truncated PNG output.

## 6. Skill Workflow, Documentation, and Self-check

- [x] 6.1 Update `SKILL.md`, `README.md`, and roadmap/git-flow references with explicit v1 examples, schema migration guidance, validation stages, strict/relaxed behavior, and artifact/export commands while keeping BPMN out of this skill.
- [x] 6.2 Update every bundled roadmap and git-flow fixture/example to declare `schema_version: 1` and document the one-release unversioned compatibility warning.
- [x] 6.3 Add a local self-check that verifies configured package resolvability, installed dependency versions, schema compilation, minimal source validation, generation, source-aware artifact validation, and clear remediation output.
- [x] 6.4 Add documentation tests that fail if advertised fields, time scales, commands, schema versions, or dependency instructions drift from implemented contracts.

## 7. Focused Verification

- [x] 7.1 Compile every bundled schema with `Draft202012Validator.check_schema` and run the full positive/negative schema fixture matrix.
- [x] 7.2 Run the focused roadmap, git-flow, artifact-validator, intake, and documentation test modules in a clean Python environment provisioned from the configured package source.
- [x] 7.3 Run every bundled roadmap and git-flow example through strict source validation, generation, source-aware artifact validation, and two-run determinism checks.
- [x] 7.4 Run real draw.io PNG export smoke tests for representative roadmap and git-flow artifacts in a provisioned local environment and verify PNG framing.
- [x] 7.5 Run `openspec validate harden-drawio-skill-contracts --strict` and review each scenario against at least one positive or negative automated test before implementation handoff.
