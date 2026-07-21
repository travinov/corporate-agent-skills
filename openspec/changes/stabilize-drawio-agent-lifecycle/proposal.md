## Why

The `1.23.0-corporate.13` extension proves that GigaCode can run isolated, model-specific diagram roles and preserve validation and runtime evidence, but the end-to-end lifecycle is not yet safe to publish: semantic approval can drift from the user's decision, mutable run files are trusted before publication, several repair failures are not resumable, and source/review context is lost between commands. This change stabilizes those contracts without replacing the working command bridge, model isolation, deterministic validation, patch replay, specialized generators, installer, or rollback path.

## What Changes

- **BREAKING** Introduce versioned v2 workflow, state, checkpoint, source-bundle, semantic-plan, reviewer, and evidence contracts for new runs; retain v1 artifacts for read-only trace and manual handoff instead of rewriting them in place.
- Remove automatic OpenSpec discovery, selection, and conflict handling from the product contract. A document explicitly supplied by the user remains an ordinary hash-bound user source.
- Validate every resumable control-plane artifact, constrain its paths to the workspace/run, serialize decisions per run, and revalidate accepted evidence before transactional publication.
- Bind human semantic approval to the exact proposed semantic delta and reject Repair patches whose computed delta exceeds that approval; never manufacture a human approval in the host.
- Preserve the last accepted candidate and create a resumable checkpoint after role, patch, validation, review, or process-interruption failures.
- Carry one immutable source bundle through review, improve, feedback, semantic reconciliation, Repair, Reviewer, and trace; rerun semantic reconciliation after new feedback.
- Separate technical draw.io cells from model-visible semantics, add page-scoped identities and parent/reference checks, and allow one bounded contract-correction retry with preserved evidence.
- Reject contradictory Reviewer decisions, bind verdict provenance to runtime proof, and provide the complete approved semantic and source context to independent review.
- Bind workflow/state and the runtime code, prompts, schemas, validator, and routing-policy snapshot into traceable evidence; make trace strictly read-only and diagnostic on malformed evidence.
- Add an adapter registry that reuses the existing roadmap, git-flow, C4, and generic renderers under the common validation/review lifecycle while extending the generic renderer to preserve pages, containers, style hints, loops, pins, and explicit waypoints.
- Keep conversational commands and advanced flags stable, add honest `approve_with_findings` and recovery UX, and publish a side-by-side `1.24.0-corporate.1` archive with rollback to `1.23.0-corporate.13`.

## Capabilities

### New Capabilities

- `diagram-workflow-integrity`: Versioned control-plane validation, path containment, run serialization, idempotent decisions, pre-publication revalidation, compare-and-swap, crash recovery, and v1 compatibility boundaries.
- `diagram-renderer-adapters`: Deterministic adapter selection and a shared evidence lifecycle for generic, roadmap, git-flow, C4, and supported future local renderers.

### Modified Capabilities

- `diagram-working-model`: Replace automatic OpenSpec discovery with explicit user-supplied sources, add an immutable source bundle, exclude technical cells from model semantics, and preserve page-scoped identities and parent relationships.
- `diagram-human-review`: Bind semantic approval to the exact delta, reconcile new feedback, make every advertised checkpoint resumable, and constrain `approve_with_findings` to structurally safe artifacts with explicit unresolved findings.
- `diagram-supervisor-orchestration`: Honor `needs_human`, validate before Repair where an artifact exists, recover every expected failure to a checkpoint, and continue only from the last accepted candidate under a run lock.
- `diagram-transactional-repair`: Enforce patch-to-approval binding, preserve the baseline on application/validation failures, and route all generated candidates through the same monotonic review gate.
- `diagram-run-evidence`: Bind mutable workflow/state and runtime implementation snapshots to the ledger, validate receipts against the trusted validator, and make trace read-only and tolerant of malformed evidence.
- `diagram-model-routing`: Preserve the approved per-role models and isolation controls while adding one evidence-preserving contract-correction retry and binding Reviewer identity to verified runtime proof.

## Impact

- Primary implementation: `publish-drawio-skill/scripts/diagram_orchestrator.py`, `diagram_supervisor.py`, `agent_runtime.py`, `diagram_host.py`, and `command_ux.py`.
- Contracts: new v2 JSON Schemas and compatibility readers under `publish-drawio-skill/data/`; existing v1 schemas and artifacts remain available.
- Role prompts: Supervisor, Semantic Analyst, Repair, and Reviewer contracts are updated without changing their model assignments or tool-free isolation.
- Rendering: existing specialized generator modules are wrapped, not rewritten; the generic renderer gains additive semantic/layout support.
- Verification: characterization tests first, then negative lifecycle/security tests, complete local suites, deterministic release checks, and corporate multi-model create/improve smoke tests.
- Release: new side-by-side branch and `1.24.0-corporate.1` ZIP/checksum/manifest/operator guide; `1.23.0-corporate.13` remains the rollback artifact.
