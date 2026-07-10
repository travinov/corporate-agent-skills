## ADDED Requirements

### Requirement: Provide a schema-validated process YAML model
The system SHALL define a JSON Schema for `process.yaml` and validate YAML before BPMN generation.

#### Scenario: Valid YAML
- **WHEN** `process.yaml` satisfies the schema
- **THEN** `corp-bpmn generate` proceeds to BPMN XML generation

#### Scenario: Invalid YAML
- **WHEN** `process.yaml` is missing required fields, has duplicate ids, invalid ids, invalid element types, or unresolved references
- **THEN** generation fails with a clear schema or reference error

### Requirement: Represent full BPMN 2.0 semantics
The YAML model SHALL support full BPMN 2.0 semantic families without imposing a small element whitelist.

#### Scenario: Advanced BPMN element appears
- **WHEN** `process.yaml` includes a subprocess, transaction, boundary event, event definition, data object, message flow, collaboration, compensation, choreography, conversation, or extension element
- **THEN** schema validation accepts the element if it follows the documented shape for that family

### Requirement: Preserve simple authoring for common processes
The YAML model SHALL keep common task/event/gateway/lane flows concise even while supporting advanced BPMN.

#### Scenario: Simple process YAML
- **WHEN** the process only needs start events, tasks, gateways, lanes, and end events
- **THEN** the YAML does not require advanced BPMN fields or engine-specific fields

### Requirement: Support explicit target engine profiles
The YAML model SHALL include an optional `target_engine` setting.

#### Scenario: No execution engine selected
- **WHEN** `target_engine` is `none` or omitted
- **THEN** engine-specific fields are not required for schema success

#### Scenario: Engine selected
- **WHEN** `target_engine` is set to a supported engine profile
- **THEN** validation may apply additional engine-specific requirements and report them separately

### Requirement: Keep YAML stable for Git review
The YAML model SHALL use deterministic ids, stable ordering, and explicit refs so process changes are reviewable in Git.

#### Scenario: Process edited
- **WHEN** a process task name or flow changes
- **THEN** the YAML diff shows the semantic change without unrelated reordering
