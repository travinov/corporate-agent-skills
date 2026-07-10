## MODIFIED Requirements

### Requirement: Produce layered validation reports
The system SHALL produce `validation-report.json` with normalized findings for parse, schema, references, semantics, generation, artifact parse, semantic round-trip, layout, BPMN lint, engine checks, capability status, and migration when those layers apply.

#### Scenario: Build with warnings
- **WHEN** a BPMN model is valid but has layout, engine, or partial-capability warnings
- **THEN** the report distinguishes warnings from error-level findings and the build succeeds unless strict mode is enabled

#### Scenario: Pre-generation errors
- **WHEN** schema, capability, reference, or semantic validation produces an error
- **THEN** the report identifies the failed layer and later generation and artifact layers do not claim success

#### Scenario: Round-trip mismatch
- **WHEN** the generated BPMN semantic projection differs from the validated YAML projection
- **THEN** the report contains an error in the round-trip layer with a stable mismatch code and the affected path or element

### Requirement: Report capability warnings for advanced BPMN elements
Validation SHALL report capability status from the shipped versioned capability matrix and SHALL fail closed when a requested family is not supported end to end.

#### Scenario: Advanced layout requires review
- **WHEN** an advanced BPMN element preserves its semantics but the layout layer cannot confidently validate readability
- **THEN** the report includes a partial-capability layout warning requiring manual review and strict mode fails

#### Scenario: Supported advanced family
- **WHEN** an advanced family is marked supported and all of its semantic and validation checks pass
- **THEN** the report does not warn merely because the family is advanced

#### Scenario: Unsupported family
- **WHEN** input requests a family or extension marked unsupported
- **THEN** the report includes `capability.unsupported` as an error before generation

### Requirement: Generate human-facing process documentation
The system SHALL generate `process.md` summarizing the model, schema version, assumptions, validation result, capability status, warnings, migration provenance when applicable, and advanced BPMN elements used.

#### Scenario: Advanced element used
- **WHEN** generated BPMN uses a supported or partial advanced construct such as a boundary event, transaction, or compensation event
- **THEN** `process.md` explains the business reason and reports its capability status

#### Scenario: Migrated v2 collaboration
- **WHEN** the model was produced by the v1-to-v2 migrator
- **THEN** `process.md` identifies the source version and records any migration assumptions or warnings

### Requirement: Validate exclusive gateway branches without forcing arbitrary defaults
Validation SHALL detect ambiguous exclusive gateway branches without requiring an arbitrary default branch when all alternatives are explicitly labeled or conditioned, and SHALL validate a declared default as an outgoing sequence-flow id.

#### Scenario: Explicit alternatives without default
- **WHEN** an exclusive gateway has multiple outgoing flows and each outgoing flow has a label or condition
- **THEN** validation does not report an error solely because no default branch exists

#### Scenario: Unlabeled alternatives without default
- **WHEN** an exclusive gateway has multiple outgoing flows and any outgoing flow lacks both a label and a condition
- **THEN** validation reports an error identifying the ambiguous branch

#### Scenario: Default branch exists
- **WHEN** an exclusive gateway declares a default branch
- **THEN** validation verifies that the default references one of that gateway's outgoing sequence-flow ids

#### Scenario: Default branch is not outgoing
- **WHEN** a gateway default references a missing flow, a target node, or a flow whose source is another node
- **THEN** validation reports an error at the default path before generation

## ADDED Requirements

### Requirement: Expose a stable machine-readable report contract
The validation report SHALL version its own contract with `report_version` and SHALL make finding identity independent of human-readable messages.

#### Scenario: Finding is serialized
- **WHEN** any validation layer emits a finding
- **THEN** the finding contains stable `layer`, `severity`, and `code` values plus `path` and `element` when applicable

#### Scenario: Automation evaluates a report
- **WHEN** a test or CI consumer evaluates validation output
- **THEN** it can determine the outcome from `report_version`, summary fields, and finding codes without parsing message text

#### Scenario: Process and report versions differ
- **WHEN** a v2 process is validated with report contract v1
- **THEN** the report records `schema_version: 2` and `report_version: 1` independently

### Requirement: Preserve schema keyword specificity
Schema validation SHALL map validator failures to stable keyword-specific finding codes and JSON Pointer paths.

#### Scenario: Required property is missing
- **WHEN** a versioned schema requires a property that is absent
- **THEN** the report includes `schema.required` with the containing object path

#### Scenario: Unknown property is present
- **WHEN** a contract-owned object contains an undeclared property
- **THEN** the report includes `schema.additional_property` with the affected object path and property identity

#### Scenario: Variant does not match
- **WHEN** a discriminated BPMN element has fields incompatible with its declared type
- **THEN** the report identifies the variant or type path rather than collapsing the result into only `schema.invalid`

### Requirement: Report schema-version resolution
The report SHALL record declared and resolved process schema versions and any compatibility behavior used.

#### Scenario: Explicit version resolves
- **WHEN** the input declares a supported version
- **THEN** the report records matching declared and resolved versions without a compatibility warning

#### Scenario: Implicit v1 resolves
- **WHEN** an unversioned legacy input is accepted during the transition release
- **THEN** the report records a null or absent declared version, resolved version 1, and `schema.version_implicit`

#### Scenario: Version cannot resolve
- **WHEN** the declared version is malformed or unsupported
- **THEN** the report records the version finding and does not report downstream generation success
