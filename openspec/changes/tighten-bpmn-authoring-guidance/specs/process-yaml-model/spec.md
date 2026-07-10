## ADDED Requirements

### Requirement: Provide a canonical minimal valid authoring skeleton
The YAML model documentation SHALL include a canonical minimal valid `process.yaml` skeleton that agents can copy before adding process-specific detail.

#### Scenario: Agent starts a new process model
- **WHEN** the agent creates a new `process.yaml`
- **THEN** the documented skeleton shows `process`, `participants`, lane objects, `nodes`, and `flows` with valid ids, participant refs, lane refs, node types, and flow ids

#### Scenario: Common BPMN sequence flow authoring
- **WHEN** the agent represents control flow between BPMN nodes
- **THEN** sequence flows appear only under `flows` and not as entries under `nodes`

#### Scenario: Participant authoring
- **WHEN** the agent represents pools or participants in YAML
- **THEN** it uses the documented `participants` collection and does not rely on an undocumented `pools` alias

#### Scenario: Lane authoring
- **WHEN** the agent represents lanes in YAML
- **THEN** each lane is an object with at least `id` and `name`, not a bare string

### Requirement: Preserve concise branch modeling
The YAML model SHALL support branch alternatives without requiring lane proliferation or advanced BPMN fields.

#### Scenario: Simple exclusive choice
- **WHEN** a process contains mutually exclusive alternatives performed by the same participant
- **THEN** the YAML can represent the choice with one exclusive gateway and labeled or conditioned outgoing flows without additional lanes

#### Scenario: Optional default branch
- **WHEN** a default branch is semantically needed
- **THEN** the YAML represents the default on the gateway using the target node id documented by the schema
