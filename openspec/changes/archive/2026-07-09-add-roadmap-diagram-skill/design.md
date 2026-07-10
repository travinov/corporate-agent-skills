## Context

The repository currently contains a mature `publish-drawio-skill/` package for presentation-oriented diagrams and a separate BPMN skill/toolchain for semantic process models. Roadmap requests sit between those two patterns: the output is a draw.io diagram, but the input needs a semantic planning model so the agent can compare plan versions and show milestone shifts reliably.

Roadmaps are time-based artifacts. A useful roadmap diagram must preserve tasks, milestones, dependencies, outcomes, statuses, lanes, and the relationship between the current plan and a previous baseline. A generic flowchart cannot represent that comparison clearly, and the existing git-flow timeline generator is too branch-specific to cover roadmap semantics directly.

The workflow must remain local-first. Roadmap content must be processed through local files, bundled scripts, and approved local/internal dependencies only.

## Goals / Non-Goals

**Goals:**

- Treat roadmap diagrams as a first-class draw.io skill route.
- Make `roadmap.yaml` the source of truth for generated roadmap diagrams.
- Accept roadmap inputs from prose, tables, YAML, and XML.
- Compare current roadmap data with a previous roadmap version when provided.
- Render milestone shifts, dependencies, mutual influence, tasks, outcomes, statuses, and lanes in a readable time-based diagram.
- Provide deterministic generation and validation paths suitable for tests and Git review.

**Non-Goals:**

- Building a full roadmap planning application or editor.
- Integrating with external SaaS roadmap/project-management systems in the first delivery.
- Replacing BPMN process modeling or git-flow timeline diagrams.
- Guaranteeing perfect import for arbitrary third-party XML schemas without a documented mapping.
- Requiring PNG/SVG/PDF export beyond the existing draw.io skill export path.

## Decisions

### Decision: Use `roadmap.yaml` as the canonical source of truth

All roadmap inputs will normalize into `roadmap.yaml` before rendering.

Alternatives considered:

- Direct LLM-authored `.drawio`: rejected because version comparison, stable ids, and validation would be fragile.
- Mermaid timeline/Gantt only: rejected because milestone shift markers, dependency influence, and draw.io styling need stronger control.
- Reusing git-flow JSON directly: rejected because branch events do not map cleanly to roadmap tasks, outcomes, lanes, and baselines.

Rationale: YAML is reviewable in Git, agent-friendly, schema-validatable, and consistent with the repository's existing semantic-intermediate-model approach.

### Decision: Keep baseline comparison explicit

The roadmap model will distinguish current roadmap data from an optional baseline. The comparison step will calculate task movement, milestone movement, added/removed milestones, dependency changes, and outcome changes.

Alternatives considered:

- Encode only current dates and ask the renderer to infer movement visually: rejected because the diff would be implicit and hard to test.
- Require users to manually annotate every shift: rejected because roadmap comparison should work from two versions when stable ids are available.

Rationale: milestone movement is the core differentiator for roadmap diagrams and must be machine-readable before rendering.

### Decision: Render old and new milestone positions together

When a milestone shifts, the diagram will show the baseline position as a faded or dashed marker, the current position as the primary marker, and a labeled movement arrow between them.

Alternatives considered:

- Show shifts only in a legend/table: rejected because users need to see the schedule impact in context.
- Show only the current plan and color changed milestones: rejected because it hides the amount and direction of movement.

Rationale: roadmap consumers need to quickly understand what moved, by how much, and what downstream items may be affected.

### Decision: Add a roadmap-specific generator only if hand-authored XML becomes insufficient

The first implementation should add roadmap guidance and structured examples. If deterministic placement or comparison logic becomes non-trivial, add `scripts/roadmap.py` or equivalent with a validator, following the existing `gitflow.py` pattern.

Alternatives considered:

- Immediately create a full generator before validating the model: premature if initial scope can be covered by documented XML authoring.
- Force all roadmaps through Mermaid Gantt: too limited for baseline deltas and custom markers.

Rationale: this keeps the change small and reversible while preserving a clear path to deterministic generation.

## Risks / Trade-offs

- Roadmap XML inputs may vary by source system -> Mitigation: document a supported XML mapping and report unsupported fields instead of guessing.
- Prose and table inputs can omit stable ids -> Mitigation: generate stable ids from labels and dates, and record matching assumptions in `roadmap.yaml`.
- Dense roadmaps can become unreadable -> Mitigation: support lane grouping, time-scale selection, dependency filtering, and validation warnings for overcrowded layouts.
- Baseline matching can be wrong after milestone renames -> Mitigation: prefer explicit ids and fall back to name/date matching only with assumptions.
- Shift arrows can visually clutter the diagram -> Mitigation: render only material shifts by default and summarize unchanged milestones.

## Migration Plan

1. Add roadmap capability specs under the OpenSpec change.
2. Update draw.io skill routing and intake references for roadmap requests.
3. Add roadmap authoring/rendering reference material.
4. Add schema/fixture examples for current-only and baseline-vs-current roadmaps.
5. Add a local generator/validator if deterministic roadmap placement is required during implementation.

Rollback is straightforward: remove the roadmap-specific draw.io skill documentation, fixtures, optional scripts, and OpenSpec change artifacts. Existing BPMN and draw.io behavior remain independent.

## Open Questions

- Should table inputs target CSV, XLSX, Markdown tables, or all three in the first delivery?
- Should XML support start with a project-specific schema, a generic roadmap XML shape, or draw.io XML import annotations?
- What threshold should define a "material" milestone shift when rendering labels: any date change, week-level movement, or configurable days?
- Should default roadmap lanes be products, teams, workstreams, or inferred from the strongest field in the input?
