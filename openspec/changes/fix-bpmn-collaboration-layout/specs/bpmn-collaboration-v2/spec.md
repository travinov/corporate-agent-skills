## MODIFIED Requirements

### Requirement: Model message flows across participant boundaries
V2 message flows SHALL use explicit endpoint ids, SHALL resolve endpoints to participants or eligible flow nodes, SHALL cross distinct participant or process ownership boundaries, and SHALL prefer concrete flow-node endpoints when the sending or receiving activity is known.

#### Scenario: Cross-process node message flow
- **WHEN** a message flow connects eligible nodes owned by two different participant processes
- **THEN** validation accepts it and generated BPMN preserves both endpoints

#### Scenario: Participant-level message flow
- **WHEN** a message flow uses documented participant endpoints for a black-box or unspecified interaction
- **THEN** generated BPMN references those participant ids

#### Scenario: Participant endpoint hides a concrete activity
- **WHEN** a participant endpoint is used while its process contains an eligible concrete message activity
- **THEN** semantic validation emits a stable ambiguity warning identifying the endpoint path and participant

#### Scenario: Message flow remains inside one process
- **WHEN** both message-flow endpoints belong to the same process or participant ownership boundary
- **THEN** semantic validation rejects the message flow and explains that message flow is for cross-participant communication

#### Scenario: Message endpoint is ineligible
- **WHEN** a message flow references an element type not permitted as a message-flow endpoint
- **THEN** semantic validation reports an endpoint-type error before generation

## ADDED Requirements

### Requirement: Lay out collaboration processes on multiple visual levels
The v2 layout SHALL derive node positions from process graph topology, SHALL place parallel, alternative, loop, and exception paths on distinct visual levels where required for readability, and SHALL preserve responsibility lanes without synthesizing lanes for branch variants.

#### Scenario: Dense branching process
- **WHEN** a process contains a split, branches of different lengths, and a join
- **THEN** branch nodes occupy distinct vertical levels and the join is placed after the longest incoming branch

#### Scenario: Process has no authored lanes
- **WHEN** a branching process contains no responsibility lanes
- **THEN** layout may use multiple vertical levels inside the participant but does not add BPMN lane elements

### Requirement: Size and contain collaboration shapes dynamically
The v2 layout SHALL derive participant bounds from laid-out content with deterministic padding, SHALL keep nodes and lanes inside their participant, and SHALL keep lane-assigned nodes inside their owning lane.

#### Scenario: Process needs more than one row
- **WHEN** laid-out process content requires a height greater than the minimum participant height
- **THEN** participant height expands and the next participant starts after a stable gutter

#### Scenario: Boundary event is rebased
- **WHEN** a boundary event is attached to an activity in a rebased participant
- **THEN** its DI bounds remain attached to the activity and inside the owning participant

### Requirement: Route collaboration edges from boundaries around obstacles
The v2 layout SHALL anchor edge endpoints to source and target boundaries, SHALL use deterministic orthogonal routes that avoid unrelated flow-node interiors, and SHALL stagger equal or reverse-equivalent routes without detaching endpoint anchors.

#### Scenario: Target is left of source
- **WHEN** an edge travels in the reverse horizontal direction
- **THEN** it leaves the source left boundary and enters the target right boundary

#### Scenario: Message crosses participants
- **WHEN** a message flow connects task-level or participant-level endpoints in different pools
- **THEN** its first and last waypoints lie on the endpoint boundaries and its intermediate route avoids unrelated node interiors

#### Scenario: Multiple messages share endpoints
- **WHEN** two message flows would otherwise have the same route signature
- **THEN** stable flow-id ordering produces distinct intermediate corridors while preserving endpoint anchors
