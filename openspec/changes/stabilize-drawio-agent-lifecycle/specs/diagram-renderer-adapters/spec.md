## ADDED Requirements

### Requirement: Select deterministic local renderer adapters
The orchestration host SHALL select an allowlisted local adapter from the validated diagram type and SHALL record the selected adapter, input schema, options, implementation hash, output hash, and validation profile.

#### Scenario: Specialized roadmap type is requested
- **WHEN** a schema-valid source bundle and semantic plan select the supported roadmap adapter
- **THEN** the host invokes the existing roadmap generator through the adapter and continues through the common validation, review, comparison, checkpoint, and trace lifecycle

#### Scenario: No specialized adapter matches
- **WHEN** a valid semantic plan names an unsupported specialized diagram type
- **THEN** the host selects the generic adapter, records the fallback, and does not invent or execute an unregistered generator

### Requirement: Preserve existing specialized generator behavior
Adapter integration SHALL wrap the existing roadmap, git-flow, and C4 generators without changing their standalone source normalization, deterministic output, or source-aware validation contracts unless a separate failing requirement authorizes that change.

#### Scenario: Existing specialized fixture is rendered through its adapter
- **WHEN** a bundled roadmap, git-flow, or C4 fixture is generated through the registry and through its previous standalone entry point with equivalent options
- **THEN** the resulting artifact and validation semantics are equivalent and any byte difference is explicitly reviewed and approved

### Requirement: Render generic semantic structure faithfully
The generic adapter SHALL preserve page scope, parent/container relationships, stable IDs, labels, style hints, relationship types, loops, distinct terminal pins, and explicit orthogonal waypoints from the validated semantic plan.

#### Scenario: Process contains a failure return loop
- **WHEN** the approved plan contains a return edge from a failure decision to an earlier correction step
- **THEN** the artifact contains that directed loop with explicit orthogonal routing and the normal semantic and route validation gates verify it

#### Scenario: Nodes belong to a container on one page
- **WHEN** plan nodes declare a valid page and parent container
- **THEN** the renderer creates them in the declared scope rather than flattening them into the default layer

### Requirement: Route every adapter through one acceptance pipeline
No renderer adapter SHALL publish directly; every generated artifact SHALL become a candidate and pass strict validation, independent review, monotonic comparison where a baseline exists, human checkpoint policy, and transactional publication.

#### Scenario: Specialized adapter emits an invalid artifact
- **WHEN** an adapter command succeeds but source-aware or structural validation fails
- **THEN** the candidate is not published and the run continues to Repair or a resumable checkpoint with the failure evidence
