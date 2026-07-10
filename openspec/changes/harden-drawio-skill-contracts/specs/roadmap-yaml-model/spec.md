## MODIFIED Requirements

### Requirement: Provide a schema-validated roadmap YAML model
The system SHALL define a canonical `roadmap.yaml` model, dispatch it to a bundled Draft 2020-12 major-version schema, and complete separate schema, reference, and semantic validation stages before generating roadmap diagrams.

#### Scenario: Explicit v1 roadmap YAML is valid
- **WHEN** `roadmap.yaml` declares `schema_version: 1` and satisfies the v1 schema and semantic rules
- **THEN** roadmap generation proceeds to baseline comparison and rendering

#### Scenario: Unversioned roadmap uses compatibility mode
- **WHEN** a valid legacy `roadmap.yaml` omits `schema_version` during the compatibility release
- **THEN** the system validates an in-memory v1-normalized copy and emits `contract.version.missing` without rewriting the source file

#### Scenario: Invalid roadmap YAML has multiple findings
- **WHEN** `roadmap.yaml` has missing required fields, invalid coordinate variants, duplicate ids, invalid dates, invalid refs, or unsupported enum values
- **THEN** validation reports all safely detectable findings with stable codes and JSON Pointer paths and blocks generation

#### Scenario: Unsupported roadmap schema version is supplied
- **WHEN** `roadmap.yaml` declares a major version for which no schema is bundled
- **THEN** validation fails with `contract.version.unsupported` before semantic comparison or rendering

### Requirement: Represent roadmap planning entities
The roadmap YAML model SHALL represent lanes, tasks, milestones, dependencies, influence relationships, outcomes, owners, statuses, risks, and one explicit time-scale variant. Calendar scales `week`, `month`, `quarter`, and `date` SHALL use task `start`/`end` and milestone `date` ISO coordinates; `order` SHALL use task `start_order`/`end_order` and milestone `order` integer coordinates.

#### Scenario: Calendar roadmap has tasks and milestones
- **WHEN** a roadmap selects a calendar scale
- **THEN** the model stores task ids, labels, lane refs, ISO start/end dates, milestone refs, status, risk, owner, and outcome refs, and stores milestone ISO dates

#### Scenario: Ordered roadmap has tasks and milestones
- **WHEN** a roadmap selects `time_scale: order`
- **THEN** the model stores task integer start/end ordinals and milestone integer ordinals without requiring calendar dates

#### Scenario: Coordinate variants are mixed
- **WHEN** an order roadmap supplies calendar coordinates or a calendar roadmap supplies only ordinal coordinates
- **THEN** schema validation rejects the incompatible fields at their exact paths

#### Scenario: Roadmap has dependencies
- **WHEN** a roadmap includes dependencies or mutual influence between tasks or milestones
- **THEN** the model stores source refs, target refs, dependency type, impact level, and optional rationale

### Requirement: Support baseline roadmap data
The roadmap YAML model SHALL support an optional baseline for previous roadmap versions, and baseline entities SHALL use the same time-scale coordinate variant, id rules, field rules, and semantic reference checks as the current model.

#### Scenario: Compatible baseline is provided
- **WHEN** the user provides a previous roadmap version using the current model's coordinate variant
- **THEN** the model preserves baseline task, milestone, dependency, and outcome data for comparison

#### Scenario: Baseline uses incompatible coordinates
- **WHEN** the current roadmap uses ordinal coordinates and its baseline supplies calendar coordinates, or the reverse
- **THEN** validation reports an error-level baseline compatibility finding before delta calculation

#### Scenario: Baseline contains an unresolved reference
- **WHEN** a baseline task, milestone, or dependency references a missing baseline or shared entity
- **THEN** semantic validation reports the unresolved baseline path instead of silently omitting it

#### Scenario: Baseline is absent
- **WHEN** no previous roadmap version is provided
- **THEN** the model remains valid and generation proceeds without shift markers or baseline deltas

### Requirement: Calculate roadmap deltas
The system SHALL calculate deterministic machine-readable deltas between current and baseline tasks, milestones, dependencies, and outcomes when baseline data exists.

#### Scenario: Milestone moved later
- **WHEN** a milestone exists in both baseline and current roadmap and its current coordinate is later beyond the configured threshold
- **THEN** the system records the milestone as delayed with the signed coordinate delta and both positions

#### Scenario: Milestone moved earlier
- **WHEN** a milestone exists in both baseline and current roadmap and its current coordinate is earlier beyond the configured threshold
- **THEN** the system records the milestone as accelerated with the signed coordinate delta and both positions

#### Scenario: Milestone added or removed
- **WHEN** a milestone exists only in the current roadmap or only in the baseline
- **THEN** the system records the milestone as added or removed

#### Scenario: Task schedule changes
- **WHEN** a task with the same stable id changes its start or end coordinate
- **THEN** the system records the previous and current coordinates and classifies the task schedule change

#### Scenario: Dependency or outcome changes
- **WHEN** a dependency or outcome is added, removed, or changes fields under the same stable id
- **THEN** the system records a deterministic semantic delta for the affected entity

### Requirement: Keep roadmap YAML stable for review
The roadmap YAML model SHALL use an explicit major schema version, deterministic ids, stable semantic ordering, explicit refs, and strict declared properties so roadmap changes are reviewable in Git.

#### Scenario: Roadmap item changes
- **WHEN** a task, milestone, dependency, or outcome changes
- **THEN** the YAML diff shows the semantic change without validator- or generator-induced reordering of the source file

#### Scenario: Unknown property is supplied
- **WHEN** a stable roadmap contract object contains an undeclared property
- **THEN** schema validation rejects the property instead of dropping it during generation

#### Scenario: Delta report is repeated
- **WHEN** unchanged current and baseline models are compared more than once
- **THEN** delta records are emitted in the same entity/id order on every run
