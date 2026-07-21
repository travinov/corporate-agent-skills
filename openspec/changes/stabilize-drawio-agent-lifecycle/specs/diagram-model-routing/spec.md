## ADDED Requirements

### Requirement: Correct role output contracts once without changing models
After a model-proven, isolated, zero-tool role attempt fails only JSON Schema or deterministic cross-field output validation, the runtime MAY invoke the same role and configured model exactly once with the original input hash and structured JSON Pointer errors. It SHALL preserve both attempts and SHALL NOT use this path for capability, isolation, tool, timeout, model-proof, or evidence-integrity failures.

#### Scenario: Semantic Analyst copies a forbidden technical ID
- **WHEN** Qwen returns a model-proven semantic plan whose node ID fails the output contract
- **THEN** the runtime records the invalid output and makes one Qwen correction attempt containing the exact failing pointer and rule

#### Scenario: Corrected output is still invalid
- **WHEN** the one correction attempt fails its contract
- **THEN** no third attempt or different model is selected and the host creates a resumable role-contract checkpoint

#### Scenario: Isolation fails
- **WHEN** any role attempt exposes or calls a prohibited tool or cannot prove its requested model
- **THEN** the role fails closed without a contract-correction retry

### Requirement: Bind Reviewer identity to runtime proof
The final Reviewer verdict SHALL derive reviewer model, provider, resolution mode, and output provenance only from the verified role runtime and SHALL reject contradictory analytical decisions before candidate acceptance.

#### Scenario: Reviewer self-reports another model
- **WHEN** Reviewer output contains legacy identity fields that differ from verified runtime evidence
- **THEN** those fields cannot override host evidence and the mismatch is recorded or rejected according to the v2 contract

#### Scenario: Reviewer approves with an error finding
- **WHEN** analytical output declares `approve` while retaining any error-level finding
- **THEN** the host rejects the contradictory verdict and does not enter final acceptance
