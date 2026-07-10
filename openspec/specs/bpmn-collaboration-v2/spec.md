# bpmn-collaboration-v2 Specification

## Purpose
TBD - created by archiving change preserve-bpmn-skill-semantics. Update Purpose after archive.
## Requirements
### Requirement: Define a process-scoped v2 collaboration model
Schema version 2 SHALL represent collaboration with root definitions metadata, `processes`, `participants`, and `message_flows`, and each process SHALL own its lanes, flow nodes, sequence flows, data, artifacts, extensions, and documentation.

#### Scenario: Valid two-process collaboration
- **WHEN** a v2 model contains two valid process entries with independently scoped flow elements
- **THEN** schema validation accepts the documented v2 structure without requiring global v1 `nodes` or `flows`

#### Scenario: Flat v1 fields appear in v2
- **WHEN** a v2 root contains global `nodes` or `flows`
- **THEN** schema validation rejects those properties and identifies their paths

#### Scenario: Process has no valid identity
- **WHEN** a v2 process lacks its required id or name
- **THEN** schema validation rejects the process before reference validation

### Requirement: Map each participant to an explicit process
Each v2 participant SHALL declare a `process_ref` that resolves to exactly one process entry, and generated BPMN SHALL use that process as the participant `processRef`.

#### Scenario: Distinct participant ownership
- **WHEN** two participants reference two different v2 processes
- **THEN** generated BPMN contains two participants whose `processRef` values point to the corresponding distinct BPMN processes

#### Scenario: Missing participant process
- **WHEN** a participant `process_ref` names no process
- **THEN** reference validation reports an error at the participant reference path before generation

#### Scenario: Participants share a process unintentionally
- **WHEN** the authored model assigns multiple participants to the same process contrary to the documented v2 ownership cardinality
- **THEN** semantic validation rejects the ownership mapping rather than reproducing the legacy flat behavior

### Requirement: Keep sequence flows inside their owning process
Every v2 sequence flow SHALL resolve its source and target within the process that owns the flow.

#### Scenario: Internal sequence flow
- **WHEN** a flow source and target are nodes in the same owning process
- **THEN** reference validation accepts the flow and generation places it in that BPMN process

#### Scenario: Cross-process sequence flow
- **WHEN** a sequence flow connects nodes owned by different processes
- **THEN** reference validation rejects it before generation

#### Scenario: Flow references another process node by duplicate-looking id
- **WHEN** a flow endpoint is not present in its owning process even if a similarly named element exists elsewhere
- **THEN** reference validation reports an unresolved scoped reference

### Requirement: Model message flows across participant boundaries
V2 message flows SHALL use explicit endpoint ids, SHALL resolve endpoints to participants or eligible flow nodes, and SHALL cross distinct participant or process ownership boundaries.

#### Scenario: Cross-process node message flow
- **WHEN** a message flow connects eligible nodes owned by two different participant processes
- **THEN** validation accepts it and generated BPMN preserves both endpoints

#### Scenario: Participant-level message flow
- **WHEN** a message flow uses documented participant endpoints
- **THEN** generated BPMN references those participant ids

#### Scenario: Message flow remains inside one process
- **WHEN** both message-flow endpoints belong to the same process or participant ownership boundary
- **THEN** semantic validation rejects the message flow and explains that message flow is for cross-participant communication

#### Scenario: Message endpoint is ineligible
- **WHEN** a message flow references an element type not permitted as a message-flow endpoint
- **THEN** semantic validation reports an endpoint-type error before generation

### Requirement: Generate and validate multiple BPMN processes
The generator SHALL emit one BPMN `process` root element per v2 process, one collaboration with correctly mapped participants, and message flows whose endpoints resolve in the generated definitions.

#### Scenario: Two-process generation
- **WHEN** a valid two-process v2 model is generated
- **THEN** parsed BPMN definitions contain two process root elements and the collaboration retains their participant ownership

#### Scenario: Collaboration round-trip
- **WHEN** a v2 collaboration is built successfully
- **THEN** semantic round-trip comparison confirms processes, participant mappings, scoped flow elements, and message-flow endpoints

#### Scenario: Layout is partial for a supported collaboration
- **WHEN** the semantic collaboration round-trips but automatic layout cannot guarantee readability for a supported element
- **THEN** the report emits a partial-capability layout warning rather than changing process ownership or flow semantics

### Requirement: Migrate only unambiguous v1 single-process models
The system SHALL provide deterministic v1-to-v2 migration for valid v1 models whose process ownership can be established without inference and SHALL reject ambiguous participant layouts.

#### Scenario: V1 model has one participant
- **WHEN** a valid v1 model contains one participant
- **THEN** migration creates one v2 process containing the v1 flow elements and maps that participant to the new process with `process_ref`

#### Scenario: V1 model has no participant
- **WHEN** a valid v1 model contains no participant
- **THEN** migration creates one v2 process and a deterministic participant mapped to it

#### Scenario: V1 model has multiple participants
- **WHEN** a v1 model contains multiple participants without explicit process ownership
- **THEN** migration fails with `migration.ambiguous_process_ownership` and requires the author to provide an explicit v2 model

#### Scenario: Migrated result is invalid
- **WHEN** produced migration output does not pass v2 schema, reference, semantic, generation, and round-trip validation
- **THEN** migration fails and does not replace or modify the v1 source
