## 1. Roadmap Skill Routing

- [x] 1.1 Update `publish-drawio-skill/SKILL.md` to include roadmap diagrams in trigger language and workflow routing.
- [x] 1.2 Update `publish-drawio-skill/references/diagram-intake.md` with roadmap classification rules and roadmap-specific clarification prompts.
- [x] 1.3 Update `publish-drawio-skill/references/diagram-types.md` with roadmap shape, lane, timeline, dependency, status, and shift-marker conventions.
- [x] 1.4 Add a roadmap reference document covering intake, `roadmap.yaml`, baseline comparison, rendering, validation, and troubleshooting.

## 2. Roadmap YAML Model

- [x] 2.1 Define the `roadmap.yaml` structure for metadata, time scale, lanes, tasks, milestones, dependencies, influence relationships, outcomes, owners, statuses, risks, and baseline data.
- [x] 2.2 Add schema validation for required fields, deterministic ids, valid dates or periods, supported statuses, duplicate ids, and unresolved refs.
- [x] 2.3 Add normalization guidance or helpers for prose, table, YAML, and XML inputs.
- [x] 2.4 Add baseline comparison logic or documented rules for delayed, accelerated, unchanged, added, and removed milestones.

## 3. Roadmap Rendering

- [x] 3.1 Implement or document deterministic placement for roadmap time scales, lanes, task bars, milestone markers, and outcome annotations.
- [x] 3.2 Implement or document visual treatment for baseline positions, current positions, milestone movement arrows, and delta labels.
- [x] 3.3 Implement or document visual treatment for blocking dependencies, influence relationships, statuses, risks, and optional impact labels.
- [x] 3.4 Add readability validation for unresolved refs, overcrowded layouts, missing lanes, invalid time ranges, and excessive dependency crossings.

## 4. Examples and Tests

- [x] 4.1 Add a YAML-only roadmap fixture with lanes, tasks, milestones, dependencies, outcomes, and statuses.
- [x] 4.2 Add a baseline-vs-current roadmap fixture that demonstrates delayed, accelerated, unchanged, added, and removed milestones.
- [x] 4.3 Add table and XML input examples or fixtures that normalize to `roadmap.yaml`.
- [x] 4.4 Add relevant generator, validator, or documentation tests for roadmap routing, schema validation, baseline deltas, and rendered `.drawio` structure.

## 5. Verification

- [x] 5.1 Run the relevant draw.io skill documentation or script tests.
- [x] 5.2 Validate generated roadmap `.drawio` files with the existing draw.io validator when generation is implemented.
- [x] 5.3 Run `openspec validate add-roadmap-diagram-skill --strict`.
- [x] 5.4 Review the change against the roadmap OpenSpec requirements before implementation handoff.
