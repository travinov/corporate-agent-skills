## 1. Baseline and compatibility protection

- [x] 1.1 Record the `1.23.0-corporate.13` branch, ZIP checksum, manifest, command forms, and currently passing focused test baseline without modifying the rollback artifact.
- [x] 1.2 Add characterization tests for the conversational command bridge, explicit four-role model mapping, tool-free headless flags, stream/buffered evidence parsing, and Supervisor turn-limit fallback.
- [x] 1.3 Add characterization tests proving validator receipts, patch replay, monotonic comparison, standalone roadmap/git-flow/C4 generation, installer, verifier, rollback, and ZIP parity remain compatible.
- [x] 1.4 Add a versioned contract dispatcher that reads v1 artifacts for trace/manual handoff while refusing to resume a mutable v1 checkpoint.

## 2. Versioned lifecycle and source contracts

- [x] 2.1 Add strict v2 JSON Schemas for workflow, state, checkpoint, decision, publication transaction, and implementation snapshot artifacts.
- [x] 2.2 Add strict v2 schemas for the immutable source bundle, page-scoped DiagramSpec model view, semantic plan/delta/approval, Reviewer analysis/verdict, and validation receipt bindings.
- [x] 2.3 Compile every bundled schema as Draft 2020-12 and add negative fixtures for unknown fields, path escape, invalid references, parent cycles, and cross-page endpoints.
- [x] 2.4 Implement canonical JSON hashing, atomic schema-valid snapshot writes, predecessor links, and event bindings for all v2 control-plane artifacts.
- [x] 2.5 Capture the original request, imported DiagramSpec, baseline validation, eligible review handoff, explicit user documents, decisions, assumptions, and feedback in immutable source-bundle revisions.
- [x] 2.6 Remove automatic OpenSpec discovery from runtime intake and add a regression test proving only explicitly supplied documents enter the source bundle.

## 3. Run serialization and recoverable state machine

- [x] 3.1 Implement a workspace-contained run lock with owner metadata, liveness/staleness checks, bounded recovery, and structured already-running results.
- [x] 3.2 Hold the run lock across recovery, checkpoint verification, role/tool work, decision persistence, state transition, and publication preparation.
- [x] 3.3 Add idempotent decision identifiers and tests proving duplicate or concurrent resume commands cannot apply one decision twice or overwrite another decision.
- [x] 3.4 Persist the complete v2 state machine and ensure every advertised decision maps to an executable transition.
- [x] 3.5 Preserve the last accepted candidate and create a resumable diagnostic checkpoint for role, patch schema/precondition/application/replay, validator, Reviewer, comparison, and process failures.
- [x] 3.6 Make trace use pure readers and add a test proving it never performs recovery or changes a run artifact.

## 4. Semantic reconciliation and authorization

- [x] 4.1 Validate and receipt-bind an existing artifact before Semantic Analyst or Repair runs and include that evidence in their source bundle.
- [x] 4.2 Exclude draw.io technical root/layer cells from the model-visible graph while preserving them losslessly in DiagramSpec and original XML.
- [x] 4.3 Use `(page_id, cell_id)` stable semantic identities and deterministically validate parents, endpoints, duplicate scope, page compatibility, and parent cycles.
- [x] 4.4 Normalize Semantic Analyst output into a typed semantic delta with stable add/remove/update/relationship/parent operation identities.
- [x] 4.5 Honor schema-valid `needs_human` and `requires_human` results by creating consolidated executable checkpoints instead of continuing or failing generically.
- [x] 4.6 Bind an actual human decision to the baseline semantic digest, semantic-plan hash, source-bundle hash, and delta hash; prohibit host-generated human approvals.
- [x] 4.7 Compute a deterministic patch-preview semantic diff and require it to be an exact declared subset of the approved delta before applying the patch.
- [x] 4.8 Convert non-empty resume feedback into a confirmed-clarification source revision and rerun bounded semantic reconciliation before Repair.

## 5. Role contracts, review, and bounded correction

