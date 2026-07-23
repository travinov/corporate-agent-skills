## Why

Corporate acceptance exposed two failure modes that prevent a usable result: Repair can initialize on MiniMax but time out without producing a patch, and a resumed run can commit `continue` before rejecting an invalid Supervisor action, leaving the checkpoint replayed but not advanced. The workflow must remain evidence-driven while still returning the best structurally safe diagram when strict perfection cannot be reached.

## What Changes

- Add a bounded Repair runtime fallback from `vllm/MiniMax-M3-113k` to `vllm/Qwen3.6-35B-262k` for verified timeout, turn-limit, unavailable-model, and empty-response failures, while keeping Reviewer on DeepSeek.
- Compact the Repair role input into a hash-bound, non-duplicated evidence envelope so large validation reports are represented once and the model receives only actionable findings and scope.
- Make resume decisions transactionally recoverable: validate/normalize the Supervisor resume plan before consuming the checkpoint, and continue an interrupted decision replay instead of returning a stale host result.
- Normalize a resumed create run with an accepted baseline to deterministic repair/review execution even if the Supervisor repeats `action: create`.
- Add automatic best-effort delivery after bounded retries are exhausted. A create run publishes the best structurally safe candidate with explicit findings; an improve run preserves the source when no safe monotonic improvement exists and returns the source as the final retained result.
- Keep fail-closed behavior for malformed XML, structural/integrity failures, publication conflicts, semantic changes without approval, or unverified model/evidence bindings.
- Record fallback, recovery, best-effort selection, remaining findings, and strict-validation status in both manifests and the user-visible host result.

## Capabilities

### New Capabilities
- `diagram-best-effort-delivery`: Select and expose the best structurally safe artifact after bounded autonomous work without claiming strict success.

### Modified Capabilities
- `diagram-model-routing`: Permit an explicitly configured, evidence-verified Repair fallback to Qwen for bounded runtime failures.
- `diagram-supervisor-orchestration`: Make resume decisions recoverable and normalize invalid resume actions without losing the accepted baseline.
- `diagram-transactional-repair`: Use a compact hash-bound Repair envelope and preserve monotonic candidate selection across fallback attempts.
- `diagram-human-review`: Avoid mandatory checkpoints for layout-only exhaustion when a safe best-effort result can be returned, while retaining human control for semantic or unsafe cases.
- `diagram-run-evidence`: Record interrupted decision recovery and best-effort/fallback evidence end to end.

## Impact

- Primary code: `publish-drawio-skill/scripts/agent_runtime.py`, `diagram_orchestrator.py`, lifecycle/state helpers, model routing policy, agent prompts, and command documentation.
- Tests: orchestration, runtime fallback, lifecycle replay, trace verification, packaging, installer, and corporate command scenarios.
- Release: new backward-compatible `1.24.0-corporate.5` ZIP on a separate branch; previous `.4` remains installable.
- Runtime OpenSpec discovery remains excluded; this change affects development contracts only.
