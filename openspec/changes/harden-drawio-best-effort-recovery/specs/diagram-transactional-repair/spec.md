## ADDED Requirements

### Requirement: Supply a compact hash-bound Repair envelope
The host SHALL provide Repair with one canonical DiagramSpec, one actionable finding set, one validation evidence set, host-owned scope, optional bound Reviewer verdict, machine feedback, and SHA-256 descriptors for immutable source documents. It SHALL NOT duplicate a full validation report across multiple input fields.

#### Scenario: Baseline has many routing findings
- **WHEN** a validation report contains repeated crossing and route-through evidence
- **THEN** Repair receives each actionable finding once with stable IDs and geometry while the full on-disk report is referenced by hash

#### Scenario: Repair fallback is invoked
- **WHEN** the primary Repair runtime fails and Qwen fallback starts
- **THEN** both attempts consume byte-identical canonical input and the ledger records the shared input SHA-256

## MODIFIED Requirements

### Requirement: Accept only monotonic improvements
Candidate comparison SHALL use the ordered vector semantic violations, structural errors, route-through-node, container/lane violations, edge crossings, overlaps, routing uncertainty, text overflow, and route complexity. A candidate SHALL become the next working baseline only if no higher-priority category worsens and at least one category improves; otherwise the prior working artifact remains the best-effort candidate.

#### Scenario: Crossings decrease but structure breaks
- **WHEN** a candidate reduces crossings and introduces a structural error
- **THEN** the candidate is rejected and cannot replace the best-effort candidate

#### Scenario: Route-through findings decrease without regressions
- **WHEN** a candidate preserves semantics and all higher-priority categories while reducing route-through-node findings
- **THEN** the candidate is accepted as the next working and best-effort baseline even if lower-priority strict findings remain
