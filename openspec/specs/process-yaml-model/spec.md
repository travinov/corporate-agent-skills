## Purpose

Define the stable intermediate YAML model that represents BPMN 2.0 semantics before deterministic XML generation.
## Requirements
### Requirement: Provide a schema-validated process YAML model
The system SHALL define separately addressable JSON Schema 2020-12 contracts for canonical v1 and v2 `process.yaml` documents and SHALL complete parse, schema, capability, and reference validation before BPMN generation begins.

#### Scenario: Valid versioned YAML
- **WHEN** `process.yaml` declares a supported `schema_version` and satisfies that version's schema and semantic reference rules
- **THEN** `corp-bpmn generate` proceeds to BPMN XML generation using only that version's contract

#### Scenario: Invalid YAML
- **WHEN** `process.yaml` is missing required fields, has duplicate ids, invalid ids, invalid element shapes, unknown contract properties, or unresolved references
- **THEN** generation fails before writing BPMN XML with findings that identify the validation layer, stable code, and source path

#### Scenario: Unsupported schema version
- **WHEN** `process.yaml` declares a schema version not shipped by the toolchain
- **THEN** validation reports `schema.version_unsupported` and does not fall back to another schema

### Requirement: Represent full BPMN 2.0 semantics
The YAML model SHALL expose BPMN semantic families incrementally through a tested capability matrix, and SHALL accept a family or field as supported only when its schema, generation, parse-back, semantic comparison, and required validation mappings are implemented end to end.

#### Scenario: Supported BPMN element appears
- **WHEN** `process.yaml` includes an element family marked `supported` for the selected schema version
- **THEN** schema validation accepts its documented shape and the toolchain preserves its semantic fields through BPMN XML generation and round-trip validation

#### Scenario: Partially supported BPMN element appears
- **WHEN** `process.yaml` includes an element family marked `partial` whose core semantics round-trip but whose layout or engine validation requires manual review
- **THEN** validation emits a capability warning, normal mode may continue, and strict mode fails

#### Scenario: Unsupported BPMN element appears
- **WHEN** `process.yaml` requests an element family or recognizable extension marked `unsupported` for the selected schema version
- **THEN** validation reports `capability.unsupported` before generation and the generator does not coerce the element to a generic BPMN type

### Requirement: Preserve simple authoring for common processes
The YAML model SHALL keep common task/event/gateway/lane flows concise even while supporting advanced BPMN.

#### Scenario: Simple process YAML
- **WHEN** the process only needs start events, tasks, gateways, lanes, and end events
- **THEN** the YAML does not require advanced BPMN fields or engine-specific fields

### Requirement: Support explicit target engine profiles
The YAML model SHALL include an optional `target_engine` setting and SHALL admit engine-specific fields only in documented extension containers covered by the selected engine profile and capability matrix.

#### Scenario: No execution engine selected
- **WHEN** `target_engine` is `none` or omitted
- **THEN** engine-specific fields are not required for schema success and undocumented engine properties are rejected

#### Scenario: Engine selected
- **WHEN** `target_engine` is set to a supported engine profile
- **THEN** validation applies the documented engine-specific schema and semantic requirements and reports them in the engine layer

#### Scenario: Unsupported engine extension
- **WHEN** an extensions container requests an engine property without a generation and parse-back mapping
- **THEN** validation reports an unsupported-capability error before BPMN generation

### Requirement: Keep YAML stable for Git review
The YAML model SHALL use deterministic ids, stable ordering, and explicit refs so process changes are reviewable in Git.

#### Scenario: Process edited
- **WHEN** a process task name or flow changes
- **THEN** the YAML diff shows the semantic change without unrelated reordering

### Requirement: Provide a canonical minimal valid authoring skeleton
The YAML model documentation SHALL include canonical minimal valid skeletons for v1 single-process authoring and v2 collaboration authoring, and each skeleton SHALL declare its schema version.

#### Scenario: Agent starts a new single-process model
- **WHEN** the agent creates a common process without multi-process collaboration
- **THEN** the documented v1 skeleton shows `schema_version`, `process`, participants, lane objects, `nodes`, and `flows` with valid ids and references

#### Scenario: Agent starts a collaboration model
- **WHEN** the agent creates a process involving multiple pools with distinct process ownership
- **THEN** the documented v2 skeleton shows process-scoped lanes, nodes, and sequence flows plus participants with `process_ref`

