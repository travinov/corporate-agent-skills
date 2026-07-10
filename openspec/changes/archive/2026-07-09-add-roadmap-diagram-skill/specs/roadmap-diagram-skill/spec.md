## ADDED Requirements

### Requirement: Trigger roadmap workflow for roadmap diagrams
The system SHALL route roadmap creation, review, validation, and editing requests to the roadmap diagram workflow when the user asks for a roadmap, product roadmap, project roadmap, release roadmap, initiative roadmap, milestone roadmap, or equivalent time-based planning diagram.

#### Scenario: User requests a roadmap from text
- **WHEN** the user asks to create a roadmap diagram from a prose description
- **THEN** the system uses the roadmap workflow instead of a generic flowchart

#### Scenario: User requests a roadmap with milestone shifts
- **WHEN** the user asks to show milestone movement, delay, acceleration, plan drift, or comparison to a previous version
- **THEN** the system uses roadmap baseline comparison behavior

### Requirement: Intake roadmap-specific information
The system SHALL collect or infer the smallest useful set of roadmap details needed to build a correct roadmap brief.

#### Scenario: Required roadmap structure is missing
- **WHEN** the user requests a roadmap without enough information about time scale, lanes, tasks, milestones, or baseline comparison
- **THEN** the system asks only the clarification questions that materially affect the diagram

#### Scenario: Input contains enough roadmap information
- **WHEN** the input already includes tasks, milestones, dates or periods, and grouping fields
- **THEN** the system proceeds with conservative assumptions and records those assumptions in the roadmap brief or generated documentation

### Requirement: Accept multiple roadmap input forms
The system SHALL accept roadmap source data from prose text, tables, YAML, and XML.

#### Scenario: YAML input is provided
- **WHEN** the user provides a roadmap as YAML
- **THEN** the system validates and uses it as roadmap source data without unnecessary re-interpretation

#### Scenario: Table input is provided
- **WHEN** the user provides roadmap data as a table
- **THEN** the system maps table columns to roadmap lanes, tasks, milestones, dates, dependencies, statuses, owners, and outcomes where possible

#### Scenario: XML input is provided
- **WHEN** the user provides roadmap data as XML
- **THEN** the system maps supported XML fields into the roadmap model and reports unsupported or ambiguous fields

### Requirement: Preserve local-first roadmap handling
The system SHALL process roadmap content using local files, bundled scripts, and approved local or internal dependencies only.

#### Scenario: Roadmap generation
- **WHEN** the system normalizes, compares, validates, or renders roadmap data
- **THEN** it does not require external SaaS, online renderers, public APIs, or external MCP servers for roadmap content

### Requirement: Report roadmap artifacts and validation status
The system SHALL report generated roadmap artifact paths, validation results, and assumptions before declaring the roadmap complete.

#### Scenario: Roadmap generation succeeds
- **WHEN** roadmap normalization, comparison, rendering, and validation complete without error-level findings
- **THEN** the system reports the generated artifact paths and summarizes assumptions or warnings

#### Scenario: Roadmap validation fails
- **WHEN** roadmap validation finds unresolved references, invalid dates, missing required fields, or incompatible baseline data
- **THEN** the system fixes the source model when feasible or reports the blocking issue clearly
