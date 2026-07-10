## ADDED Requirements

### Requirement: Build canonical semantic projections
The system SHALL normalize the validated source model and the BPMN XML parsed by `bpmn-moddle` into comparable semantic projections keyed by stable BPMN ids.

#### Scenario: Ordering differs but semantics match
- **WHEN** YAML collection order or XML serialization order differs while ids, ownership, references, and semantic values are equal
- **THEN** the canonical projections compare equal

#### Scenario: Non-semantic generated details differ
- **WHEN** generated namespace boilerplate, derived ids, XML formatting, or BPMN DI coordinates differ
- **THEN** the semantic comparison ignores those documented non-semantic differences

#### Scenario: Definitions-wide ids repeat
- **WHEN** the parsed artifact contains duplicate semantic ids
- **THEN** projection construction reports an error instead of overwriting an earlier element

### Requirement: Compare every accepted semantic field
The round-trip validator SHALL compare every field classified as semantic for the selected schema version and supported capability.

#### Scenario: Sequence-flow condition is preserved
- **WHEN** source YAML defines a condition body and optional language on a supported sequence flow
- **THEN** the parsed BPMN projection contains an equivalent `conditionExpression`

#### Scenario: Gateway default is preserved
- **WHEN** source YAML declares an outgoing sequence-flow id as a gateway default
- **THEN** the parsed BPMN gateway references that same sequence-flow id

#### Scenario: Boundary event attachment is preserved
- **WHEN** source YAML attaches a supported boundary event to an activity
- **THEN** the parsed BPMN projection preserves the activity reference and supported event definition

#### Scenario: Collaboration ownership is preserved
- **WHEN** a v2 model maps participants to distinct processes and defines cross-process message flows
- **THEN** the parsed BPMN projection preserves each participant process reference and each message-flow endpoint

#### Scenario: Supported extension is preserved
- **WHEN** a capability-matrix row admits an engine or vendor extension as supported
- **THEN** the projection comparison includes its documented semantic fields

### Requirement: Fail the build on semantic loss
Any source-to-artifact mismatch in a supported semantic field SHALL produce an error-level finding and SHALL prevent a successful build result.

#### Scenario: Condition disappears during generation
- **WHEN** source YAML contains a valid condition but parsed BPMN XML lacks it
- **THEN** validation emits a `roundtrip.condition_missing` error identifying the flow and condition path

#### Scenario: Participant points to the wrong process
- **WHEN** parsed BPMN maps a participant to a process other than its v2 `process_ref`
- **THEN** validation emits a process-ownership mismatch error and the build fails

#### Scenario: Semantic value changes
- **WHEN** a supported semantic value differs between source and parsed BPMN
- **THEN** the report identifies the affected element or JSON Pointer with a stable `roundtrip.*` code

### Requirement: Require source context for preservation claims
The system SHALL claim semantic preservation only when a validated source model and parsed BPMN artifact were compared in the same validation run.

#### Scenario: Build command validates preservation
- **WHEN** `corp-bpmn build` generates an artifact from YAML
- **THEN** semantic round-trip validation is mandatory before the build can pass

#### Scenario: Validate command includes YAML
- **WHEN** `corp-bpmn validate` receives both BPMN XML and source YAML
- **THEN** semantic round-trip results are included in the report

#### Scenario: Artifact-only validation
- **WHEN** BPMN XML is validated without source YAML
- **THEN** the report states that preservation was not evaluated and does not emit a semantic-preservation success claim

### Requirement: Bind capability support to round-trip evidence
A BPMN family or schema field SHALL be marked `supported` only when positive, negative, and source-to-artifact round-trip tests cover its semantic mapping.

#### Scenario: Capability lacks round-trip coverage
- **WHEN** a family has schema and generator code but no semantic parse-back comparison test
- **THEN** the capability matrix cannot classify it as supported

#### Scenario: Capability regression loses a field
- **WHEN** a code change causes a previously supported semantic field to disappear or change
- **THEN** its round-trip regression test fails before release packaging

#### Scenario: Partial capability preserves semantics
- **WHEN** a family is classified partial because layout or engine review is incomplete
- **THEN** its core semantic fields still pass round-trip comparison
