# Draw.io Deterministic Layout Engine Design

- **Date:** 2026-07-23
- **Status:** Approved design
- **Target release:** `1.25.0-corporate.1`
- **Scope:** `publish-drawio-skill`

## 1. Summary

The extension will keep its existing multi-agent lifecycle and add a host-owned,
deterministic layout subsystem between `semantic-plan.v2` and draw.io XML
generation.

The new subsystem will:

- determine and freeze the diagram type before a run starts;
- ask the user only for blocking semantic information that is missing;
- use vendored ELK Layered through the verified GigaCode → Python → Node path;
- use a built-in Python layout and routing backend as a mandatory fallback;
- support both diagram creation and local improvement in the first release;
- keep specialized layout engines for sequence, roadmap, and git-flow diagrams;
- detect shared edge segments, congested routes, label collisions, excessive
  detours, and other readability failures the current validator misses;
- accept only monotonic improvements;
- automatically publish a separate safe best-effort artifact when strict
  success cannot be reached.

The models define semantics and bounded repair intent. Deterministic tools own
coordinates, ports, waypoints, validation, candidate comparison, evidence, and
publication.

## 2. Problem Statement

The current generic v2 renderer uses a simple deterministic fallback:

- in top-to-bottom mode, root nodes are placed at one fixed x-coordinate;
- nested children are also aligned at a fixed relative x-coordinate;
- missing routes are generated through a source/target midpoint.

This can produce a long single-column diagram in which many edges share one
vertical trunk. The existing validator detects proper edge crossings and
edge-through-node routes, but intentionally excludes collinear overlap from the
crossing predicate. A diagram can therefore pass strict validation while
several unrelated edges overlap for long distances.

Prompt tuning alone cannot close this gap. Models may improve average output,
but they cannot provide deterministic guarantees for global node placement,
port allocation, obstacle avoidance, shared-channel separation, or monotonic
candidate selection.

## 3. Goals

1. Produce readable graph-oriented diagrams with deterministic node placement
   and explicit orthogonal waypoints.
2. Support both `/drawio:create` and local `/drawio:improve` in the first
   release.
3. Preserve existing content outside the approved improvement scope.
4. Avoid repeated user prompts for layout-only problems.
5. Ensure every completed run returns either a strict result or a separate
   safe best-effort artifact.
6. Keep lifecycle v2, model routing, isolated roles, validation receipts,
   trace integrity, resume, and no-clobber publication intact.
7. Run without network access or runtime package installation.

## 4. Non-Goals

- Replacing the multi-agent architecture.
- Adding a fifth layout agent.
- Replacing specialized sequence, roadmap, or git-flow layout semantics with a
  generic graph layout.
- Allowing models to author arbitrary coordinates or waypoints for normal
  creation.
- Reintroducing runtime discovery of user OpenSpec documents.
- Automatically applying a full reflow to an existing diagram without an
  explicit user request.
- Running ELK as a persistent local service or daemon.

## 5. Architecture

The existing roles and lifecycle remain the control plane:

- Supervisor selects an allowlisted action and strategy.
- Semantic Analyst performs intake and produces the semantic plan.
- Repair proposes a bounded repair intent.
- Reviewer independently evaluates semantic and quality evidence.
- The lifecycle host persists state, evidence, decisions, recovery, and
  publication.

The new deterministic data path is:

```text
semantic-plan.v2
        |
        v
LayoutIR Builder
        |
        v
Layout Policy
        |
        v
Backend Router
   +----+----------------+
   |                     |
   v                     v
ELK Layered       Python fallback
   +----------+----------+
              |
              v
      layout-result.v1
              |
              v
      Draw.io XML Renderer
              |
              v
       Strict Validator
```

The layout backends are pure functions at the architectural boundary: they
receive one validated JSON request and return one validated JSON result. They
have no access to lifecycle state, model configuration, or publication.

## 6. Diagram Type Intake

Diagram type is determined before a full run is created.

### 6.1 Explicit type

If the user explicitly requests a sequence, C4, roadmap, git-flow, BPMN, ER, or
other supported type, the type is accepted without a confirmation prompt.

### 6.2 Existing diagram

For improvement, type detection uses:

- existing adapter and run evidence;
- diagram metadata and schema version;
- semantic types;
- pages, containers, lanes, and lifelines;
- structural characteristics of the source artifact.

