## ADDED Requirements

### Requirement: Produce layered validation reports
The system SHALL produce `validation-report.json` with separate sections for schema, BPMN parse, BPMN lint, layout, corporate semantics, and engine-specific checks.

#### Scenario: Build with warnings
- **WHEN** a BPMN model is valid but has layout or engine warnings
- **THEN** the report distinguishes warnings from error-level findings and the build succeeds unless strict mode is enabled

### Requirement: Detect structural BPMN errors
Validation SHALL detect malformed XML, unresolved refs, duplicate ids, missing BPMN DI for visible elements, and missing flow edges where applicable.

#### Scenario: Dangling sequence flow
- **WHEN** a sequence flow references a missing source or target
- **THEN** validation reports an error identifying the broken flow id and missing reference

### Requirement: Detect corporate semantic errors
Validation SHALL detect process-level semantic problems required by the corporate ruleset.

#### Scenario: Missing process termination
- **WHEN** a non-terminal path cannot reach an end event
- **THEN** validation reports an error-level dead-end or no-path-to-end finding

#### Scenario: Exclusive gateway lacks branch labels
- **WHEN** an exclusive gateway has multiple outgoing flows and no labels or default
- **THEN** validation reports an error-level finding

### Requirement: Classify cycles instead of banning all cycles
Validation SHALL distinguish valid business cycles with an explicit exit from suspicious or non-terminating cycles.

#### Scenario: Rework loop with exit
- **WHEN** a loop returns to an earlier task through a gateway and at least one reachable branch exits toward an end event
- **THEN** validation does not fail the model solely because the loop exists

#### Scenario: Loop without exit
- **WHEN** a cycle has no reachable exit path to an end event
- **THEN** validation reports an error-level finding

### Requirement: Report capability warnings for advanced BPMN elements
Validation SHALL report capability status for advanced element families when XML generation succeeds but layout, semantic lint, or engine lint is partial.

#### Scenario: Advanced layout requires review
- **WHEN** an advanced BPMN element is generated but the layout layer cannot confidently validate readability
- **THEN** the report includes a layout warning requiring manual review without treating the semantic model as unsupported

### Requirement: Generate human-facing process documentation
The system SHALL generate `process.md` summarizing the model, assumptions, validation result, warnings, and any advanced BPMN elements used.

#### Scenario: Advanced element used
- **WHEN** generated BPMN uses an advanced construct such as boundary event, transaction, compensation, choreography, or conversation
- **THEN** `process.md` explains the business reason for using that construct
