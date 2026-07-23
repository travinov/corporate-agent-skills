# Task 11 report

## Scope

- Added phase-specific Repair output selection: layout-only improve requests use
  `layout-repair-intent.v1`, while semantic Repair stays on
  `diagram-patch.v1`.
- Made layout-intent scope host-owned and persisted: action, page, target
  edges, movable nodes, and the complete locked-node set are validated before
  a canonical local layout request is written.
- Added the bounded scope order `edge_reroute -> adjacent_nodes -> one_layer
  -> connected_component`; only two automatic expansions are permitted.
- Rejected unmarked full reflow requests, and added canonical locked-cell hash
  verification. A preservation violation keeps the candidate as evidence and
  retains the accepted baseline.
- Added the Repair prompt/schema contract and made bounded no-progress finish
  via safe best effort instead of another human `continue` checkpoint.

## TDD evidence

RED:

- `test_agent_runtime.py`: Repair selected `diagram-patch.v1.schema.json`
  instead of `layout-repair-intent.v1.schema.json`.
- `test_layout_model.py`: `layout_model.SCOPE_EXPANSION_ORDER` was absent.

GREEN:

- `.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_agent_runtime.py'` — 3 passed.
- `.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_layout_model.py'` — 15 passed.
- Targeted Task 11 orchestration preservation/scope test — passed.
- `test_layout_contracts.LayoutContractTests.test_schemas_compile_and_accept_positive_documents` — passed.
- `py_compile` for the three changed scripts and `git diff --check` — passed.

The required full `test_diagram_orchestrator.py` run was started once (PID
42709) but its output was unavailable after completion. It was deliberately
not rerun; independent verification is still required.

## Concern

The improve layout-intent branch creates and persists the immutable local
layout request and terminates bounded no-progress through best effort. The
subsequent deterministic candidate worker needs end-to-end orchestration-suite
verification to confirm all Task 10 replay/receipt paths with real layout
outputs.
