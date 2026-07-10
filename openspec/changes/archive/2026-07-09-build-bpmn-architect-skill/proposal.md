## Why

Business-process modeling requests currently rely on ad hoc diagram generation or presentation-oriented `.drawio` output. The project needs a local, spec-driven BPMN workflow that produces real BPMN 2.0 XML, keeps process data inside the corporate environment, and validates both model structure and business-process semantics before claiming success.

## What Changes

- Introduce a `bpmn-architect` skill for GigaCode/Codex-style agents that turns process descriptions and source documents into `process.yaml`.
- Introduce a local `corp-bpmn` CLI/toolchain that deterministically generates `process.bpmn`, applies BPMN DI layout, validates the result, and writes `process.md` plus `validation-report.json`.
- Define a full BPMN 2.0 capability policy: the toolchain must accept full BPMN semantics, while the skill defaults to the simplest construct that preserves business meaning.
- Add schema, validation, semantic lint, documentation, examples, and test fixtures for the BPMN workflow.
- Keep the workflow local-first: no external SaaS, online renderers, or external MCP servers for process data.

## Capabilities

### New Capabilities

- `bpmn-architect-skill`: Agent workflow for intake, complexity selection, `process.yaml` creation, build execution, validation review, and final artifact reporting.
- `process-yaml-model`: Stable intermediate YAML model that represents BPMN 2.0 semantics and can be validated before XML generation.
- `corp-bpmn-cli`: Local CLI commands for initialization, generation, layout, validation, documentation, and full build.
- `bpmn-validation-reporting`: Structural, semantic, layout, and optional engine-specific validation with machine-readable reports and human-facing summaries.

### Modified Capabilities

- None. This change introduces the first OpenSpec capabilities for the BPMN toolchain.

## Impact

- Adds a new `publish-bpmn-skill/` package with skill instructions, references, examples, tests, and bundled CLI sources.
- Adds npm dependencies for the bundled CLI: `bpmn-moddle`, `bpmn-auto-layout`, `bpmnlint`, `yaml`, `ajv`, and `commander`.
- Establishes generated artifact layout under `diagrams/<process-id>/`.
- Uses existing planning sources `bpmn/bpmn_toolchain_spec_gigacode.md` and `bpmn/bpmn_architect_sdd_spec.md` as design inputs.
- Does not change `publish-drawio-skill/`; draw.io remains the route for presentation diagrams rather than semantic BPMN models.
