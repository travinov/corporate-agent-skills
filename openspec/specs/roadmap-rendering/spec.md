# roadmap-rendering Specification

## Purpose
TBD - created by archiving change add-roadmap-diagram-skill. Update Purpose after archive.
## Requirements
### Requirement: Render roadmap timeline and lanes
The system SHALL render a visible axis that implements the selected `week`, `month`, `quarter`, `date`, or `order` coordinate semantics and lanes that group roadmap items by the selected roadmap dimension.

#### Scenario: Calendar time scale is selected
- **WHEN** `roadmap.yaml` selects `week`, `month`, `quarter`, or `date`
- **THEN** ticks, labels, item spans, and milestone positions use the corresponding calendar bucket or day transform rather than a monthly fallback

#### Scenario: Order time scale is selected
- **WHEN** `roadmap.yaml` selects `order`
- **THEN** ticks and item positions use sorted explicit ordinal coordinates

#### Scenario: Roadmap has explicit lanes
- **WHEN** `roadmap.yaml` defines lanes
- **THEN** the diagram places every task and milestone inside the matching lane bounds

#### Scenario: Roadmap has no explicit lanes
- **WHEN** roadmap source data omits lanes
- **THEN** the system creates one deterministic default lane and records the assumption in validation output

### Requirement: Render tasks and milestones
The system SHALL render tasks as scale-correct spans and milestones as distinct point markers, with stable generated ids that allow source-aware validation.

#### Scenario: Calendar task has start and end dates
- **WHEN** a task includes valid calendar `start` and `end` coordinates
- **THEN** the diagram renders a duration bar spanning the corresponding selected-scale positions

#### Scenario: Ordered task has ordinal bounds
- **WHEN** a task includes valid `start_order` and `end_order`
- **THEN** the diagram renders a duration bar spanning the corresponding ordinal positions

#### Scenario: Calendar milestone has a date
- **WHEN** a milestone includes a valid `date`
- **THEN** the diagram renders a distinct marker at the selected-scale date position

#### Scenario: Ordered milestone has an ordinal
- **WHEN** a milestone includes a valid `order`
- **THEN** the diagram renders a distinct marker at the corresponding ordinal position

### Requirement: Render milestone shifts
The system SHALL render baseline-to-current milestone shifts from deterministic deltas and SHALL preserve non-milestone baseline changes in the validation report.

#### Scenario: Milestone moved later
- **WHEN** a milestone delta marks the milestone as delayed
- **THEN** the diagram shows the baseline position, current position, movement arrow, and positive scale-appropriate delta label

#### Scenario: Milestone moved earlier
- **WHEN** a milestone delta marks the milestone as accelerated
- **THEN** the diagram shows the baseline position, current position, movement arrow, and negative scale-appropriate delta label

#### Scenario: Milestone unchanged
- **WHEN** a milestone exists in both baseline and current roadmap with movement within the configured threshold
- **THEN** the diagram does not add a shift arrow and the report records the milestone as unchanged

#### Scenario: Non-milestone baseline entity changes
- **WHEN** a task, dependency, or outcome delta is not represented as a positional marker
- **THEN** the validation report preserves the full delta instead of silently losing it

### Requirement: Render dependencies and influence
The system SHALL render each valid roadmap dependency or influence relationship with stable source/target mapping, a labeled connection that identifies relationship type, and impact information where available.

#### Scenario: Blocking dependency exists
- **WHEN** a dependency has type `blocks`
- **THEN** the diagram renders a solid directional dependency from the resolved blocker to the resolved blocked item

#### Scenario: Influence relationship exists
- **WHEN** a relationship indicates mutual influence or downstream impact
- **THEN** the diagram renders a relationship with visual treatment distinct from a hard blocking dependency

#### Scenario: Relationship has impact metadata
- **WHEN** a dependency supplies an impact level
- **THEN** the artifact or its mapped annotation preserves the impact without changing the relationship endpoints

### Requirement: Render outcomes and status
The system SHALL expose outcomes, status, and risk without obscuring the timeline, using distinct documented visual channels for status and risk.

#### Scenario: Task has an outcome
- **WHEN** a task links to an outcome
- **THEN** the diagram shows the outcome as a concise mapped label, callout, or grouped annotation associated with that task

#### Scenario: Milestone has an outcome
- **WHEN** a milestone links to an outcome
- **THEN** the diagram shows the outcome as a concise mapped label, callout, or grouped annotation associated with that milestone

#### Scenario: Roadmap item has both status and risk
- **WHEN** a task or milestone declares both status and risk metadata
- **THEN** the diagram preserves both values using separate consistent styling or annotations and neither value overwrites the other

### Requirement: Validate roadmap diagram readability
The system SHALL run generic and roadmap-profile artifact validation before reporting completion, including structural, source-reference, coordinate, semantic-coverage, label-fidelity, overlap, overflow, and obvious density checks.

#### Scenario: Diagram contains unresolved refs
- **WHEN** a source or generated task, milestone, dependency, outcome, lane, parent, source, or target reference cannot be resolved
- **THEN** validation reports an error-level finding with a stable code and source/artifact path

#### Scenario: Diagram is overcrowded
- **WHEN** generated roadmap content is too dense for the selected time scale or lane layout
- **THEN** validation reports a warning with suggested grouping, filtering, or scale changes

#### Scenario: Item is outside its semantic lane or time position
- **WHEN** source-aware coordinate validation finds an item outside its resolved lane or inconsistent with its scale coordinate
- **THEN** validation reports an error and completion is blocked

### Requirement: Preserve roadmap text losslessly
The generator SHALL pass raw source labels to one XML serializer and SHALL preserve exact decoded Unicode text and XML-special characters in generated cells.

#### Scenario: Label contains an ampersand
- **WHEN** a source label is `A & B`
- **THEN** the decoded draw.io value is exactly `A & B` and not `A &amp; B`

#### Scenario: Label contains mixed special characters
- **WHEN** a source label contains Cyrillic, `<`, `>`, quotes, and a newline
- **THEN** source-aware artifact validation confirms exact decoded equality with the source value

### Requirement: Generate roadmap artifacts deterministically
The roadmap generator SHALL produce byte-identical `.drawio` XML for identical normalized input and options, without timestamps, random ids, environment paths, or unordered collection effects.

#### Scenario: Roadmap is generated twice
- **WHEN** the same validated roadmap and generation options are processed in two clean runs
- **THEN** the generated `.drawio` bytes are identical
