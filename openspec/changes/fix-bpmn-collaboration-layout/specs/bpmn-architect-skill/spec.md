## ADDED Requirements

### Requirement: Prefer concrete message-flow activities
The skill SHALL use eligible send, receive, throw, catch, or interaction activities as message-flow endpoints whenever the source material identifies them, and SHALL use a participant endpoint only for a black-box participant or when the concrete activity is genuinely unknown.

#### Scenario: Concrete sender and receiver are known
- **WHEN** source material identifies the activities that send and receive a cross-participant message
- **THEN** the agent writes those node ids in `message_flows[].from` and `message_flows[].to`

#### Scenario: Black-box participant has no internal activity
- **WHEN** a participant is intentionally modeled as a black box and no concrete endpoint exists
- **THEN** the agent may use its participant id and records the assumption in process documentation

### Requirement: Require spatial quality before completion
The skill SHALL inspect strict spatial validation results and SHALL not declare a generated collaboration complete while routes are detached, cross unrelated shapes, duplicate one another, or place flow nodes outside their owning participant or lane.

#### Scenario: Generated DI is spatially invalid
- **WHEN** strict validation reports any `layout.*` blocker
- **THEN** the agent repairs the source or layout, rebuilds, and revalidates before handing off the artifact

#### Scenario: Branches require multiple visual levels
- **WHEN** a process contains parallel, alternative, loop, or exception paths that would collide in one row
- **THEN** the generated diagram uses multiple visual levels without inventing responsibility lanes
