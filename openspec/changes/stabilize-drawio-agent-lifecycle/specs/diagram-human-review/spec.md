## MODIFIED Requirements

### Requirement: Support continuation and user-directed termination
At a checkpoint the user SHALL be able to continue iteration, approve an eligible final candidate, explicitly approve structurally safe unresolved findings, pause/resume, stop, or choose manual handoff while retaining the last accepted artifact and evidence. Every advertised decision SHALL be executable from that checkpoint and SHALL NOT be shown when its state transition is invalid.

#### Scenario: User wants to finish by hand
- **WHEN** the user selects manual handoff from any recoverable checkpoint
- **THEN** the run ends in `manual_handoff` with the last accepted diagram, remaining findings, source bundle, diffs, and receipt status available without overwriting the source

#### Scenario: User accepts remaining non-integrity findings
- **WHEN** the accepted artifact is structurally valid, its evidence is intact, no integrity finding remains, and the user explicitly selects `approve_with_findings`
- **THEN** the host publishes transactionally, records every unresolved finding, preserves `strict_passed: false` when applicable, and does not report strict validation as passed

#### Scenario: A decision is incompatible with the checkpoint
- **WHEN** a checkpoint cannot safely execute a requested decision
- **THEN** that decision is absent from the checkpoint's allowed decisions and no generated command advertises it

## ADDED Requirements

### Requirement: Bind semantic approval to an exact typed delta
The host SHALL present a typed semantic delta separately from layout changes and SHALL bind the user's decision to the baseline semantic digest, semantic-plan hash, source-bundle hash, and delta hash. The host SHALL NOT create or attribute a human approval that was not supplied through the checkpoint decision.

#### Scenario: Repair proposes a different semantic mutation
- **WHEN** the user approved adding a return loop but Repair proposes deleting an unrelated node or changing another relationship
- **THEN** the patch is not applied under the old approval and a new consolidated semantic checkpoint describes the additional delta

#### Scenario: Repair matches the approved delta
- **WHEN** deterministic patch preview proves that every semantic mutation is represented by the approved typed delta
- **THEN** the host may apply the candidate and continue through validation and independent review without another semantic question

### Requirement: Reconcile new feedback before continuing
Non-empty feedback supplied with `continue` SHALL become an immutable confirmed clarification and SHALL be processed by Semantic Analyst against the current accepted DiagramSpec before Repair proceeds.

#### Scenario: Feedback adds a missing return path
- **WHEN** the user reports a missing return loop at a plateau
- **THEN** Semantic Analyst produces a new delta against the accepted candidate and the host requests one semantic approval before mutation

#### Scenario: Feedback is layout-only
- **WHEN** reconciliation finds no semantic delta and only requests routing or label layout changes
- **THEN** the host continues the existing run automatically to Repair without an unnecessary semantic checkpoint
