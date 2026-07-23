## Context

The `.4` runtime already owns deterministic state, validation, patch application, comparison, publication, and evidence. A corporate create run proved that MiniMax may emit only `system.init` and then time out twice, after which the host pauses with a structurally valid but readability-failing baseline. The same run also proved that `commit_decision()` currently precedes validation of the resumed Supervisor plan: `continue` was committed, the Supervisor returned an invalid repeated `action: create`, and replay returned stale state instead of completing the transaction.

The user wants autonomous improvement but also a usable result when model-driven repair cannot reach strict success. Existing strict `completed` semantics and no-clobber safeguards must remain unchanged.

## Goals / Non-Goals

**Goals:**

- Recover interrupted resume decisions idempotently.
- Fall back from Repair MiniMax to Qwen after verified bounded runtime failure.
- Reduce Repair prompt size without weakening hash/evidence bindings.
- Automatically expose or publish the best structurally safe artifact after bounded retries.
- Preserve exact evidence that distinguishes strict success from degraded delivery.

**Non-Goals:**

- Publishing malformed, structurally invalid, semantically unauthorized, or evidence-mismatched diagrams.
- Silently overwriting a changed destination.
- Treating best-effort delivery as strict validation success or human approval.
- Reintroducing repository OpenSpec discovery into the diagram runtime.
- Unbounded model retries or fallback chains.

## Decisions

### 1. Use an explicit Repair-only fallback

The routing policy declares one fallback for Repair: MiniMax to Qwen on `timeout`, `turn_limit`, `model_unavailable`, or `empty_response`. The fallback is executed once with the same immutable input hash. The primary failure is non-terminal only when runtime isolation proves that the primary process initialized on the requested model; the fallback must independently prove Qwen in both system and assistant events before its result is accepted.

DeepSeek remains Reviewer so fallback Repair output is still independently reviewed by another model. Alternative: inherit the interactive default. Rejected because the selected model is mutable and cannot be audited reliably.

### 2. Build a compact Repair evidence envelope

The Repair input contains one DiagramSpec, one actionable finding collection, one v2 receipt descriptor/content, optional bound Reviewer verdict, host scope, machine feedback, and hashes for the source bundle and validation report. It does not embed the same full validation report in `baseline`, `review_evidence`, and `previous_findings` simultaneously. The original reports remain immutable on disk and hash-bound in the input.

Alternative: merely increase the timeout. Rejected because it preserves duplicated context and turns every stalled attempt into a long user wait.

### 3. Treat resume as a recoverable transaction

The host obtains and validates a resume plan before clearing the checkpoint. `consume_supervisor_decision()` normalizes repeated `action: create` to deterministic repair/review when an accepted artifact exists, while still rejecting unsupported actions. The committed v2 decision gains a durable processing marker in workflow evidence. If a crash occurs after `decision_committed`, replay detects that the corresponding legacy decision/checkpoint transition is incomplete and resumes processing instead of returning stale `host-result.json`.

Alternative: ask the user to change feedback and create another decision ID. Rejected because it duplicates human intent and does not repair state consistency.

### 4. Separate strict publication from best-effort delivery

Strict `completed` remains gated by a passing receipt and Reviewer approval. A new `best_effort_completed` terminal status is available only after iteration/fallback exhaustion. The host classifies an artifact as structurally safe from parse success, hash-bound receipt/report evidence, absence of structural/integrity findings, and approved/no semantic drift. Readability/layout findings may remain.

For create, the safe artifact is atomically published to the unused target. For improve, a monotonic accepted working candidate may be atomically published if the source hash is unchanged; otherwise the unchanged source is returned as the retained final result. Publication conflict never overwrites data: the run-local safe artifact is returned with conflict evidence.

### 5. Keep retry policy bounded and outcome-oriented

One primary Repair call plus one runtime fallback is one orchestration iteration. Repeated deterministic patch failures continue through the existing bounded loop. On exhaustion, the host attempts a read-only Reviewer audit when practical, records whether review completed, selects the best safe artifact, and returns it without requiring another `continue` for layout-only findings.

## Risks / Trade-offs

- **[Risk] Qwen fallback repeats Semantic Analyst model** → Record `model_diversity_degraded: true`; retain DeepSeek Reviewer independence.
- **[Risk] Non-structural error severity is mistaken for unsafe structure** → Use explicit structural/integrity code and remediation classifiers, not severity alone; test route/crossing errors as deliverable and malformed/dangling cases as blocked.
- **[Risk] Resume replay applies a decision twice** → Bind recovery to decision ID, checkpoint hash, state hash, and a single durable processed marker.
- **[Risk] Compact input omits useful detail** → Keep full evidence on disk, include stable finding IDs/geometry/action scope, and bind omitted documents by SHA-256.
- **[Risk] Best-effort output is mistaken for success** → Use a distinct terminal status, `strict_passed: false`, `best_effort: true`, remaining findings, and explicit publication disposition.

## Migration Plan

1. Release as `1.24.0-corporate.5` on a new branch and keep `.4` installable.
2. Existing healthy runs continue unchanged.
3. Existing partially committed runs are recoverable when their checkpoint, decision, state, and artifact bindings validate; otherwise they remain fail-closed with a manual-handoff path.
4. Installer backup/rollback restores the previous extension version.

## Open Questions

None. The runtime default is autonomous best-effort delivery for layout-only exhaustion; semantic and integrity checkpoints remain human-gated.
