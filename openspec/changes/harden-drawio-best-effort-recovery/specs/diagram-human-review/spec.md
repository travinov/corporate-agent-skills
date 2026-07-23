## MODIFIED Requirements

### Requirement: Consolidate human checkpoints
The extension SHALL request user input only for source conflicts, semantic changes or deletions, unsafe/integrity failures, publication conflicts, explicit user pause, or manual handoff. Layout-only plateau after bounded autonomous attempts SHALL return a structurally safe best-effort result without requiring repeated `continue` commands.

#### Scenario: Several layout warnings are repairable
- **WHEN** findings require only semantics-preserving layout patches and autonomous attempts remain
- **THEN** the supervisor continues without asking after every iteration

#### Scenario: Layout repair is exhausted
- **WHEN** bounded primary and fallback Repair attempts cannot eliminate non-structural layout findings
- **THEN** the host returns the best structurally safe artifact with consolidated findings instead of opening another mandatory checkpoint

#### Scenario: Remaining finding is unsafe or semantic
- **WHEN** the best artifact has structural, integrity, or unapproved semantic findings
- **THEN** the host does not publish it and offers consolidated pause, stop, or manual-handoff choices

### Requirement: Support continuation and user-directed termination
At a human-gated checkpoint the user SHALL be able to continue iteration, approve, approve with findings, pause/resume, stop, or choose manual handoff while retaining current artifacts and evidence. A layout-only best-effort terminal result SHALL remain available for manual editing without requiring an approval decision.

#### Scenario: User wants to finish by hand
- **WHEN** the user selects manual handoff or receives a best-effort result
- **THEN** the result exposes the retained diagram, remaining findings, receipt status, and run evidence needed for manual work

#### Scenario: User accepts remaining findings
- **WHEN** the user explicitly accepts a result with unresolved findings
- **THEN** the run ends in `approved_with_findings` and does not misreport strict validation as passed
