## Why

The existing draw.io skill can create presentation diagrams and timeline-like git-flow diagrams, but it does not model product or project roadmaps as semantic planning artifacts. Roadmaps need structured tasks, milestones, dependencies, outcomes, and version-to-version milestone shift tracking so users can see what changed between plan revisions.

## What Changes

- Add a roadmap diagram capability for roadmap requests from prose, tables, YAML, and XML.
- Define `roadmap.yaml` as the canonical intermediate model for roadmap tasks, milestones, lanes, dependencies, outcomes, statuses, and baselines.
- Compare a current roadmap against a previous roadmap version when a baseline is provided.
- Render roadmap diagrams with time scale, lanes, tasks, milestones, dependencies, mutual influence, outcomes, and explicit milestone shift markers.
- Add roadmap-specific intake, authoring, validation, and rendering guidance to the draw.io skill package.
- Keep roadmap processing local-first and compatible with existing corporate draw.io skill constraints.

## Capabilities

### New Capabilities

- `roadmap-diagram-skill`: Agent workflow for roadmap intake, normalization, comparison, rendering, verification, and final artifact reporting.
- `roadmap-yaml-model`: Stable intermediate YAML model for roadmap lanes, tasks, milestones, dependencies, outcomes, baselines, and calculated deltas.
- `roadmap-rendering`: Deterministic rendering rules for roadmap time scales, lanes, task bars, milestone markers, dependency arrows, influence markers, outcomes, statuses, and milestone shifts.

### Modified Capabilities

- None. This change introduces roadmap-specific capabilities without changing existing BPMN requirements.

## Impact

- Updates `publish-drawio-skill/SKILL.md` routing so roadmap requests are treated as a first-class diagram type.
- Updates `publish-drawio-skill/references/diagram-intake.md` with roadmap-specific classification and clarification prompts.
- Updates or extends `publish-drawio-skill/references/diagram-types.md` with roadmap visual conventions.
- Adds a roadmap reference document and, if needed, a local generator and validator under `publish-drawio-skill/`.
- Adds examples and tests for YAML-only roadmaps and baseline-vs-current milestone shift rendering.
