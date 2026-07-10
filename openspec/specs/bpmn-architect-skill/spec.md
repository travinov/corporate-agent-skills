## Purpose

Define the agent-facing BPMN Architect workflow for semantic BPMN 2.0 process work.
## Requirements
### Requirement: Trigger BPMN Architect for semantic BPMN work
The system SHALL route semantic BPMN creation, review, validation, and editing requests to the `bpmn-architect` skill.

#### Scenario: User requests BPMN from a process description
- **WHEN** the user asks to create a BPMN process model from text or a document
- **THEN** the agent uses `bpmn-architect` instead of producing a generic flowchart

#### Scenario: User requests a presentation-only diagram
- **WHEN** the user asks only for a visual process diagram without BPMN semantics
- **THEN** the agent explains the difference and may route to the draw.io skill for presentation output

### Requirement: Generate process YAML before BPMN XML
The skill SHALL make a versioned `process.yaml` the primary artifact created or edited by the agent and SHALL select the simplest schema version that can represent the requested semantics correctly.

#### Scenario: New single-process generation
- **WHEN** the user provides enough information for a process that does not require multi-process collaboration
- **THEN** the agent writes canonical v1 `process.yaml` with `schema_version: 1` and invokes `corp-bpmn build`

#### Scenario: New collaboration generation
- **WHEN** the user requires multiple pools with distinct process ownership and cross-pool message flows
- **THEN** the agent writes canonical v2 `process.yaml` with process-scoped elements and invokes `corp-bpmn build`

#### Scenario: Existing unversioned input
- **WHEN** the skill encounters an unversioned legacy process file during the transition release
- **THEN** it reports the implicit-v1 warning and offers or performs an explicit version update without silently restructuring collaboration

### Requirement: Prefer simple BPMN constructs by default
The skill SHALL choose the simplest BPMN construct and lowest schema version that preserve business meaning, subject to the shipped capability matrix.

#### Scenario: Simple approval process
- **WHEN** an approval process can be represented with supported events, tasks, exclusive gateways, lanes, and sequence flows without losing meaning
- **THEN** the agent does not introduce boundary events, transactions, compensation, collaboration v2, or other advanced constructs

#### Scenario: Supported advanced construct is required
- **WHEN** a simpler construct would distort the business semantics or the user explicitly requests an advanced construct marked supported or partial
- **THEN** the agent may use the construct, records the reason in generated process documentation, and reports any partial-capability review requirement

#### Scenario: Requested construct is unsupported
- **WHEN** the user requests a construct marked unsupported by the selected skill release
- **THEN** the agent states the limitation, does not claim valid generation, and asks whether to use a semantically honest supported alternative or defer the artifact

### Requirement: Run build and inspect validation before final response
The skill SHALL require schema, semantic, generation, artifact-parse, round-trip, layout, and applicable engine feedback before declaring generated BPMN artifacts complete.

#### Scenario: Validation succeeds
- **WHEN** `corp-bpmn build` completes with no error-level findings and no strict-mode blockers
- **THEN** the agent reports artifact paths, schema version, capability status, and warnings if any

#### Scenario: Validation fails
- **WHEN** `validation-report.json` contains error-level findings
- **THEN** the agent fixes `process.yaml` when feasible and reruns the build before asking the user to review the result

#### Scenario: Artifact parses but round-trip fails
- **WHEN** BPMN XML parses successfully but semantic round-trip reports a mismatch
- **THEN** the agent treats the build as failed and does not describe the artifact as semantically preserved

### Requirement: Enforce local-first process handling
The skill SHALL forbid external SaaS, online renderers, public APIs, and external MCP servers as required processing dependencies for process content.

#### Scenario: Toolchain execution
- **WHEN** the agent builds BPMN artifacts
- **THEN** it uses local files, bundled scripts, and approved local/internal dependencies only

### Requirement: Guide first-draft BPMN authoring with concrete modeling rules
The skill SHALL guide the agent to produce a valid first-draft `process.yaml` using documented BPMN modeling rules before relying on validation repair loops.

