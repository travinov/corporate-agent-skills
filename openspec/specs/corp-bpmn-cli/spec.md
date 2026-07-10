## Purpose

Define the local CLI that generates, lays out, validates, and documents BPMN process artifacts.
## Requirements
### Requirement: Provide local CLI commands
The system SHALL provide a local `corp-bpmn` CLI with `init`, `generate`, `layout`, `validate`, `build`, and `migrate` commands, and each command SHALL operate without requiring network access after dependencies are installed.

#### Scenario: CLI help
- **WHEN** a user runs the CLI with `--help`
- **THEN** it lists supported commands and usage without requiring network access

#### Scenario: Migration help
- **WHEN** a user runs `corp-bpmn migrate --help`
- **THEN** the CLI documents source validation, target schema version, explicit output path, and ambiguous-migration failure behavior

### Requirement: Initialize process workspace
The CLI SHALL create a process directory with canonical versioned starter artifacts.

#### Scenario: Default init command
- **WHEN** the user runs `corp-bpmn init diagrams/credit-approval`
- **THEN** the CLI creates a canonical v1 `process.yaml` with `schema_version: 1` and a matching `process.md` in that directory

#### Scenario: Collaboration init command
- **WHEN** the user explicitly initializes a v2 collaboration workspace
- **THEN** the CLI creates a canonical v2 starter with process-scoped elements and participant `process_ref` values

### Requirement: Generate BPMN XML from YAML
The CLI SHALL generate BPMN 2.0 XML only from a model that passes the selected schema, capability, reference, and semantic validation stages.

#### Scenario: Generate command
- **WHEN** the user runs `corp-bpmn generate diagrams/credit-approval/process.yaml --out diagrams/credit-approval/process.bpmn` with a valid supported model
- **THEN** the CLI writes a BPMN XML file that can be parsed by `bpmn-moddle` and preserves every accepted semantic field

#### Scenario: Pre-generation validation fails
- **WHEN** the input has an error-level schema, capability, reference, or semantic finding
- **THEN** the CLI exits non-zero and does not write a new BPMN output

#### Scenario: Unknown authored node type
- **WHEN** the input requests an unsupported node type
- **THEN** generation fails before XML serialization and does not substitute a generic `bpmn:Task`

### Requirement: Apply BPMN DI layout
The CLI SHALL add or update BPMN DI layout information for generated BPMN XML.

#### Scenario: Layout command
- **WHEN** the user runs `corp-bpmn layout process.bpmn --out process.bpmn`
- **THEN** the output contains `bpmndi:BPMNDiagram` and visual bounds/waypoints for applicable elements

### Requirement: Build all process artifacts
The CLI SHALL provide a `build` command that runs version resolution, schema validation, semantic validation, generation, layout, BPMN parse, semantic round-trip comparison, BPMN lint, engine checks, and documentation in the documented order.

#### Scenario: Successful build
- **WHEN** the user runs `corp-bpmn build diagrams/credit-approval/process.yaml` and all required layers pass
- **THEN** the CLI writes `process.bpmn`, `process.md`, and `validation-report.json` under `diagrams/credit-approval/`

#### Scenario: Semantic round-trip fails
- **WHEN** generated XML parses but its canonical semantic projection differs from the validated YAML projection
- **THEN** the build fails, records `roundtrip.*` error findings, and does not report the BPMN artifact as complete

#### Scenario: Partial capability in strict mode
- **WHEN** a build uses a capability marked `partial` and strict mode is enabled
- **THEN** the build fails with the capability warning preserved in `validation-report.json`

### Requirement: Return meaningful exit codes
The CLI SHALL return documented non-zero exit codes for parse, schema, capability, reference, semantic, generation, layout, artifact-parse, round-trip, migration, and unexpected runtime errors.

#### Scenario: Semantic errors found
- **WHEN** corporate semantic validation finds error-level findings
- **THEN** the CLI exits non-zero and writes those findings to `validation-report.json` when possible

#### Scenario: Schema errors found
- **WHEN** versioned schema validation fails
- **THEN** the CLI exits non-zero with stable finding codes and does not proceed to generation

#### Scenario: Migration errors found
- **WHEN** a migration is ambiguous or its generated target fails target-version validation
- **THEN** the CLI exits non-zero without modifying the source file

### Requirement: Migrate unambiguous v1 models to v2 explicitly
The CLI SHALL provide a non-destructive v1-to-v2 migration that validates the source, writes only to an explicit output path, validates the result, and reports migration findings.

#### Scenario: Single-participant v1 migration
- **WHEN** a valid v1 model has zero or one participant and the user supplies `--to-version 2 --out <path>`
- **THEN** the CLI writes a v2 model with one scoped process and an explicit participant `process_ref`

#### Scenario: Multiple-participant v1 migration
- **WHEN** a v1 model has multiple participants and no explicit ownership mapping exists
- **THEN** migration fails with `migration.ambiguous_process_ownership` and writes no target file

#### Scenario: Source rollback remains available
- **WHEN** a generated v2 migration is not accepted by the user
- **THEN** the original v1 file remains unchanged and buildable

### Requirement: Validate source-to-artifact preservation conditionally
The CLI SHALL run semantic round-trip validation for every build and for `validate` whenever source YAML is supplied.

#### Scenario: Validate with source YAML
- **WHEN** the user validates BPMN XML and supplies the authored YAML
- **THEN** the report includes source-to-artifact semantic comparison findings

#### Scenario: Validate without source YAML
- **WHEN** the user validates BPMN XML without authored YAML
- **THEN** artifact-only checks run, the report states that source preservation was not evaluated, and the CLI does not claim semantic equivalence
