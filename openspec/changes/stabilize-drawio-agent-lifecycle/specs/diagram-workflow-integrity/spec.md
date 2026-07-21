## ADDED Requirements

### Requirement: Validate versioned lifecycle control artifacts
Every new mutable diagram run SHALL use schema-valid v2 workflow, state, checkpoint, decision, source-bundle, and publication-transaction artifacts, and the host SHALL reject an artifact before acting on any invalid field or path.

#### Scenario: Workflow path escapes the workspace
- **WHEN** a resumable workflow names a target outside its recorded workspace or an accepted artifact outside its run directory
- **THEN** resume fails before any role, state transition, copy, or publication occurs

#### Scenario: Old v1 run is inspected
- **WHEN** trace opens a v1 run created by an earlier extension
- **THEN** the compatibility reader verifies and displays available evidence without rewriting the run or treating it as a safe v2 mutable workflow

### Requirement: Serialize and deduplicate run decisions
The host SHALL hold one run-level lock across recovery, checkpoint verification, role/tool execution, decision persistence, and resulting state transitions, and SHALL apply a decision identifier at most once.

#### Scenario: Two resumes target one checkpoint
- **WHEN** two processes concurrently attempt different decisions for the same pending checkpoint
- **THEN** exactly one process acquires the run and the other returns a structured already-running or stale-checkpoint result without overwriting a decision or corrupting the ledger

#### Scenario: The same decision is retried
- **WHEN** a client repeats a previously committed decision identifier after losing the command response
- **THEN** the host returns the recorded result without invoking another role or applying the decision twice

### Requirement: Revalidate before transactional publication
The host SHALL schema-validate and hash-verify the workflow, checkpoint, accepted artifact, report, receipt, trusted validator, source revision, target containment, and current state before staging publication, and SHALL commit completion only after the published bytes match the accepted hash.

#### Scenario: Accepted artifact changes after final review
- **WHEN** the accepted artifact hash differs from the final checkpoint or receipt immediately before approval
- **THEN** publication is refused and the existing target remains byte-identical

#### Scenario: Improve target changes outside the run
- **WHEN** the user or another process edits the target diagram after the run captured its source revision
- **THEN** the host preserves both versions and creates a conflict checkpoint instead of overwriting the target

#### Scenario: Create target appears concurrently
- **WHEN** a create target appears between final verification and publication
- **THEN** the no-clobber transaction fails without replacing that file

### Requirement: Recover interrupted lifecycle transactions
The host SHALL journal state and publication transactions so a later resume can classify and recover an interruption without repeating a non-idempotent mutation or losing the last accepted candidate.

#### Scenario: Process stops after publishing bytes
- **WHEN** the target contains the verified accepted bytes but the terminal event was not committed
- **THEN** recovery verifies the journal and target hash and completes or checkpoints the transaction without copying different bytes

#### Scenario: Process stops before publication
- **WHEN** a publication journal exists but the target was not changed
- **THEN** recovery retains the accepted candidate and returns to a resumable final checkpoint