#### Scenario: User requests alternative process methods
- **WHEN** the user asks for one process with alternatives such as multiple preparation methods, fulfillment paths, or approval outcomes
- **THEN** the agent models the alternatives with gateways and sequence-flow branches unless each alternative is performed by a distinct role, system, department, or responsibility partition

#### Scenario: Lane would only represent a branch option
- **WHEN** a lane would represent only a method, outcome, product option, or scenario variant
- **THEN** the agent does not create that lane by default and instead records the variant as a branch, subprocess, or documented option as appropriate

#### Scenario: Lane represents responsibility
- **WHEN** a lane represents a real actor, role, system, department, tool, or responsibility partition
- **THEN** the agent may use the lane and assigns relevant nodes to it consistently

### Requirement: Avoid arbitrary exclusive gateway defaults
The skill SHALL require a business reason before adding a default flow to an exclusive gateway.

#### Scenario: Real fallback exists
- **WHEN** one outgoing branch represents a real fallback such as other, unknown, not selected, timeout, exception, or business-defined default handling
- **THEN** the agent may mark that branch as the gateway default and documents the fallback semantics when useful

#### Scenario: No fallback exists
- **WHEN** an exclusive gateway branches between deliberate alternatives and no branch is a fallback
- **THEN** the agent does not invent a default branch and instead labels or conditions each outgoing flow

### Requirement: Keep duration notes simple unless timing controls the process
The skill SHALL represent plain activity durations as task labels or documentation unless timing changes process control semantics.

#### Scenario: Duration is descriptive
- **WHEN** an activity includes a duration such as "wait 4 minutes" but no deadline, escalation, reminder, timeout, or automation behavior depends on it
- **THEN** the agent keeps the duration in the task name, task documentation, or process assumptions without introducing timer events

#### Scenario: Timing controls behavior
- **WHEN** a duration controls a wait state, SLA, escalation, timeout, reminder, or automation behavior
- **THEN** the agent may use timer events or boundary events and records why the advanced timing construct is needed

### Requirement: Route collaboration authoring to v2
The skill SHALL use v2 whenever correct BPMN collaboration requires more than one process owner and SHALL not represent multiple pools by pointing them to one flat v1 process.

#### Scenario: Multiple independent pools
- **WHEN** different participants own distinct internal flows and communicate by message flow
- **THEN** the skill creates separate v2 process entries, maps each participant with `process_ref`, and keeps sequence flows inside each process

#### Scenario: One process with lanes
- **WHEN** roles or departments partition responsibility inside one process without independent pools
- **THEN** the skill remains on v1 and models them as lanes rather than inventing v2 collaboration

#### Scenario: Collaboration ownership is unknown
- **WHEN** the user requests multiple pools but the source material does not establish which activities belong to which process
- **THEN** the skill asks for the missing ownership information rather than guessing

### Requirement: Present capability claims honestly
The skill SHALL base support claims on the shipped capability matrix and current validation result rather than on generic BPMN 2.0 library coverage.

#### Scenario: User asks whether full BPMN is supported
- **WHEN** the capability matrix contains partial or unsupported families
- **THEN** the skill describes the tested supported scope and identifies relevant limitations instead of claiming unconditional full BPMN 2.0 support

#### Scenario: Capability status changes between releases
- **WHEN** a newer skill release promotes a family after end-to-end tests pass
- **THEN** the skill uses the status shipped with that installed release

### Requirement: Use explicit migration for existing collaboration data
The skill SHALL invoke or recommend the non-destructive migrator for an unambiguous v1-to-v2 transition and SHALL not silently rewrite ambiguous participant ownership.

#### Scenario: Unambiguous migration
- **WHEN** an existing valid v1 model has no more than one participant and now requires canonical v2 form
- **THEN** the skill uses an explicit output path, validates the migrated model, and keeps the v1 source unchanged

#### Scenario: Ambiguous migration
- **WHEN** an existing v1 model has multiple participants with no process ownership mapping
- **THEN** the skill stops automatic migration and requests an explicit process-to-participant mapping
