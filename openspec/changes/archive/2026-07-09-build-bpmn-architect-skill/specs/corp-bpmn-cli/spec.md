## ADDED Requirements

### Requirement: Provide local CLI commands
The system SHALL provide a local `corp-bpmn` CLI with `init`, `generate`, `layout`, `validate`, and `build` commands.

#### Scenario: CLI help
- **WHEN** a user runs the CLI with `--help`
- **THEN** it lists supported commands and usage without requiring network access

### Requirement: Initialize process workspace
The CLI SHALL create a process directory with starter artifacts.

#### Scenario: Init command
- **WHEN** the user runs `corp-bpmn init diagrams/credit-approval`
- **THEN** the CLI creates a starter `process.yaml` and `process.md` in that directory

### Requirement: Generate BPMN XML from YAML
The CLI SHALL generate BPMN 2.0 XML from validated `process.yaml`.

#### Scenario: Generate command
- **WHEN** the user runs `corp-bpmn generate diagrams/credit-approval/process.yaml --out diagrams/credit-approval/process.bpmn`
- **THEN** the CLI writes a BPMN XML file that can be parsed by `bpmn-moddle`

### Requirement: Apply BPMN DI layout
The CLI SHALL add or update BPMN DI layout information for generated BPMN XML.

#### Scenario: Layout command
- **WHEN** the user runs `corp-bpmn layout process.bpmn --out process.bpmn`
- **THEN** the output contains `bpmndi:BPMNDiagram` and visual bounds/waypoints for applicable elements

### Requirement: Build all process artifacts
The CLI SHALL provide a `build` command that runs generation, layout, validation, and documentation.

#### Scenario: Successful build
- **WHEN** the user runs `corp-bpmn build diagrams/credit-approval/process.yaml`
- **THEN** the CLI writes `process.bpmn`, `process.md`, and `validation-report.json` under `diagrams/credit-approval/`

### Requirement: Return meaningful exit codes
The CLI SHALL return non-zero exit codes for schema, generation, layout, parse, semantic, and unexpected runtime errors.

#### Scenario: Semantic errors found
- **WHEN** corporate semantic validation finds error-level findings
- **THEN** the CLI exits non-zero and writes those findings to `validation-report.json` when possible
