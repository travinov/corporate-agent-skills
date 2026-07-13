## Why

Generated schema-v2 collaborations currently place every flow node in one horizontal row, keep participant height fixed, and route message flows between participant centers. Dense processes therefore produce unreadable BPMN: branches and exception paths overlap unrelated flows, message connections appear detached from the activities that send or receive them, and the strict validator still reports success because it checks DI presence but not spatial correctness.

## What Changes

- Replace the fixed one-row collaboration layout with deterministic graph-aware, multi-level geometry that preserves real lane ownership without inventing lanes for branch variants.
- Size participants dynamically from their laid-out contents and keep nodes, lanes, and boundary events inside their owning participant.
- Route sequence and message flows with direction-aware boundary anchors, orthogonal obstacle avoidance, and deterministic staggering for duplicate routes.
- Add spatial validation for detached endpoints, edge-through-shape routes, overlaps, out-of-container shapes, duplicate routes, crossings, and invalid waypoints; strict mode treats spatial warnings as blockers through the existing report contract.
- Prefer concrete send/receive activities as message-flow endpoints when they are known; participant-level endpoints remain valid for black-box or genuinely unspecified interactions but produce an ambiguity warning when concrete endpoints exist.
- Regenerate the supplied collaboration using task-level message endpoints and publish the updated BPMN skill as version `0.3.0`.

## Capabilities

### Modified Capabilities

- `bpmn-architect-skill`: require concrete message endpoints where available and require spatial validation before declaring an artifact complete.
- `bpmn-collaboration-v2`: guarantee readable multi-level collaboration layout, dynamic participants, and boundary-anchored obstacle-aware message routes.
- `bpmn-validation-reporting`: add stable machine-readable spatial findings and strict-mode behavior.
- `corp-bpmn-cli`: make `layout`, `validate`, and `build` enforce the new collaboration geometry contract.

## Impact

- Production code: `publish-bpmn-skill/scripts/corp-bpmn/src/core/bpmn-layout.mjs`, a new pure spatial-geometry helper, the BPMN validator, and semantic authoring lint.
- Guidance: `publish-bpmn-skill/SKILL.md` and BPMN/process-YAML references.
- Tests: compact dense collaboration fixtures plus deterministic layout, endpoint, spatial mutation, build, and release regressions.
- User artifacts: `GigaCode TEST Result/process.yaml`, `process.bpmn`, `process.md`, and `validation-report.json` are regenerated.
- Packaging: version sources and `dist/bpmn-architect-skill.zip` are updated; no new runtime dependency or release allowlist pattern is required.
