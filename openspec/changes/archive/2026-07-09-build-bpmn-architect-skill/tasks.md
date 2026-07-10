## 1. Package Structure

- [x] 1.1 Create `publish-bpmn-skill/` with `SKILL.md`, `README.md`, `metadata.md`, and package-level metadata following the existing corporate skill style.
- [x] 1.2 Create reference files under `publish-bpmn-skill/references/` for intake, process YAML, BPMN authoring, layout, validation, Camunda/Zeebe, and troubleshooting.
- [x] 1.3 Create `publish-bpmn-skill/scripts/corp-bpmn/` with Node package metadata, CLI entrypoint, command folders, core modules, schemas, and rules folders.
- [x] 1.4 Add `publish-bpmn-skill/examples/credit-approval/process.yaml` as the first end-to-end sample.
- [x] 1.5 Add test directories and fixtures under `publish-bpmn-skill/tests/`.

## 2. Skill Instructions

- [x] 2.1 Write `SKILL.md` trigger rules for semantic BPMN work, BPMN review/editing, and distinction from presentation-only draw.io diagrams.
- [x] 2.2 Encode the complexity policy: prefer the simplest BPMN construct that preserves business meaning and use advanced constructs only when required or requested.
- [x] 2.3 Document the required workflow: intake, complexity decision, `process.yaml`, `corp-bpmn build`, validation review, correction loop, and final artifact report.
- [x] 2.4 Document local-first constraints prohibiting external SaaS, online renderers, public APIs, and external MCP servers for process content.
- [x] 2.5 Add reference routing so agents load detailed files only when needed.

## 3. Process YAML Model

- [x] 3.1 Implement `process.schema.json` for required process metadata, participants, lanes, nodes, flows, message flows, data, artifacts, extensions, and documentation.
- [x] 3.2 Support full BPMN 2.0 semantic families in schema without an artificial MVP element whitelist.
- [x] 3.3 Keep common event/task/gateway/lane process YAML concise without requiring advanced or engine-specific fields.
- [x] 3.4 Implement YAML reader and AJV validator modules.
- [x] 3.5 Add schema validation tests for valid simple YAML, valid advanced YAML, duplicate ids, invalid ids, and unresolved refs.

## 4. BPMN Generation

- [x] 4.1 Implement `generate` command wiring for reading YAML, validating schema, and writing BPMN XML.
- [x] 4.2 Implement `bpmn-generator.mjs` using `bpmn-moddle` for definitions, process, collaboration, participants, lanes, flow nodes, sequence flows, message flows, and extensions.
- [x] 4.3 Ensure generated BPMN can be parsed by `bpmn-moddle`.
- [x] 4.4 Preserve deterministic ids and stable ordering for Git-friendly output.
- [x] 4.5 Add generation tests for simple approval, lane-based process, collaboration with message flow, subprocess, and event-definition fixtures.

## 5. Layout

- [x] 5.1 Implement `layout` command using `bpmn-auto-layout`.
- [x] 5.2 Ensure layout output contains BPMN DI diagrams, shapes, bounds, and edges for applicable elements.
- [x] 5.3 Add capability warnings for advanced BPMN families where layout confidence is partial.
- [x] 5.4 Add layout validation checks for missing shapes, missing edges, negative coordinates, severe overlaps, and unreadably small bounds.
- [x] 5.5 Add layout tests against generated fixture BPMN.

## 6. Validation and Reporting

- [x] 6.1 Implement `validate` command and layered `validation-report.json` output.
- [x] 6.2 Run BPMN parse validation and `bpmnlint:recommended`.
- [x] 6.3 Implement corporate semantic rules for start/end presence, reachability, dead ends, disconnected nodes, exclusive gateway labels/defaults, lane/actor requirements, service task system hints, message-flow boundaries, parallel split/join mismatch, implicit splits, and task naming warnings.
- [x] 6.4 Implement cycle classification that allows cycles with explicit reachable exits and fails cycles without exits.
- [x] 6.5 Implement optional engine-specific validation keyed by `process.target_engine`.
- [x] 6.6 Add validation tests for each valid and invalid fixture category.

## 7. Build and Documentation

- [x] 7.1 Implement `build` command that runs validate YAML, generate, layout, validate BPMN, semantic lint, documentation, and report generation.
- [x] 7.2 Implement `init` command that creates starter `process.yaml` and `process.md`.
- [x] 7.3 Implement `documentation-generator.mjs` to write `process.md` with process purpose, participants, happy path, decisions, exception paths, assumptions, validation summary, warnings, and advanced element rationale.
- [x] 7.4 Implement exit codes for schema, generation, layout, parse/lint, semantic, and unexpected runtime failures.
- [x] 7.5 Add end-to-end build tests verifying `process.bpmn`, `process.md`, and `validation-report.json` are produced.

## 8. Final Verification

- [x] 8.1 Run the CLI test suite from `publish-bpmn-skill/scripts/corp-bpmn/`.
- [x] 8.2 Run an end-to-end build for the credit approval example.
- [x] 8.3 Verify generated BPMN contains BPMN DI and parses with `bpmn-moddle`.
- [x] 8.4 Run `openspec validate build-bpmn-architect-skill`.
- [x] 8.5 Review `publish-bpmn-skill/` against the OpenSpec requirements and source SDD documents for missing behavior.
