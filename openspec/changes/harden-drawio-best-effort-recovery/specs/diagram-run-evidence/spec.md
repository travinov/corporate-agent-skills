## MODIFIED Requirements

### Requirement: Maintain an append-only run ledger
The extension SHALL append JSON Lines events for run creation, source selection, model resolution and fallback, patch attempts, candidate decisions, user decisions and their processing state, validation receipts, best-effort selection/publication, and terminal state changes.

#### Scenario: Repair candidate is rejected
- **WHEN** comparison rejects a candidate
- **THEN** the ledger retains the attempted artifact hash, report hash, quality vector, reasons, and baseline hash

#### Scenario: Repair model falls back
- **WHEN** a verified primary runtime failure triggers Qwen
- **THEN** the ledger links the primary failure and fallback success to the same role input hash and records both model proofs

#### Scenario: Resume processing is interrupted
- **WHEN** a decision is committed but the workflow stops before consuming its checkpoint
- **THEN** the ledger distinguishes committed from processed state so replay can continue exactly once

#### Scenario: Best-effort artifact is selected
- **WHEN** bounded work ends without strict success
- **THEN** the ledger records candidate hash, safety classification, receipt/report hashes, remaining findings, publication disposition, and selection reason

### Requirement: Verify evidence before reporting success
The extension SHALL provide an evidence verification command that recomputes artifact and report hashes and rejects missing or mismatched evidence. Strict success SHALL require a zero strict validation receipt; best-effort success SHALL require a matching receipt plus an independently reproducible structural-safety classification.

#### Scenario: Receipt was copied from another artifact
- **WHEN** receipt verification finds a different artifact SHA-256
- **THEN** strict and best-effort verification fail

#### Scenario: Best-effort trace contains only readability findings
- **WHEN** the selected artifact, report, and receipt hashes match and the safety classifier finds no structural or integrity issue
- **THEN** trace verification reports valid best-effort evidence while preserving `strict_passed: false`
