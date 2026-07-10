## Why

Recent BPMN generation logs show that the agent can reach a valid BPMN result, but it still discovers basic `process.yaml` shape and BPMN modeling choices through avoidable validation failures. This change tightens the spec so the skill guides the agent toward a valid first draft, simple-but-semantic BPMN modeling, and lower-noise validation.

## What Changes

- Add requirements for a canonical minimal `process.yaml` skeleton and authoring contract.
- Clarify that lanes represent actors, roles, systems, or responsibility partitions, not ordinary branch choices.
- Clarify exclusive gateway default-flow behavior so the agent does not invent arbitrary defaults.
- Require the skill to avoid advanced events for plain duration notes unless the timing changes process control semantics.
- Require localized semantic validation behavior for Russian process labels so normal Russian task names do not produce noisy warnings.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bpmn-architect-skill`: Add agent-facing modeling guidance for branch choices, lanes, defaults, timers, and first-draft quality.
- `process-yaml-model`: Add a stable minimal YAML authoring contract that prevents common malformed first drafts.
- `bpmn-validation-reporting`: Tune validation semantics for localized labels and clarify default-flow findings.

## Impact

- Affected skill documentation: `publish-bpmn-skill/SKILL.md` and `publish-bpmn-skill/references/*.md`.
- Affected CLI validation rules: `publish-bpmn-skill/scripts/corp-bpmn/src/core/semantic-linter.mjs` and related tests if implementation follows this spec.
- No external dependencies or network services are introduced.
