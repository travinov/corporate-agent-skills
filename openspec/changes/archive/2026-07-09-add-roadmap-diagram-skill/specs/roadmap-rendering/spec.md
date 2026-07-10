## ADDED Requirements

### Requirement: Render roadmap timeline and lanes
The system SHALL render roadmap diagrams with a visible time scale and lanes that group roadmap items by product, team, workstream, project, or another selected roadmap dimension.

#### Scenario: Roadmap has explicit lanes
- **WHEN** `roadmap.yaml` defines lanes
- **THEN** the diagram places tasks and milestones in the matching lanes

#### Scenario: Roadmap has no explicit lanes
- **WHEN** roadmap source data omits lanes
- **THEN** the system chooses a conservative grouping strategy and records the assumption

### Requirement: Render tasks and milestones
The system SHALL render tasks as time spans or point-in-time work items and milestones as distinct markers on the roadmap timeline.

#### Scenario: Task has start and end dates
- **WHEN** a task includes both start and end dates or periods
- **THEN** the diagram renders it as a duration bar spanning the corresponding timeline range

#### Scenario: Milestone has a date
- **WHEN** a milestone includes a date or period
- **THEN** the diagram renders it as a distinct milestone marker at the corresponding timeline position

### Requirement: Render milestone shifts
The system SHALL render baseline-to-current milestone shifts when roadmap deltas are available.

#### Scenario: Milestone moved later
- **WHEN** a milestone delta marks the milestone as delayed
- **THEN** the diagram shows the baseline position, current position, movement arrow, and delay label

#### Scenario: Milestone moved earlier
- **WHEN** a milestone delta marks the milestone as accelerated
- **THEN** the diagram shows the baseline position, current position, movement arrow, and acceleration label

#### Scenario: Milestone unchanged
- **WHEN** a milestone exists in both baseline and current roadmap with no date movement
- **THEN** the diagram does not add a shift arrow for that milestone

### Requirement: Render dependencies and influence
The system SHALL render roadmap dependencies and influence relationships with labeled connections that identify relationship type and impact where available.

#### Scenario: Blocking dependency exists
- **WHEN** a dependency has type `blocks`
- **THEN** the diagram renders a directional dependency from blocker to blocked item

#### Scenario: Influence relationship exists
- **WHEN** a relationship indicates mutual influence or downstream impact
- **THEN** the diagram renders the relationship with visual treatment distinct from a hard blocking dependency

### Requirement: Render outcomes and status
The system SHALL expose roadmap outcomes and status information without obscuring the timeline.

#### Scenario: Roadmap item has an outcome
- **WHEN** a task or milestone links to an outcome
- **THEN** the diagram shows the outcome as a concise label, callout, or grouped annotation

#### Scenario: Roadmap item has a risk or status
- **WHEN** a task or milestone has status or risk metadata
- **THEN** the diagram uses consistent visual styling to identify that state

### Requirement: Validate roadmap diagram readability
The system SHALL validate generated roadmap diagrams for structural correctness and obvious readability problems before reporting completion.

#### Scenario: Diagram contains unresolved refs
- **WHEN** a task, milestone, dependency, outcome, or lane reference cannot be resolved
- **THEN** validation reports an error-level finding

#### Scenario: Diagram is overcrowded
- **WHEN** generated roadmap content is too dense for the selected time scale or lane layout
- **THEN** validation reports a warning with suggested grouping, filtering, or scale changes