The existing type is preserved. A specialized artifact is not silently
converted to generic.

### 6.3 Inferred type

When the user does not specify a type, the Semantic Analyst classifies the
request against a host allowlist:

```text
flowchart, bpmn, c4, er, dependency,
sequence, roadmap, git-flow, generic
```

An unambiguous classification proceeds automatically. An ambiguous
classification is presented through GigaCode's native `ask_user` selection UI.
Headless execution receives the same stable choices as an `awaiting_input`
response. The user never needs to enter a run id or repeat the original
request.

The selected type, source, confidence, adapter, backend, and quality profile are
frozen in workflow state.

Changing the type after the run starts is a semantic representation change. It
requires an explicit semantic checkpoint and a new layout lineage; it never
rewrites the previous lineage in place.

## 7. Semantic Completeness Intake

The same Semantic Analyst supports `phase=intake`; no additional agent is
introduced.

It returns:

- inferred diagram type and confidence;
- whether the description is sufficient;
- blocking semantic questions;
- non-blocking assumptions.

A question is blocking only when the answer changes nodes, relationships,
conditions, participants, process boundaries, return targets, or chronological
order. Formatting, colors, orientation preferences, and other non-semantic
details become recorded assumptions instead of questions.

Rules:

- questions are shown sequentially through `ask_user`;
- no more than three blocking questions are asked;
- each question includes a reason and recommended answer;
- the user may choose an option, provide free text, or explicitly accept the
  recommended assumption;
- one completeness check runs after the answers;
- answers become binding source requirements;
- assumptions appear in the final summary without requiring confirmation;
- a full `.diagram-runs/<run-id>` is created only after intake completes.

If the completeness check still finds a blocking ambiguity after the three
question limit, the intake stays `awaiting_input` and presents one consolidated
free-text request. It may proceed without another answer only when every
remaining gap has a host-approved recommended assumption that the user
explicitly accepts.

## 8. Adapter and Backend Policy

ELK Layered is used for graph-oriented diagrams:

- generic and flowchart;
- C4 and architecture;
- BPMN-like processes;
- ER and dependency graphs;
- network and service topology.

Specialized adapters retain their domain layout:

- `sequence-local` preserves participants, lifelines, and chronological order;
- `roadmap-local` preserves calendar/time-axis placement;
- `git-flow-local` preserves branch lanes and commit chronology.

All adapters use the common validator and evidence model.

Vendored `elkjs` is the primary graph-layout backend. The corporate runtime has
verified Node.js `v22.16.0`, npm `10.9.2`, and successful Python-to-Node process
execution. Runtime execution does not use npm and does not access the network.

The built-in Python backend is mandatory. It provides deterministic layered
placement and orthogonal routing when Node or ELK is unavailable or returns an
invalid result.

## 9. Layout Contracts

### 9.1 Public semantic boundary

`semantic-plan.v2` remains unchanged in the first release. Routes stay optional.
For normal creation, the Semantic Analyst omits generated routes. Existing or
explicitly user-locked routes may be preserved.

### 9.2 `layout-request.v1`

The host-generated request contains:

- run, page, and semantic-plan bindings;
- diagram type and direction;
- mode: `create`, `preserve`, `local_reflow`, or `full_reflow`;
- node identities, measured sizes, parents, and containers;
- edge identities, endpoints, relationships, and label sizes;
- hard and soft constraints;
- locked nodes and routes;
- permitted movement and reroute scope;
- backend and strategy identifiers;
- quality profile version.

### 9.3 `layout-result.v1`

The backend result contains:

- exact node bounds;
- assigned source and target ports;
- explicit orthogonal waypoints;
- edge-label bounds;
- edge classification: main, branch, feedback, or self-loop;
- channel reservations;
- backend id, version, and effective options;
- layout metrics;
- input request digest.

Both contracts use strict JSON Schema and canonical JSON hashing.

## 10. Creation Flow

1. Complete type and semantic intake.
2. Produce and validate `semantic-plan.v2`.
3. Build and hash `layout-request.v1`.
4. Invoke ELK with pinned options and a bounded timeout.
5. Validate and normalize `layout-result.v1`.
6. Snap geometry to the 10 px grid, remove duplicate or collinear waypoints,
   and verify every route is Manhattan-orthogonal.