- [x] 5.1 Implement one same-role/same-model correction attempt for output-schema or cross-field contract errors using the original input hash and JSON Pointer diagnostics.
- [x] 5.2 Prohibit correction retry for model-proof, isolation, tool-use, capability, timeout, or evidence-integrity failures and preserve both eligible attempts as evidence.
- [x] 5.3 Replace Reviewer-owned identity assertions with host-bound runtime proof and structured findings containing category, elements, evidence, severity, and remediation.
- [x] 5.4 Reject `approve` when any error-level finding remains and require exact candidate/report/receipt/source/semantic bindings at the Reviewer gate.
- [x] 5.5 Pass hash-matching review findings, report, receipt, verdict, semantic plan, approved delta, and source provenance through review-to-improve and candidate review.
- [x] 5.6 Add negative end-to-end tests for forbidden technical IDs, contradictory Reviewer verdicts, stale review handoff, feedback re-reconciliation, and Repair exceeding semantic approval.

## 6. Evidence integrity and transactional publication

- [x] 6.1 Capture hashes for the orchestration/review hosts, supervisor toolchain, role runtime, validator, prompts, schemas, routing policy, extension manifest, and version in every v2 run.
- [x] 6.2 Harden receipt verification with schema compilation, trusted-validator pinning, attempt-directory containment, timestamps, byte lengths, exit/result consistency, and unexpected-property rejection.
- [x] 6.3 Reconstruct lifecycle state from the event ledger and compare workflow/state/checkpoint/source/decision/publication snapshots with their bound event hashes.
- [x] 6.4 Return structured invalid diagnostics for malformed JSONL, events, descriptors, receipts, or missing evidence without crashing trace.
- [x] 6.5 Revalidate containment, current state, accepted artifact, report, receipt, source revision, and target revision immediately before publication.
- [x] 6.6 Implement journaled no-clobber create and compare-and-swap improve publication with staging, fsync, published-hash verification, and terminal commit after success.
- [x] 6.7 Recover interrupted publication safely and add negative tests for tampered candidates, stale targets, concurrently appearing create targets, and interruptions before/after byte publication.
- [x] 6.8 Implement truthful `approve_with_findings` only for structurally safe, integrity-valid candidates and preserve unresolved findings plus `strict_passed: false` where applicable.

## 7. Renderer adapters and generic fidelity

- [x] 7.1 Add an allowlisted local adapter registry declaring diagram type, input schema, supported modes, implementation hash, validation profile, and output artifact.
- [x] 7.2 Wrap existing roadmap, git-flow, and C4 generators and prove equivalent standalone and adapter-path normalization, output, and validation semantics.
- [x] 7.3 Route generic and specialized adapter outputs through the same candidate, receipt, Reviewer, comparison, checkpoint, trace, and publication pipeline.
- [x] 7.4 Extend the generic adapter to preserve multiple pages, containers/parents, stable IDs, labels, style hints, relationship types, loops, distinct pins, and explicit orthogonal waypoints.
- [x] 7.5 Add fixtures for a failure return loop, multi-page duplicate local IDs, nested containers, labelled branches, and crossed-route avoidance.

## 8. Command UX, documentation, and migration

- [x] 8.1 Keep short conversational create/improve/resume/trace forms and advanced flags stable while making automatic diagram/run selection deterministic and actionable when ambiguous.
- [x] 8.2 Ensure every early review/create/improve failure writes a stable structured host result and exposes existing validation evidence rather than claiming validation did not run.
- [x] 8.3 Update role prompts, command help, SKILL/README, Russian operator guide, and packaged corporate test commands for v2 checkpoints, decisions, trace, model proof, manual handoff, and rollback.
- [x] 8.4 Document that runtime does not auto-discover OpenSpec and that explicit documents are ordinary hash-bound user sources.
- [x] 8.5 Add v1 trace/manual-handoff migration output and side-by-side rollback instructions for `1.23.0-corporate.13`.

## 9. Verification and release

- [x] 9.1 Run the focused schema, supervisor, orchestrator, host, validator, adapter, installer, verifier, and release suites and resolve all regressions caused by this change.
- [x] 9.2 Run the complete locally available test suite, recording environment-only skips or dependency gaps separately from product failures.
- [x] 9.3 Update all extension/package metadata consistently to `1.24.0-corporate.1` and include the corporate one-line test guide in the ZIP.
- [x] 9.4 Build the side-by-side ZIP, checksum, and manifest; verify deterministic rebuild, archive/source parity, self-check, installer/verifier behavior, and rollback artifact preservation.
- [ ] 9.5 Perform an independent final contract and regression review, commit the verified branch, push it, and publish the exact GitHub/archive/checksum handoff.
- [x] 9.6 Provide corporate-Mac acceptance commands for create and improve loops, all four runtime model proofs, Repair iteration, human decisions, publication, trace, and rollback; record live GigaCode execution as pending until the user runs it.
