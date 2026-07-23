## MODIFIED Requirements

### Requirement: Persist an explicit supervisor state machine
The extension SHALL persist each run state and SHALL support `analyzed`, `awaiting_decision`, `patching`, `validating`, `retrying`, `plateau`, `awaiting_feedback`, `final_review`, `completed`, `best_effort_completed`, `manual_handoff`, and `stopped` outcomes without losing the last accepted candidate.

#### Scenario: Corporate main host starts a run
- **WHEN** the workflow runs on corporate GigaCode 26.5.17
- **THEN** the main extension host completes a deterministic preflight and records `host-preflight.json` plus a `host_preflight` manifest event before diagram analysis

#### Scenario: User invokes deterministic review command
- **WHEN** the user runs `/drawio:review` with a `.drawio` path inside the current workspace
- **THEN** the custom command host creates a unique run directory and completes preflight, strict validation, and isolated independent review before the interactive model receives the structured result

#### Scenario: Interactive model cannot select workflow tools
- **WHEN** `/drawio:review` is running
- **THEN** correctness does not depend on the interactive model choosing directory, search, shell, or native agent tools

#### Scenario: Host evidence is absent
- **WHEN** the run lacks main-host preflight evidence
- **THEN** the workflow fails closed and does not claim that its agent, tools, or validation executed

#### Scenario: Validation finds repairable defects
- **WHEN** an analyzed diagram has deterministic repairable findings
- **THEN** the supervisor transitions through patching and validating from the last accepted candidate

#### Scenario: User resumes after clarification
- **WHEN** a run in `awaiting_feedback` receives clarification
- **THEN** the supervisor resumes the same run with its accepted baseline, manifest, decisions, and findings intact

#### Scenario: Resumed create repeats create action
- **WHEN** a create run already has an accepted artifact and the isolated Supervisor again returns `action: create`
- **THEN** the deterministic host normalizes execution to repair/review and records the original declaration without regenerating the baseline

### Requirement: Recover interrupted human decisions
The extension SHALL make checkpoint decisions idempotent across process interruption and SHALL continue an incompletely processed decision instead of returning stale state.

#### Scenario: Continue is committed before workflow advancement
- **WHEN** the ledger contains a hash-valid `decision_committed` event but the checkpoint is still pending and no matching processed marker exists
- **THEN** replay resumes validation and processing of that decision exactly once

#### Scenario: Decision is fully processed
- **WHEN** the same decision ID already has a matching processed marker and terminal or new-checkpoint state
- **THEN** replay returns `already_applied` without invoking roles again

### Requirement: Gate strict completion on exact validation evidence
The supervisor MUST NOT enter `completed` unless strict validation succeeded and the validation receipt artifact hash equals the current final artifact hash. A structurally safe artifact with unresolved non-structural findings MAY enter only `best_effort_completed` under the separate best-effort contract.

#### Scenario: Artifact changes after validation
- **WHEN** the final file hash differs from the receipt artifact hash
- **THEN** strict completion and best-effort delivery are refused until matching evidence is available

#### Scenario: Strict validation fails only on readability
- **WHEN** a hash-bound artifact has no structural or integrity findings but strict readability checks fail after bounded work
- **THEN** the host may select `best_effort_completed` but does not report `completed`
