## MODIFIED Requirements

### Requirement: Record model fallback and degradation
Model resolution SHALL record `requested_model`, `resolved_model`, provider, resolution mode, `fallback_used`, attempted model, failure kind, and immutable input hash. The adapter SHALL prefer a verified isolated CLI invocation with an explicit model argument, use only policy-declared bounded runtime fallbacks, use native routing only when the runtime proves its model override, and use inherited-model degradation last.

#### Scenario: GigaCode headless model is proven
- **WHEN** an isolated role exits successfully with schema-valid output
- **THEN** `system.model`, every `assistant.message.model`, and `result.stats.models` agree with the attempted model before `model_resolved` is appended

#### Scenario: Model evidence is missing or inconsistent
- **WHEN** any required GigaCode model evidence is absent or names a different attempted model
- **THEN** the role fails closed without publishing its output or any success event and the interactive model remains unchanged

#### Scenario: Repair primary times out after verified initialization
- **WHEN** MiniMax produces a verified system initialization event but no result before the bounded timeout
- **THEN** the runtime records a non-terminal primary failure and invokes Repair once on configured Qwen with the identical input hash

#### Scenario: Repair fallback succeeds
- **WHEN** Qwen returns schema-valid output with verified model proof
- **THEN** the role result records `fallback_used: true`, the primary failure evidence, and degraded model diversity before deterministic patch processing continues

#### Scenario: Repair fallback also fails
- **WHEN** the single Qwen fallback cannot produce a verified schema-valid result
- **THEN** the role records a terminal failure and returns control to bounded best-effort selection without another model fallback

#### Scenario: Requested model is unavailable
- **WHEN** a role cannot use its requested model and a policy-declared fallback is eligible
- **THEN** the run records both attempts and the user-visible result states that model diversity was degraded
