## Context

Schema-v2 collaborations use a custom layout path because `bpmn-auto-layout` accepts one executable process rather than a complete collaboration. The current implementation substitutes a fixed one-row grid and participant-center message routes, which preserves XML semantics but fails on branches, exception paths, long processes, and repeated cross-pool exchanges. Existing validation proves that DI exists but does not prove that shapes and routes form a readable diagram.

The installed toolchain already includes `bpmn-auto-layout` and `bpmn-moddle`. The change must remain local-first, deterministic, backward compatible with schema v1 and valid participant-level BPMN messaging, and must not invent lanes because lanes carry responsibility semantics rather than visual grouping.

## Goals / Non-Goals

**Goals:**

- Produce deterministic, multi-level v2 collaboration layouts from graph topology.
- Preserve real lanes and BPMN ownership while deriving participant bounds from content.
- Anchor every edge to element boundaries and route around unrelated shapes.
- Detect spatial defects in artifact-only and source-aware validation.
- Guide agents toward task-level message endpoints when concrete send/receive activities are known.

**Non-Goals:**

- Replacing BPMN DI with a presentation-only renderer.
- Adding artificial lanes for branches, scenarios, or error paths.
- Solving label placement or optimizing diagrams for every BPMN vendor.
- Rejecting participant-level message flows that are semantically appropriate for black-box pools.
- Adding a new graph-layout dependency.

## Decisions

### Reuse the installed process layouter per v2 process

Each executable process is serialized as a deterministic single-process BPMN view, passed through the public `layoutProcess` API, and parsed back with `bpmn-moddle`. Its node bounds and sequence-flow waypoints are normalized to a local origin and rebased into the collaboration plane.

This reuses the library's graph ranking, multi-row branch placement, docking, and Manhattan sequence routing without depending on private package internals. A bespoke topological layouter was rejected because it would duplicate tested behavior and create a larger maintenance surface. Importing private `bpmn-auto-layout/dist` helpers was rejected because their API is not stable.

### Compute participant geometry from laid-out content

Participant width and height are derived from the union of local shapes and sequence waypoints plus a label band and fixed padding. The collaboration uses deterministic pool order and gutter. Existing lane membership remains semantic input; no lane is synthesized for layout tracks. Boundary events are rebased with their attached activity.

### Keep spatial operations in a pure helper module

Rectangle bounds, boundary anchors, segment intersection, route signatures, obstacle scoring, and deterministic route staggering live in `spatial-geometry.mjs`. Layout and validation share these functions so a route accepted by the router is evaluated with the same geometry rules.

### Route message flows after all pools are placed

Message routing selects direction-aware source and target boundary anchors and evaluates deterministic orthogonal candidates through local, inter-pool, and outer corridors. Candidate scoring penalizes node intersections first, then foreign participant traversal, existing-route overlap, bends, and length. Stable flow-id ordering breaks ties. Routes with equal or reverse-equivalent signatures receive offset intermediate corridors while endpoint anchors remain fixed.

### Preserve participant endpoints but lint ambiguity

The schema continues to allow participant and eligible node message endpoints. Semantic lint emits a warning when a participant endpoint is used even though its owned process contains a concrete eligible send or receive activity. This preserves valid black-box BPMN while making underspecified authoring visible; strict mode blocks the warning through the existing report policy.

### Validate geometry with stable finding codes

Artifact validation checks numeric waypoints, boundary docking, shape containment, node overlap, edge-through-shape routes, duplicate routes, independent crossings, and participant overlap. Source-aware validation additionally checks lane ownership and expected endpoints. Errors represent structurally invalid geometry; warnings represent readable-but-ambiguous geometry and become blockers only in strict mode.

## Risks / Trade-offs

- [Per-process layout serialization could lose uncommon DI details] → Generate temporary views only from the already validated semantic model and keep semantic round-trip as the release gate.
- [Orthogonal message routing can still be suboptimal in extremely dense diagrams] → Prefer zero-collision candidates, expose stable spatial findings, and keep deterministic output suitable for manual adjustment.
- [Participant ambiguity warnings may affect existing strict builds] → Warn only when a concrete eligible endpoint exists and document participant-level black-box usage.
- [Geometry tolerances may create false positives at borders] → Use small explicit epsilon tolerances and test boundary, corner, and reverse-direction cases.
- [Library layout changes could alter output] → Pin the dependency, assert byte determinism within the shipped release, and package installed dependencies through the existing release flow.

## Migration Plan

1. Add geometry utilities, v2 layout composition, semantic warning, and spatial validator behind the existing CLI commands.
2. Add dense fixtures and regression tests while retaining the unchanged v1 `layoutProcess` path.
3. Update authoring guidance and version sources to `0.3.0`.
4. Replace participant endpoints in the supplied process with known task endpoints and rebuild all artifacts in strict mode.
5. Run targeted tests, full BPMN tests, skill validation, clean-package release tests, and a fresh-agent forward test.
6. Rebuild `dist/bpmn-architect-skill.zip`; rollback consists of restoring the prior skill package and the prior generated artifacts.

## Open Questions

None. Label-overlap optimization remains a separately scoped enhancement.

## Verification Notes

- A fresh-agent strict build of the supplied 57-node collaboration passed with no findings and produced six distinct vertical node levels with task-level endpoints for all seven messages.
- Final architecture review found no blocking defect after the v1 fallback, lane containment, related-element identity, and post-stagger spatial-gate fixes.
- Residual limitation: a large layout can be CPU-bound for several minutes without CLI progress output; extremely dense graphs remain protected by the strict spatial gate but may require future routing optimization rather than validator relaxation.
