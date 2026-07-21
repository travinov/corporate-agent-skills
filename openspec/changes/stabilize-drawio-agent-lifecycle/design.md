## Context

The current extension has proven the hard runtime boundary: GigaCode 26.5.17 can invoke tool-free headless roles on four explicit models, capture stream JSON, prove model identity, retain failed attempts, run deterministic validation, replay patches, compare quality vectors, and package an offline corporate extension. The remaining failures are control-plane failures around those working primitives. In particular, v1 trusts mutable workflow paths, publishes before final verification, represents semantic approval as a loose text list, drops review and feedback context, and has crash windows that leave no resumable checkpoint.

The change is local-first and must preserve the current command bridge, role models, isolated CLI flags, validator behavior, v1 artifacts, specialized generator implementations, and `1.23.0-corporate.13` rollback package. Automatic OpenSpec discovery is explicitly outside the product: only documents deliberately supplied by the user enter the source bundle.

## Goals / Non-Goals

**Goals:**

- Make new runs safe to resume and safe to publish even when workspace files, run files, or the target change between commands.
- Make every semantic mutation traceable to an exact human decision and reject any larger or different Repair delta.
- Carry one immutable, hash-bound source bundle from intake through Semantic Analyst, Repair, Reviewer, feedback, and trace.
- Preserve the last accepted candidate across role, patch, validation, review, process, or publication failures.
- Align model-visible semantics with draw.io technical structure, page scope, parents, and stable identities.
- Make Reviewer and trace decisions internally consistent and bound to the actual runtime/configuration used by the run.
- Reuse current specialized renderers through an additive adapter registry and improve the generic renderer without rewriting proven generators.
- Keep v1 readable and recoverable through trace/manual handoff while using v2 for all new mutable workflows.

**Non-Goals:**

- Do not search a repository for OpenSpec or select an applicable specification automatically.
- Do not change the four approved primary role models or silently change the interactive model.
- Do not let model prose own XML mutation, validation, comparison, evidence verification, state transition, or publication.
- Do not rewrite roadmap, git-flow, C4, validator, installer, or command-transport implementations without a failing compatibility test.
- Do not mutate old v1 runs into v2 or promise automatic continuation of an unsafe pending v1 checkpoint.
- Do not add external SaaS, online renderers, or MCP content dependencies.

## Decisions

### Decision: New mutable runs use v2; v1 is read-only compatibility

New create, improve, review, resume, and trace workflows write v2 control-plane artifacts. V2 adds explicit schemas for workflow, state, checkpoint, decision, source bundle, semantic plan/delta, reviewer analysis/verdict, validation receipt binding, implementation snapshot, and publication transaction. A compatibility reader can verify and display v1 runs and export their accepted artifact for manual handoff, but v1 pending runs are not automatically resumed.

This is safer than modifying permissive v1 schemas in place and prevents a new host from trusting old mutable paths as if they had v2 containment and evidence guarantees.

### Decision: The event ledger is the lifecycle source of truth

Every workflow/state snapshot is written atomically and bound to a manifest event by path, SHA-256, schema version, prior snapshot hash, and transaction ID. Trace reconstructs the current state from the immutable event sequence and compares the reconstructed result with the latest snapshots. Trace uses pure readers and never invokes transaction recovery. Resume performs recovery under the run lock before reading a checkpoint.

The ledger remains locally rewriteable by an administrator; the guarantee is internal consistency and tamper detection inside the declared local trust boundary, not external cryptographic attestation.

### Decision: Validate containment and evidence before publication

All control-plane paths are normalized and checked against explicit roots. Source and target must be inside the workspace; accepted candidates, reports, receipts, patches, decisions, and checkpoints must be inside the run directory. The accepted artifact and validation evidence are rehashed and schema-validated immediately before publication. Improve additionally compares the current target hash with its captured source revision. A mismatch creates a consolidated conflict checkpoint.

Publication uses a journal: verified intent and expected hashes are recorded first, bytes are staged and fsynced, a no-clobber create or compare-and-swap improve is performed, the published hash is verified, and only then is the terminal event committed. Recovery can classify an interrupted transaction without repeating an unsafe overwrite.

### Decision: Semantic authorization is a typed delta, never a host assertion

Semantic Analyst v2 returns a strict analysis-only page-scoped graph, assumptions,
and human questions. It does not own evidence hashes or deterministic operation
identities. The host binds the actual source bundle and baseline, then normalizes
the analysis into `semantic-plan.v2` with a typed `semantic_delta` containing
stable operation identities for additions, removals, updates, and
relationship/parent changes. A human decision binds the delta hash, baseline
semantic digest, source-bundle hash, and semantic-plan hash. Repair receives this
immutable authorization.

The deterministic patch preview computes the candidate semantic diff before acceptance. The diff must be exactly represented by, or a declared subset of, the approved typed delta. A patch outside the authorization creates a new semantic checkpoint. The host never writes `approver: user` except while serializing the actual decision supplied to resume.

### Decision: One immutable source bundle crosses every role boundary

