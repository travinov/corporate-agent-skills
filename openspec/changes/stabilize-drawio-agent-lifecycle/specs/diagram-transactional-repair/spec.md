## MODIFIED Requirements

### Requirement: Publish candidates atomically
The patcher SHALL write and validate a temporary candidate, while the lifecycle host SHALL revalidate all accepted evidence and source/target revisions before a journaled no-clobber or compare-and-swap publication. Publication SHALL retain sufficient rollback and recovery information and SHALL commit a terminal event only after the target hash equals the accepted artifact hash.

#### Scenario: Candidate write is interrupted
- **WHEN** patch application or candidate validation fails before publication
- **THEN** the original and last accepted artifact remain unchanged and the run exposes a resumable recovery checkpoint

#### Scenario: Evidence changes before publication
- **WHEN** the accepted artifact, receipt, checkpoint, workflow binding, or improve source revision changes after final review
- **THEN** publication is refused before target mutation and the mismatch is recorded

## ADDED Requirements

### Requirement: Constrain semantic patches to approved deltas
Every semantic patch SHALL declare typed add, remove, update, relationship, and parent changes and SHALL pass a deterministic preview proving that its computed semantic diff is represented by the hash-bound human-approved delta for the same baseline and source bundle.

#### Scenario: Patch exceeds semantic authorization
- **WHEN** a patch contains a semantic operation absent from the approved delta
- **THEN** the patch is not applied under that authorization and the accepted baseline remains active

#### Scenario: Layout patch changes semantics
- **WHEN** a layout-only patch changes a label, relationship, parent, endpoint, or semantic element set
- **THEN** patch application fails and does not write a candidate

### Requirement: Recover deterministic tool failures
Patch schema, precondition, application, replay, validation, comparison, and Reviewer-gate failures SHALL be classified as bounded attempt evidence and SHALL NOT strand a run after its checkpoint has been consumed.

#### Scenario: Candidate replay differs
- **WHEN** replaying the patch from the accepted baseline produces a different hash from the reviewed candidate
- **THEN** the candidate is rejected, the baseline remains accepted, and the run returns to a resumable diagnostic checkpoint
