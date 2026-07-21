## MODIFIED Requirements

### Requirement: Verify evidence before reporting success
The extension SHALL provide a strictly read-only evidence verification command that validates event schemas and chaining, replays lifecycle state, validates workflow/state/source/decision/publication bindings, recomputes artifact and report hashes, schema-validates receipts against the trusted captured validator, verifies implementation and routing snapshots, and returns structured invalid diagnostics for missing, malformed, mismatched, or non-passing evidence.

#### Scenario: Receipt was copied from another artifact
- **WHEN** receipt verification finds a different artifact SHA-256 or run ID
- **THEN** verification fails and success is not reported

#### Scenario: Workflow or state was edited without a bound event
- **WHEN** a mutable snapshot differs from the latest snapshot hash reconstructed from the manifest
- **THEN** trace returns `tampered_or_incomplete` and does not present the edited terminal state as verified

#### Scenario: Evidence is malformed
- **WHEN** a JSONL line, event, receipt, or referenced descriptor is malformed or lacks a required field
- **THEN** trace reports the exact line or path as invalid instead of raising an unstructured exception

#### Scenario: Recovery data exists during trace
- **WHEN** a stale transaction journal is present
- **THEN** trace reports the pending recovery condition without changing state, manifest, journal, or any artifact

## ADDED Requirements

### Requirement: Bind implementation and policy snapshots
Every v2 run SHALL record hashes for the orchestration host, review host, supervisor toolchain, role runtime adapter, validator, role prompts, output schemas, model-routing policy, extension manifest, and version used for that run.

#### Scenario: A role prompt changes after the run
- **WHEN** an installed prompt or routing policy no longer matches the captured run snapshot
- **THEN** trace distinguishes the valid historical run evidence from the changed current installation and does not validate the run against substituted current files

### Requirement: Validate receipt authority and containment
Receipt verification SHALL compile and apply the declared receipt schema, require the captured trusted validator identity and hash, constrain report/stdout/stderr paths to the attempt directory, and verify timestamps, byte lengths, exit/result consistency, and unexpected properties.

#### Scenario: Substitute validator signs its own receipt
- **WHEN** a self-consistent receipt references a validator other than the run's trusted captured validator
- **THEN** receipt verification fails even if its internal artifact and report hashes agree

#### Scenario: Receipt output path escapes its attempt
- **WHEN** a receipt references a report or capture outside the bound attempt directory
- **THEN** verification fails before reading or trusting that output
