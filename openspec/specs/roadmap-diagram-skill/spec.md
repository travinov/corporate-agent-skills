# roadmap-diagram-skill Specification

## Purpose
TBD - created by archiving change add-roadmap-diagram-skill. Update Purpose after archive.
## Requirements
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
The system SHALL accept roadmap source data from prose text, tables, YAML, and XML, normalize supported input into the versioned canonical roadmap model, and complete schema and semantic validation before generation.

#### Scenario: Canonical YAML input is provided
- **WHEN** the user provides roadmap YAML that follows a supported schema version
- **THEN** the system validates and uses it as roadmap source data without unnecessary reinterpretation or source reordering

#### Scenario: Unversioned YAML input is provided
- **WHEN** the user provides valid legacy roadmap YAML without `schema_version` during the compatibility release
- **THEN** the system treats it as effective v1, reports the deprecation warning, and does not silently edit the source file

#### Scenario: Table input is provided
- **WHEN** the user provides roadmap data as a table
- **THEN** the system maps table columns to a v1 roadmap model with explicit scale coordinates, lanes, tasks, milestones, dependencies, statuses, owners, risks, and outcomes where possible

#### Scenario: XML input is provided
- **WHEN** the user provides roadmap data as XML
- **THEN** the system maps supported XML fields into a v1 roadmap model and reports unsupported or ambiguous fields before generation

### Requirement: Preserve local-first roadmap handling
The system SHALL process roadmap content using local files, bundled scripts, and installed dependencies resolved only through the user's configured package source, without requiring external content services.

#### Scenario: Roadmap generation
- **WHEN** the system normalizes, compares, validates, renders, or exports roadmap data
- **THEN** it does not require external SaaS, online renderers, public APIs, or external MCP servers for roadmap content

#### Scenario: Dependency is resolved
- **WHEN** the configured Python package source provides a supported `PyYAML` and `jsonschema` version
- **THEN** the preflight records successful resolution and local import/version checks

#### Scenario: Dependency is unavailable
- **WHEN** a required package cannot be resolved from the configured package source
- **THEN** setup or self-check stops with a package-specific unavailable finding and remediation command rather than selecting an undeclared source or substitute

### Requirement: Report roadmap artifacts and validation status
The system SHALL report generated roadmap artifact paths, the machine-readable validation report path, effective schema version, assumptions, warnings, and validation-stage status before declaring the roadmap complete.

#### Scenario: Roadmap generation succeeds
- **WHEN** parse, schema, reference, semantic, generation, artifact, and requested export validation complete without error-level findings
- **THEN** the system reports generated artifact paths, validation summary, effective schema version, assumptions, and warnings

#### Scenario: Roadmap validation fails
- **WHEN** any validation stage finds an error-level schema, reference, semantic, generation, artifact, text-integrity, coordinate, or export issue
- **THEN** the system fixes the source or generator when feasible or reports the blocking finding clearly and does not declare completion

### Requirement: Enforce the roadmap validation pipeline
The roadmap skill SHALL run validation in the order parse, schema dispatch, references, semantics and deltas, generation, artifact parse, source-aware artifact checks, and optional real export, and SHALL never invoke a later unsafe stage after a blocking earlier error.

#### Scenario: Schema validation fails
- **WHEN** the normalized roadmap violates its selected schema
- **THEN** generation is not invoked and the report identifies the schema findings

#### Scenario: Generated artifact fails source-aware validation
- **WHEN** generation succeeds but the artifact loses text, fields, refs, or semantic coordinates
- **THEN** completion is blocked and artifact-stage findings are included in the report

### Requirement: Provide a draw.io skill dependency self-check
The skill SHALL provide a local self-check that verifies Python package resolvability, installed imports and supported versions, schema compilation, minimal roadmap and git-flow validation, and minimal artifact generation/validation.

#### Scenario: Clean environment is correctly provisioned
- **WHEN** supported dependencies are installed from the configured source and the self-check runs
- **THEN** all bundled schemas compile and minimal roadmap and git-flow smoke fixtures complete successfully

#### Scenario: Installed package version is unsupported
- **WHEN** an installed dependency imports but falls outside the declared supported range
- **THEN** self-check returns a version-specific error and a copyable installation command