7. Render draw.io XML without inventing additional geometry.
8. Run strict validation and create a validation receipt.
9. Run the independent Reviewer when validator gates permit it.
10. Publish on strict approval, or continue through the bounded strategy list.

All layout variants use the same semantic plan.

## 11. Improvement Flow

Improvement defaults to `preserve` mode:

- coordinates, sizes, styles, containers, and manual routes outside the repair
  scope are locked;
- the validator identifies affected edges and regions;
- ELK receives the local subgraph plus surrounding obstacles;
- only affected routes and the minimum required nodes may change;
- untouched cells are verified by hash.

If local repair lacks space, scope expands deterministically:

```text
edge reroute
-> adjacent nodes
-> one layer
-> connected component
```

Full reflow is allowed only when the user requests it explicitly. A full-reflow
candidate is still compared against the baseline and cannot silently overwrite
the source.

## 12. Deterministic Layout Strategy

The layout pipeline performs:

1. Stable normalization by page and cell identity.
2. Strongly connected component detection and deterministic feedback-edge
   selection.
3. Layer assignment.
4. Stable barycenter/median crossing-minimization sweeps.
5. Grid-based coordinate assignment with container-aware spacing.
6. Degree-aware port allocation.
7. Obstacle-aware orthogonal routing.
8. External-channel routing for feedback edges and self-loops.
9. Shared-segment nudging.
10. Edge-label placement and reservation.
11. Route canonicalization and metrics.

The Python fallback implements the same contract and a bounded subset of these
strategies. It is not required to reimplement every ELK optimization, but it
must satisfy structural, orthogonality, preservation, and evidence guarantees.

## 13. Validation and Quality Profile v2

The validator remains backend-independent and validates the final draw.io XML.

New stable findings:

- `artifact.readability.shared_segment`;
- `artifact.readability.route_congestion`;
- `artifact.readability.edge_label_collision`;
- `artifact.readability.port_congestion`;
- `artifact.layout.excessive_detour`;
- `artifact.layout.excessive_bends`;
- `artifact.layout.feedback_intrusion`;
- `artifact.layout.aspect_ratio`.

Existing structural, overlap, route-through, crossing, container, text,
terminal-segment, and routing-uncertainty checks remain.

Host-owned exemptions cover:

- short fan-out near a common endpoint;
- self-loops;
- parallel edges between the same elements;
- explicit bus/trunk route groups;
- permitted container transitions;
- user-locked manual routes.

Models cannot declare exemptions.

A user lock prevents automatic movement; it does not suppress validation. A
locked route that crosses a node or violates structural rules remains visible
as a finding and can force a best-effort rather than strict result.

Candidate comparison is lexicographic:

```text
semantic violations
structural errors
node and container overlap
route-through
edge-label collisions
shared-path congestion
proper crossings
port congestion
routing uncertainty
excessive detours
excessive bends
total route length
canvas penalty
```

A higher-priority regression rejects a candidate even when a lower-priority
metric improves. The baseline advances only on a real monotonic improvement.
Failed candidates remain evidence but never become the next baseline.

The quality profile is frozen per run. Existing runs without v2 continue to use
the legacy profile.

## 14. Agent Responsibilities

### Supervisor

May choose only host-allowlisted actions:

- create layout;
- reroute edges;
- expand local scope;
- retry with strategy;
- request semantic clarification;
- finish best effort.

It does not return coordinates or waypoints.

### Semantic Analyst

Owns intake, nodes, relationships, conditions, loops, containers, and explicit
assumptions. It does not generate normal layout geometry.

### Repair

Returns a bounded repair intent containing target edges, movable nodes, locked
elements, and reason. The host validates scope; the layout backend computes the
geometry. Legacy exact-waypoint patches remain available only for compatibility
and explicit manual edits.

### Reviewer

Receives semantic and layout diffs, quality vectors, validation receipts,
congestion metrics, backend proof, and changed/locked element sets. It cannot
approve against blocking validator findings.

## 15. Failure Handling and Bounded Automation

The Python host records:

- absolute Node executable;
- pinned elkjs version;
- timeout and exit code;
- stdout and stderr;
- input and output digests;
- schema-validation outcome;
- completeness and numeric-safety checks.

On ELK failure, the same immutable layout request is sent to Python fallback.
The semantic plan and repair scope are not regenerated.

The finite automatic strategy sequence is:

```text
ELK default
-> increased spacing
-> stronger port separation
-> stronger shared-path penalty
-> bounded local scope expansion
-> Python fallback
```

