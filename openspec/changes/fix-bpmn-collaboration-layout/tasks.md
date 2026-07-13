## 1. Spatial foundation

- [x] 1.1 Add shared pure geometry utilities for bounds, anchors, intersections, route signatures, obstacle scoring, and staggering
- [x] 1.2 Add a compact dense schema-v2 collaboration fixture covering parallel, alternative, reverse, exception, lane, boundary-event, and repeated-message cases

## 2. Collaboration layout

- [x] 2.1 Replace fixed-row v2 placement with deterministic per-process `bpmn-auto-layout` composition and dynamic participant bounds
- [x] 2.2 Preserve authored lane ownership and boundary-event attachment without creating artificial lanes
- [x] 2.3 Implement boundary-anchored orthogonal message routing with obstacle avoidance and deterministic duplicate-route staggering

## 3. Validation and authoring

- [x] 3.1 Add spatial DI validation with stable finding codes in artifact-only and source-aware modes
- [x] 3.2 Add participant-endpoint ambiguity lint while preserving valid black-box participant message flows
- [x] 3.3 Update skill and process-YAML authoring guidance for concrete message endpoints and strict spatial review

## 4. Regression coverage

- [x] 4.1 Add message-endpoint semantic, warning, strict-mode, and round-trip tests
- [x] 4.2 Add deterministic multi-level layout, containment, anchoring, obstacle, and route-staggering tests
- [x] 4.3 Add mutated-DI spatial finding tests and extend v1/v2 generation, build, and contract regressions

## 5. Acceptance and release

- [x] 5.1 Update the supplied `process.yaml` to task-level message endpoints and regenerate BPMN, documentation, and strict validation report
- [x] 5.2 Bump all BPMN skill version sources to `0.3.0` and rebuild the distributable ZIP
- [x] 5.3 Run targeted tests, full BPMN regressions, OpenSpec validation, skill validation, clean-package release tests, and deterministic rebuild comparison
- [x] 5.4 Run a fresh-agent forward test and final architecture verification, then record any residual limitations
