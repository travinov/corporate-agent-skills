# Regression baseline: 1.23.0-corporate.13

Captured before switching the release metadata and mutable workflow defaults to v2.

## Immutable rollback identity

- Source branch: `codex/drawio-packaged-guide-v1.23.0-corporate.13`
- Source commit: `1ca78a819a94bca05c4a6519f95e0088d7d9226e`
- Extension version: `1.23.0-corporate.13`
- ZIP SHA-256: `7606387e6d82a9f4e6afc95df1d3001bf8d695c3166eafc6b553c39e0d33f4c2`
- ZIP manifest SHA-256: `1f3d46ef4b508ba90b2273b37c9c1edb844703a0edce078fc34998fb2b8e0737`
- Extension manifest SHA-256: `65b4ad6b72eb9b5d90d15651c3aaeae109e66d012381b180144dffd827447af6`
- `SKILL.md` SHA-256: `c71af882de64cdc9a00d8fb47b0ef6622a2ddcba626d9f576c21ae3f4222c275`
- Packaged corporate guide SHA-256: `3cd795be7cc9b6212faf734e3b8572bec829bc6f4ed8db1d64b8443dc426c91d`

The rollback artifact remains reproducible from the source commit and is not migrated in place.

## Stable command forms

- `/drawio:create "what the diagram must show"`
- `/drawio:create --diagram "path/to/result.drawio" --request "what the diagram must show"`
- `/drawio:review`
- `/drawio:improve`
- `/drawio:improve "requirements or corrections"`
- `/drawio:improve --diagram "path/to/existing.drawio" --request "requirements or corrections"`
- `/drawio:resume continue "optional notes"`
- `/drawio:resume approve`
- `/drawio:resume --run "run-id-or-directory" --decision <decision> --feedback "optional notes"`
- `/drawio:trace`
- `/drawio:trace --run "run-id-or-directory"`

## Model and isolation baseline

- Supervisor: `GigaChat-3-Ultra`
- Semantic Analyst: `vllm/Qwen3.6-35B-262k`
- Repair: `vllm/MiniMax-M3-113k`
- Reviewer: `vllm/DeepSeek-V4-Flash-262k`
- Roles use `--extensions none`, an empty MCP allowlist, the no-tools core sentinel, excluded tool names, a bounded session-turn budget, and runtime model proof.

## Test evidence

- Earlier clean-checkout full available pytest scope: `226 passed, 1 failed, 1 error, 1 skipped`; the failure and collection error were caused only by missing local `openpyxl` on the personal Mac. Corporate self-check previously proved `openpyxl 3.1.5` together with supported PyYAML/jsonschema versions.
- Focused documentation/contract slice after the no-auto-OpenSpec wording change: `11 passed`.
- Focused command/orchestrator compatibility slice: `6 passed`.
- Focused supervisor/validation/semantic gate slice: `5 passed`.
- Earlier clean-checkout installer plus deterministic release parity smoke: `2 passed`.

Live multi-model acceptance is intentionally not claimed on this personal Mac because GigaCode CLI is installed only on the corporate Mac.