Limits:

- no more than three layout variants for one scope;
- no more than two local scope expansions;
- one fallback attempt;
- a total wall-clock budget;
- no repeated strategy with identical inputs and options.

Strict success publishes the primary result. When strict success is not
possible, the system automatically publishes a separate safe best-effort file,
preserves the original, and reports remaining findings.

Human checkpoints are limited to semantic ambiguity, publication conflicts, or
an explicit user request. The latest safe artifact is already saved before a
user can stop further work.

## 16. Trace and User Experience

`/drawio:trace` exposes:

- intake classification, questions, answers, and assumptions;
- models resolved for every role;
- semantic-plan and LayoutIR digests;
- backend id, version, executable proof, and options;
- strategy attempts;
- validation receipts and quality comparisons;
- Reviewer verdict;
- published artifact digest.

User-facing commands remain short:

```text
/drawio:create "Создай процесс..."
/drawio:improve
```

The final response includes diagram type, strict or best-effort status, output
path, changed regions, remaining findings, assumptions, and the ability to
continue later without manually finding a run id.

## 17. Testing

### Unit tests

- cycle and feedback-edge handling;
- layer assignment and stable ordering;
- port allocation for fan-in and fan-out;
- obstacle-aware orthogonal routing;
- self-loops and feedback paths;
- shared-segment nudging;
- label placement;
- nested containers and lanes;
- locked nodes and local scope;
- deterministic output.

### Validator fixtures

- full and partial collinear overlap;
- allowed short fan-out;
- a six-edge shared trunk;
- intentional bus;
- label-node and label-label collisions;
- excessive detour and bends;
- internal and external feedback routing;
- extreme aspect ratio;
- multi-page and nested containers.

### Integration corpus

- linear process;
- two- and three-way decisions;
- return loop;
- order processing;
- C4;
- microservice architecture;
- ER/dependency graph;
- lane-based BPMN-like process;
- single-edge local improvement;
- local node movement;
- ELK failure with Python fallback;
- strict failure with best-effort publication.

The known shared `x=350` diagram becomes a mandatory regression fixture.

Repeated corpus runs must produce identical LayoutIR, layout result, draw.io,
quality vector, and trace ordering.

## 18. Compatibility and Release

- Keep `semantic-plan.v2`.
- Preserve specialized adapter behavior.
- Keep old runs readable and their quality profiles fixed.
- Preserve lifecycle v2, model routing, receipts, resume, recovery, and
  no-clobber publication.
- Retain the legacy generic renderer temporarily as an explicit rollback
  backend.
- Bundle elkjs and its license in the offline ZIP.
- Do not run npm or use the network during installation or execution.

Release gates:

- complete unit and integration suites;
- deterministic release build and manifest verification;
- fallback self-check without ELK;
- corporate smoke with Node.js `v22.16.0`;
- PNG export of representative fixtures;
- manual review of ten release-corpus diagrams;
- new branch, commit, ZIP, SHA256, installation instructions, and rollback
  instructions.

## 19. Acceptance Criteria

1. Both creation and local improvement complete without repeated user
   continuation prompts.
2. Blocking intake questions are limited to semantic or topological ambiguity.
3. Generated routes are explicit and orthogonal.
4. Required fixtures have no node overlap, route-through, unintended long
   shared segments, route congestion, proper crossings, or label collisions.
5. Feedback loops are routed outside the primary flow.
6. Layout-only improvement preserves semantic digest and untouched cell hashes.
7. Repeated identical runs are byte-for-byte deterministic.
8. Trace proves model roles, backend selection, attempts, validation, review,
   and publication.
9. A strict result is published when available.
10. Otherwise, a separate safe best-effort artifact is published automatically
    without overwriting the source.

## 20. Approved Decisions

- First release includes both create and improve.
- ELK is the primary graph-layout backend.
- Python is the mandatory fallback.
- ELK applies to graph-oriented types; sequence, roadmap, and git-flow retain
  specialized engines.
- Type is inferred automatically and confirmed only when ambiguous.
- Intake asks only blocking semantic questions.
- Improvement is local by default; full reflow requires an explicit request.
- Best-effort output is automatically published as a separate file.
- The architecture uses a separate LayoutIR subsystem rather than embedding
  ELK directly in the orchestrator or running a persistent service.
