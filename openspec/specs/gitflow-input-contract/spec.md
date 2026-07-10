# gitflow-input-contract Specification

## Purpose
TBD - created by archiving change harden-drawio-skill-contracts. Update Purpose after archive.
## Requirements
### Requirement: Provide a versioned git-flow JSON Schema
The system SHALL provide a Draft 2020-12 `gitflow.v1.schema.json` contract with a stable `$id`, integer `schema_version`, strict object properties, reusable definitions, and explicit variants for supported workflows, time modes, branch kinds, and event types.

#### Scenario: Explicit v1 input validates
- **WHEN** a git-flow input declares `schema_version: 1` and satisfies the v1 structural contract
- **THEN** the system selects the v1 schema and proceeds to semantic validation

#### Scenario: Unversioned input uses the compatibility path
- **WHEN** a structurally valid legacy git-flow input omits `schema_version` during the compatibility release
- **THEN** the system validates an in-memory v1-normalized copy and emits a `contract.version.missing` deprecation warning without rewriting the source file

#### Scenario: Unsupported schema version is supplied
- **WHEN** a git-flow input declares a schema version for which no bundled schema exists
- **THEN** validation fails with an error-level `contract.version.unsupported` finding before generation

#### Scenario: Unknown property is supplied
- **WHEN** a stable git-flow contract object contains a property not declared by the selected schema
- **THEN** schema validation fails at that property's JSON Pointer path

### Requirement: Enforce event-specific structural variants
The v1 schema SHALL use event-specific variants so every lane-local event requires `branch`, every `branch` event requires distinct `from` and `to` references, every `merge` event requires distinct `from` and `to` references, and each event declares only fields supported for its type.

#### Scenario: Commit omits branch
- **WHEN** a `commit` event has an id and time coordinate but no `branch`
- **THEN** schema validation fails before the generator can access the missing branch

#### Scenario: Branch event omits an endpoint
- **WHEN** a `branch` event omits either `from` or `to`
- **THEN** schema validation fails at the missing endpoint

#### Scenario: Merge event contains both endpoints
- **WHEN** a `merge` event contains valid `from` and `to` branch references and all other required fields
- **THEN** structural validation accepts the event for semantic reference and lifecycle checks

#### Scenario: Lane-local event has an unsupported field
- **WHEN** a lane-local event includes an undeclared endpoint or extension field outside the v1 contract
- **THEN** schema validation rejects the field instead of silently ignoring it

### Requirement: Enforce time-mode-specific coordinates
The v1 schema SHALL support `date` and `order` time modes as exclusive variants. Date mode events SHALL require an ISO `YYYY-MM-DD` `at` value, and order mode events SHALL require an integer `order` value.

#### Scenario: Date-mode event has a valid date
- **WHEN** `timeMode` is `date` and every event has a valid ISO date in `at`
- **THEN** schema validation accepts the time coordinates

#### Scenario: Date-mode event supplies only order
- **WHEN** `timeMode` is `date` and an event supplies `order` without `at`
- **THEN** schema validation fails at that event

#### Scenario: Order-mode event has a valid ordinal
- **WHEN** `timeMode` is `order` and every event has an integer `order`
- **THEN** schema validation accepts the time coordinates

#### Scenario: Invalid calendar date is supplied
- **WHEN** a date-mode event uses a string that matches the date shape but is not a real calendar date
- **THEN** semantic validation fails with a date-specific finding before layout

### Requirement: Validate git-flow references and branch lifecycle
The semantic validator SHALL resolve all branch references, reject duplicate branch and event ids, reject self-branch and self-merge operations, and validate branch activity against the normalized event chronology.

#### Scenario: Event references an unknown branch
- **WHEN** any `branch`, `from`, or `to` value does not match a declared branch id
- **THEN** validation reports an error-level reference finding at the exact event field

#### Scenario: Branch is used before creation
- **WHEN** a branch is the target of a branch-creation event and another event uses that branch earlier in normalized chronology
- **THEN** validation reports an error-level lifecycle finding

#### Scenario: Branch has no creation event
- **WHEN** a declared branch is never the target of a branch event
- **THEN** the validator treats it as pre-existing at the start of the supplied timeline

#### Scenario: Branch is created more than once
- **WHEN** multiple branch events target the same branch
- **THEN** validation reports an error-level duplicate-creation finding

### Requirement: Normalize event chronology deterministically
The system SHALL create one normalized event sequence sorted by the active semantic coordinate and original array index, and SHALL use that sequence for lifecycle checks, lane sequencing, edge construction, slot placement, and output generation.

#### Scenario: Date events are supplied out of order
- **WHEN** input events have non-monotonic `at` values
- **THEN** generated event X coordinates and sequence edges follow ascending date order rather than source-array order

#### Scenario: Events share a time coordinate
- **WHEN** two or more events have the same date or ordinal value
- **THEN** their relative order matches their original array order on every run

#### Scenario: Order values are supplied out of order
- **WHEN** order-mode events have non-monotonic `order` values
- **THEN** semantic validation and layout consume them in ascending ordinal order with the stable tie-break

### Requirement: Apply workflow policy after structural semantics
The validator SHALL apply canonical git-flow policy to `git-flow` inputs after structural, reference, and lifecycle validation, and SHALL skip canonical policy for `custom` inputs while retaining all general validation.

#### Scenario: Canonical rule is violated in relaxed mode
- **WHEN** a structurally valid `git-flow` model violates a feature, release, or hotfix branch policy and strict mode is disabled
- **THEN** the validator emits a warning with a stable policy code and permits generation

#### Scenario: Canonical rule is violated in strict mode
- **WHEN** the same canonical violation is validated in strict mode
- **THEN** the finding is promoted to error severity without changing its code or path and generation is blocked

#### Scenario: Custom workflow omits develop
- **WHEN** a valid `custom` workflow does not declare a develop branch
- **THEN** validation succeeds without canonical git-flow policy warnings

### Requirement: Report git-flow validation findings consistently
Git-flow validation SHALL support human-readable output and a machine-readable report containing report version, effective schema version, summary status/counts, and findings with layer, severity, stable code, JSON Pointer path, optional element id, and message.

#### Scenario: Multiple independent errors exist
- **WHEN** a git-flow model has multiple schema or semantic problems that can be evaluated safely
- **THEN** the validator reports all detected findings in deterministic path/code order instead of only the first problem

#### Scenario: Machine-readable output is requested
- **WHEN** the validator is invoked with JSON reporting enabled
- **THEN** it emits the documented report envelope and exits non-zero exactly when error-level findings remain