#### Scenario: Common BPMN sequence flow authoring
- **WHEN** the agent represents control flow between BPMN nodes
- **THEN** sequence flows appear only in the owning process flow collection and not as entries under `nodes`

#### Scenario: Participant authoring
- **WHEN** the agent represents pools or participants in YAML
- **THEN** it uses the documented `participants` collection and does not rely on an undocumented `pools` alias

#### Scenario: Lane authoring
- **WHEN** the agent represents lanes in YAML
- **THEN** each lane is an object with at least `id` and `name`, not a bare string

### Requirement: Preserve concise branch modeling
The YAML model SHALL support branch alternatives without requiring lane proliferation or unrelated advanced BPMN fields, and SHALL represent a gateway default canonically as an outgoing sequence-flow id.

#### Scenario: Simple exclusive choice
- **WHEN** a process contains mutually exclusive alternatives performed by the same participant
- **THEN** the YAML can represent the choice with one exclusive gateway and labeled or conditioned outgoing flows without additional lanes

#### Scenario: Optional default branch
- **WHEN** a real fallback branch is semantically needed
- **THEN** the gateway `default` references the id of one of that gateway's outgoing sequence flows

#### Scenario: Invalid default reference
- **WHEN** a gateway `default` references a node, a missing flow, or a flow not outgoing from that gateway
- **THEN** reference validation rejects the model before generation with a finding at the gateway default path

### Requirement: Resolve process schema versions explicitly
The system SHALL dispatch validation by an integer `schema_version`, record the declared and resolved versions, and keep process-model versioning independent of validation-report versioning.

#### Scenario: Canonical v1 document
- **WHEN** a document declares `schema_version: 1`
- **THEN** only `process.v1.schema.json` is used to validate it

#### Scenario: Canonical v2 document
- **WHEN** a document declares `schema_version: 2`
- **THEN** only `process.v2.schema.json` is used to validate it

#### Scenario: Transitional unversioned document
- **WHEN** a legacy document omits `schema_version` during the documented transition release
- **THEN** it is resolved as v1 and validation emits `schema.version_implicit` as a warning

#### Scenario: Malformed version
- **WHEN** `schema_version` is present but is not a supported integer
- **THEN** validation fails without guessing or coercing a version

### Requirement: Fail closed on accepted shapes
Each contract-owned object SHALL reject unknown properties, and arbitrary vendor or engine data SHALL be permitted only in documented `extensions` containers with an implemented capability mapping.

#### Scenario: Unknown node field
- **WHEN** a node includes a property that is neither part of its discriminated schema variant nor a documented extension
- **THEN** schema validation reports an additional-property error and generation does not run

#### Scenario: Supported extension field
- **WHEN** a node includes an extension admitted by the selected engine profile and capability matrix
- **THEN** validation accepts it and round-trip validation verifies that the generated BPMN preserves it

#### Scenario: Recognizable unsupported element type
- **WHEN** a node declares a BPMN type that the selected schema version does not support end to end
- **THEN** validation emits `capability.unsupported` rather than generating a fallback task

### Requirement: Represent sequence-flow conditions canonically
The versioned YAML model SHALL represent a sequence-flow condition as an object with required `body` and optional `language`, and the condition SHALL be treated as semantic content.

#### Scenario: Conditional branch
- **WHEN** a sequence flow contains a condition body and optional language
- **THEN** schema validation accepts the documented condition object for a BPMN flow type that permits conditions

#### Scenario: Condition on an incompatible flow
- **WHEN** a condition is attached to a flow type or gateway branch that does not permit a condition under the selected contract
- **THEN** semantic validation rejects the condition before generation

#### Scenario: Legacy condition shorthand
- **WHEN** canonical versioned input supplies a bare string instead of the documented condition object
- **THEN** schema validation rejects the shorthand and identifies the condition path

### Requirement: Resolve references independently of YAML declaration order
The system SHALL collect all ids in the applicable scope before resolving references and SHALL apply version-specific ownership rules.

#### Scenario: Boundary event uses a forward reference
- **WHEN** a boundary event appears before the activity named by its `attachedTo` reference
- **THEN** reference validation accepts the model if that activity exists in the same process and supports boundary attachment

#### Scenario: Duplicate definition-wide id
- **WHEN** two BPMN elements reuse an id anywhere in the definitions-wide id namespace
- **THEN** validation reports a duplicate-id error identifying both uses

#### Scenario: Cross-process sequence flow
- **WHEN** a v2 sequence flow source and target belong to different processes
- **THEN** reference validation rejects it and directs the author to use a message flow where appropriate
