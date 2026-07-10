## ADDED Requirements

### Requirement: Provide a schema-validated roadmap YAML model
The system SHALL define and validate a canonical `roadmap.yaml` model before generating roadmap diagrams.

#### Scenario: Valid roadmap YAML
- **WHEN** `roadmap.yaml` satisfies the roadmap schema
- **THEN** roadmap generation proceeds to comparison and rendering

#### Scenario: Invalid roadmap YAML
- **WHEN** `roadmap.yaml` has missing required fields, duplicate ids, invalid dates, invalid refs, or unsupported enum values
- **THEN** roadmap generation fails with a clear validation error

### Requirement: Represent roadmap planning entities
The roadmap YAML model SHALL represent lanes, tasks, milestones, dependencies, influence relationships, outcomes, owners, statuses, risks, and time scale.

#### Scenario: Roadmap has tasks and milestones
- **WHEN** a roadmap includes tasks with milestone dates
- **THEN** the model stores task ids, labels, lane refs, start/end dates or periods, milestone refs, status, owner, and outcome refs

#### Scenario: Roadmap has dependencies
- **WHEN** a roadmap includes dependencies or mutual influence between tasks or milestones
- **THEN** the model stores source refs, target refs, dependency type, impact level, and optional rationale

### Requirement: Support baseline roadmap data
The roadmap YAML model SHALL support an optional baseline section for previous roadmap versions.

#### Scenario: Baseline is provided
- **WHEN** the user provides a previous roadmap version
- **THEN** the model preserves baseline task, milestone, dependency, and outcome data for comparison

#### Scenario: Baseline is absent
- **WHEN** no previous roadmap version is provided
- **THEN** the model remains valid and generation proceeds without shift markers

### Requirement: Calculate roadmap deltas
The system SHALL calculate machine-readable deltas between the current roadmap and the baseline when baseline data exists.

#### Scenario: Milestone moved later
- **WHEN** a milestone exists in both baseline and current roadmap and the current date is later
- **THEN** the system records the milestone as delayed with the date delta

#### Scenario: Milestone moved earlier
- **WHEN** a milestone exists in both baseline and current roadmap and the current date is earlier
- **THEN** the system records the milestone as accelerated with the date delta

#### Scenario: Milestone added or removed
- **WHEN** a milestone exists only in the current roadmap or only in the baseline
- **THEN** the system records the milestone as added or removed

### Requirement: Keep roadmap YAML stable for review
The roadmap YAML model SHALL use deterministic ids, stable ordering, and explicit refs so roadmap changes are reviewable in Git.

#### Scenario: Roadmap item changes
- **WHEN** a task, milestone, dependency, or outcome changes
- **THEN** the YAML diff shows the semantic change without unrelated reordering
