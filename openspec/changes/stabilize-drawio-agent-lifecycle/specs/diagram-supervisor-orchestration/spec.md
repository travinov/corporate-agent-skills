## MODIFIED Requirements

### Requirement: Persist an explicit supervisor state machine
The extension SHALL persist schema-valid, event-bound v2 run state and SHALL support `analyzed`, `awaiting_decision`, `patching`, `validating`, `retrying`, `plateau`, `awaiting_feedback`, `final_review`, `publication_pending`, `completed`, `approved_with_findings`, `manual_handoff`, and `stopped` outcomes without losing the last accepted candidate. Resume SHALL recover incomplete transactions under a run-level lock before executing a decision.

#### Scenario: Corporate main host starts a run
- **WHEN** the workflow runs on corporate GigaCode 26.5.17
- **THEN** the main extension host completes deterministic preflight, captures the v2 implementation/source snapshot, and records both before role execution

#### Scenario: User invokes deterministic review command
- **WHEN** the user runs `/drawio:review` with a selected `.drawio` inside the current workspace
- **THEN** the host creates a unique v2 review workflow and completes preflight, strict validation, and isolated independent review before returning a structured result

#### Scenario: Host evidence or workflow binding is absent
- **WHEN** main-host preflight, implementation snapshot, source bundle, or required state binding cannot be verified
- **THEN** the workflow fails closed and neither publication nor a success claim is allowed

#### Scenario: Validation finds repairable defects
- **WHEN** an accepted diagram has deterministic repairable findings
- **THEN** the supervisor transitions through patching and validating from that exact accepted candidate

#### Scenario: User resumes after clarification
- **WHEN** a run in `awaiting_feedback` receives clarification
- **THEN** the supervisor reconciles a new source-bundle revision and resumes the same run with its accepted baseline, manifest, decisions, and findings intact

## ADDED Requirements

### Requirement: Honor role requests for human input
The host SHALL interpret schema-valid `needs_human` and `requires_human` results consistently and SHALL stop at a consolidated checkpoint before any semantic mutation or final acceptance that depends on unresolved input.

#### Scenario: Create Semantic Analyst reports ambiguity
- **WHEN** a create plan returns `requires_human: true` with an unresolved source or semantic decision
- **THEN** the host does not render the ambiguous plan and returns an executable semantic checkpoint

#### Scenario: Supervisor requests a checkpoint
- **WHEN** Supervisor returns a phase-compatible checkpoint action or `needs_human` status
- **THEN** the host records the decision and creates the declared checkpoint instead of continuing silently or rejecting a schema-permitted action generically

### Requirement: Validate existing artifacts before semantic repair planning
For review and improve, the host SHALL import and strictly validate the immutable baseline before Semantic Analyst or Repair is asked to plan changes, and SHALL include the resulting report and receipt in their source bundle.

#### Scenario: Semantic role output is invalid
- **WHEN** the imported artifact has actionable validation findings but Semantic Analyst exhausts its bounded output-correction attempt
- **THEN** baseline validation evidence remains available and the host returns a resumable role-contract checkpoint rather than claiming the validator did not run

### Requirement: Recover all expected lifecycle failures
Role contract failure, patch precondition failure, patch application failure, strict validation failure, Reviewer failure, candidate rejection, and an interrupted transaction SHALL preserve the accepted baseline and lead to a resumable checkpoint or bounded automatic retry.

#### Scenario: Patch precondition no longer matches
- **WHEN** Repair returns a patch whose target hash or expected value differs from the accepted artifact
- **THEN** the host records the failure, retains the accepted artifact, and offers executable continue, pause, stop, and manual-handoff decisions

#### Scenario: Validation process fails unexpectedly
- **WHEN** the validator cannot produce a schema-valid receipt for a temporary candidate
- **THEN** the source and accepted artifact remain unchanged and the run enters a diagnostic recovery checkpoint
