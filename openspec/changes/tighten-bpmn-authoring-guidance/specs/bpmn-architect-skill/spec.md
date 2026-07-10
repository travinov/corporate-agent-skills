## ADDED Requirements

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
