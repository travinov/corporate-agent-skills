## Context

The repository currently contains a mature `publish-drawio-skill/` package for presentation-oriented diagrams and two BPMN planning documents under `bpmn/`. It does not yet contain a dedicated BPMN skill or a deterministic BPMN 2.0 generation toolchain.

The target system has two layers:

- `bpmn-architect` skill: agent instructions and references for process intake, modeling policy, `process.yaml` authoring, build execution, and validation review.
- `corp-bpmn` CLI: local Node.js toolchain that validates YAML, generates BPMN 2.0 XML, adds BPMN DI layout, runs validation, and writes documentation/report artifacts.

The project must remain local-first: process content must not depend on external SaaS, public renderers, or external MCP servers. Approved or internal npm registries are acceptable for CLI dependencies.

## Goals / Non-Goals

**Goals:**

- Build a self-contained `publish-bpmn-skill/` package that mirrors the publishable structure used by `publish-drawio-skill/`.
- Make `process.yaml` the source of truth for generated BPMN artifacts.
- Generate BPMN 2.0 XML through deterministic code, not direct LLM-authored final XML.
- Support full BPMN 2.0 semantics in the YAML model and XML generation path.
- Keep modeling simple by default and escalate to advanced BPMN only when business semantics require it.
- Produce `process.bpmn`, `process.md`, and `validation-report.json` through one build command.
- Report layout and engine-specific limits honestly instead of hiding or treating them as unsupported process semantics.

**Non-Goals:**

- Building a web BPMN editor/viewer.
- Building an MCP wrapper in the first delivery.
- Replacing the existing draw.io skill.
- Requiring SVG/PNG export for the first delivery.
- Guaranteeing perfect auto-layout for every rare BPMN 2.0 construct without warnings.

## Decisions

### Decision: Use `process.yaml` as the agent-facing source of truth

The skill will instruct the agent to create and edit `process.yaml`, then run `corp-bpmn build`.

Alternatives considered:

- Direct LLM-authored `.bpmn`: rejected because it makes refs, DI, and validation fragile.
- Mermaid/PlantUML BPMN-like syntax: rejected because it does not preserve full BPMN 2.0 semantics.

Rationale: YAML is reviewable in Git, easier for agents to produce consistently, and can be schema-validated before BPMN XML exists.

### Decision: Bundle `corp-bpmn` inside `publish-bpmn-skill/scripts/corp-bpmn`

The CLI will live inside the skill package so the skill can call a known local implementation.

Alternatives considered:

- Separate repo/package only: useful later, but creates bootstrapping friction for skill users.
- MCP-only tool: rejected for the first delivery because MCP is explicitly optional and not required for local CLI workflows.

Rationale: This matches the existing draw.io skill pattern of bundled scripts while keeping a clean path to extracting the CLI later.

### Decision: Use Node.js dependencies proven by the research spec

The CLI will use `bpmn-moddle`, `bpmn-auto-layout`, `bpmnlint`, `yaml`, `ajv`, and `commander`.

Alternatives considered:

- Python XML generation: rejected because BPMN moddle support and auto-layout are stronger in the bpmn.io Node ecosystem.
- Browser-driven `bpmn-js`: rejected for generation because it adds unnecessary runtime complexity.

Rationale: The source spec already verified Node/npm compatibility and imports for the selected packages.

### Decision: Full BPMN support with capability reporting

The schema and generator should not impose an MVP whitelist of BPMN elements. Instead, each element family gets capability status for XML, layout, semantic lint, and engine lint.

Alternatives considered:

- Start with only tasks/events/gateways/lanes: rejected by project direction because users want full BPMN availability.
- Promise complete layout quality for every BPMN construct: rejected because rare constructs can require manual review even when XML generation is valid.

Rationale: The toolchain must be powerful without pushing complexity into ordinary diagrams.

### Decision: Separate validation layers

Validation will be split into schema validation, BPMN parse/structural validation, layout validation, corporate semantic lint, and optional engine lint.

Alternatives considered:

- Only use `bpmnlint:recommended`: insufficient for corporate rules such as task naming, lanes/actors, business cycles, and message-flow constraints.
- Only custom validation: unnecessary because `bpmnlint` already covers standard BPMN checks.

Rationale: Layering makes reports actionable and avoids mixing visual warnings with semantic errors.

## Risks / Trade-offs

- Full BPMN YAML coverage may make the schema large -> Mitigation: structure schema by element families and keep common simple forms ergonomic.
- `bpmn-auto-layout` may not confidently place all advanced constructs -> Mitigation: emit layout warnings and require manual review only for affected constructs.
- Agent may overuse advanced BPMN because support exists -> Mitigation: encode the complexity policy in `SKILL.md`, intake reference, process docs, and tests.
- Engine-specific validation can diverge across Camunda, Zeebe, Flowable, and corporate profiles -> Mitigation: make `target_engine` explicit and skip engine rules when set to `none`.
- npm registry access may differ in corporate environments -> Mitigation: document approved/internal registry use and keep dependency list minimal.

## Migration Plan

1. Add `publish-bpmn-skill/` alongside `publish-drawio-skill/`.
2. Add the bundled `corp-bpmn` CLI with package-local dependencies.
3. Add examples and tests that run without external services.
4. Keep generated user artifacts under `diagrams/<process-id>/`, not inside OpenSpec change folders.
5. Leave existing draw.io functionality untouched.

Rollback is straightforward: remove `publish-bpmn-skill/` and OpenSpec change artifacts. No existing runtime or data migration is required.

## Open Questions

- Should the first implementation install dependencies inside `publish-bpmn-skill/scripts/corp-bpmn/` only, or also expose a root-level convenience script?
- Should default `process.md` language follow the user's process description language, or should generated developer sections remain English?
- Which engine profile should be implemented first after `target_engine: none`: `zeebe`, `camunda-platform`, or `corporate`?