The source bundle contains the original request, imported DiagramSpec, baseline validation, eligible review handoff findings and hashes, explicit user-supplied documents, assumptions, decisions, and subsequent feedback records. It does not contain automatically discovered OpenSpec material. Every version has a canonical hash and links to its predecessor.

Improve validates the imported artifact before semantic reconciliation, so actionable validator evidence is available to Supervisor and Repair even if Semantic Analyst fails. Non-empty resume feedback creates a `confirmed_clarification` source record and causes a bounded Semantic Analyst reconciliation before another semantic or repair step.

### Decision: Technical cells remain preserved but are not model nodes

DiagramSpec continues to preserve root/layer cells, unknown attributes, styles, pages, and original XML. A separate model view excludes technical root cells such as `0` and `1`, uses `(page_id, cell_id)` stable identities, and retains parent, source, and target references. Cross-field validation rejects dangling parents, cross-page endpoints, duplicate scoped identities, and parent cycles.

### Decision: Contract correction is bounded and evidence preserving

If a model-proven, isolated, tool-free role response fails only its output schema or deterministic cross-field validation, the same configured role/model may run once more with the original input hash and a structured list of JSON Pointer errors. Both attempts are recorded. Capability, isolation, tool-use, model-proof, timeout, and integrity failures remain ineligible. A second contract failure becomes a human/recovery checkpoint rather than an unbounded retry.

### Decision: Reviewer identity and verdict consistency are host enforced

Reviewer returns analytical findings only. The host binds the final verdict to role input/output hashes, candidate/report/receipt hashes, and verified runtime model proof. `approve` is invalid when any error-level finding remains. Findings use a strict category/elements/evidence/remediation contract so Repair can consume them without prose scraping.

### Decision: Existing renderers are adapters, not rewrite targets

An adapter registry maps an allowlisted diagram type to the current roadmap, git-flow, C4, or generic implementation. Each adapter declares its input schema, supported modes, output artifact, validation profile, and source model. All adapters feed the same candidate, receipt, Reviewer, comparison, checkpoint, and trace pipeline. Generic rendering gains pages, containers, style hints, loop routing, distinct pins, labels, and explicit waypoints incrementally behind characterization tests.

### Decision: Working behavior is protected before refactoring

The current command forms, safe Qwen argument bridge, headless command flags, model mapping, stream/buffered evidence parsing, Supervisor turn-limit fallback, validator receipts, patch replay, monotonic comparison, specialized generator determinism, installer, verifier, rollback, and ZIP parity receive characterization tests before their owning modules are edited. Each implementation cluster must leave that baseline green.

## Risks / Trade-offs

- **[V2 increases schema and compatibility code]** -> Keep v1 readers isolated, use one schema dispatcher, and delete no v1 artifacts or fixtures.
- **[Old pending runs cannot automatically continue]** -> Provide trace plus manual handoff and explain the safety boundary in migration output.
- **[Strict containment rejects prior out-of-workspace targets]** -> Keep the documented workspace-first command contract and return an actionable selection/copy instruction.
- **[Compare-and-swap interrupts a user who edited the diagram manually]** -> Preserve both files and create a conflict checkpoint; never choose one silently.
- **[A second Semantic Analyst call costs tokens]** -> Invoke it only for new feedback/source revisions and cap correction/reconciliation attempts.
- **[Typed semantic deltas are more demanding for models]** -> Include the exact schema, filter technical cells, provide JSON Pointer correction once, and retain a human checkpoint fallback.
- **[Adapter integration could regress standalone generators]** -> Wrap existing commands and assert byte-identical output before changing their implementations.
- **[Implementation snapshot hashes make upgrades visible]** -> Trace evaluates a run against its captured snapshot, while the installed verifier separately evaluates the current extension.
- **[Run locking can leave stale locks]** -> Use owner metadata, atomic creation, liveness checks, bounded recovery, and immutable recovery events.

## Migration Plan

1. Record the `1.23.0-corporate.13` regression baseline and preserve its ZIP/checksum/manifest.
2. Add v2 schemas, compatibility dispatch, and v1 trace/manual-handoff behavior without switching command defaults.
3. Add v2 source bundle, run lock, lifecycle transactions, semantic approval, evidence snapshot, and negative tests.
4. Switch new runs to v2 after the full local characterization and negative suites pass.
5. Add adapter registry and generic improvements behind parity tests.
6. Update prompts, commands, Russian operator guide, installer/verifier expectations, metadata, and release allowlist.
7. Build `1.24.0-corporate.1` side by side; verify checksum, manifest parity, self-check, and rollback instructions.
8. On the corporate Mac, install the new ZIP, run full create and improve workflows, verify four model proofs, repair iteration, human decisions, publication, and trace.
9. Roll back by reinstalling `1.23.0-corporate.13` if the corporate runtime exposes an incompatible capability or the acceptance workflows fail.

## Open Questions

No product decisions remain. Corporate GigaCode execution is still required for final acceptance because the development Mac has no GigaCode CLI.
