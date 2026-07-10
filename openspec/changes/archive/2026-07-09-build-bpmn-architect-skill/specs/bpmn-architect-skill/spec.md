## ADDED Requirements

### Requirement: Trigger BPMN Architect for semantic BPMN work
The system SHALL route semantic BPMN creation, review, validation, and editing requests to the `bpmn-architect` skill.

#### Scenario: User requests BPMN from a process description
- **WHEN** the user asks to create a BPMN process model from text or a document
- **THEN** the agent uses `bpmn-architect` instead of producing a generic flowchart

#### Scenario: User requests a presentation-only diagram
- **WHEN** the user asks only for a visual process diagram without BPMN semantics
- **THEN** the agent explains the difference and may route to the draw.io skill for presentation output

### Requirement: Generate process YAML before BPMN XML
The skill SHALL make `process.yaml` the primary artifact created or edited by the agent.

#### Scenario: New process generation
- **WHEN** the user provides enough process information to proceed
- **THEN** the agent writes `process.yaml` and invokes `corp-bpmn build` rather than hand-authoring final BPMN XML as the source of truth

### Requirement: Prefer simple BPMN constructs by default
The skill SHALL choose the simplest BPMN construct that preserves business meaning.

#### Scenario: Simple approval process
- **WHEN** an approval process can be represented with events, tasks, exclusive gateways, lanes, and sequence flows without losing meaning
- **THEN** the agent does not introduce boundary events, transactions, compensation, choreography, or other advanced BPMN constructs

#### Scenario: Advanced construct is required
- **WHEN** a simpler construct would distort the business semantics or the user explicitly requests an advanced BPMN construct
- **THEN** the agent may use the advanced construct and records the reason in generated process documentation

### Requirement: Run build and inspect validation before final response
The skill SHALL require build and validation feedback before declaring BPMN artifacts complete.

#### Scenario: Validation succeeds
- **WHEN** `corp-bpmn build` completes with no error-level findings
- **THEN** the agent reports artifact paths and summarizes warnings, if any

#### Scenario: Validation fails
- **WHEN** `validation-report.json` contains error-level findings
- **THEN** the agent fixes `process.yaml` when feasible and reruns the build before asking the user to review the result

### Requirement: Enforce local-first process handling
The skill SHALL forbid external SaaS, online renderers, public APIs, and external MCP servers as required processing dependencies for process content.

#### Scenario: Toolchain execution
- **WHEN** the agent builds BPMN artifacts
- **THEN** it uses local files, bundled scripts, and approved local/internal dependencies only
