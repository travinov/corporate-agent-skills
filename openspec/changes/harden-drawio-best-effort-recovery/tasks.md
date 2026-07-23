## 1. Runtime routing and Repair input

- [x] 1.1 Add the policy-declared MiniMax-to-Qwen Repair fallback for verified timeout, turn-limit, model-unavailable, and empty-response failures.
- [x] 1.2 Preserve identical Repair input hashes across primary/fallback attempts and emit linked failure/model-proof evidence.
- [x] 1.3 Replace duplicated Repair documents with a compact hash-bound evidence envelope and update the Repair prompt contract.

## 2. Resume transaction recovery

- [x] 2.1 Normalize a resumed create action to repair/review when an accepted artifact already exists.
- [x] 2.2 Validate the resume plan without consuming the checkpoint on contract failure.
- [x] 2.3 Recover a committed-but-unprocessed decision idempotently and mark successful decision processing durably.

## 3. Best-effort delivery

- [x] 3.1 Implement a deterministic structural-safety classifier using hash-bound report and receipt evidence.
- [x] 3.2 Track the best safe monotonic artifact independently from strict publishability.
- [x] 3.3 On bounded layout-only exhaustion, run a bounded read-only review where possible and finish as `best_effort_completed`.
- [x] 3.4 Publish a safe create result atomically, preserve/return the source for unimproved runs, and return run-local evidence on publication conflict.
- [x] 3.5 Expose strict status, best-effort status, selection evidence, remaining findings, fallback/review state, and publication disposition in host result and trace.

## 4. Contracts, UX, and compatibility

- [x] 4.1 Extend state/event/result contracts for best-effort and decision-processing evidence without changing strict `completed` semantics.
- [x] 4.2 Update command/agent documentation and corporate test instructions; keep runtime OpenSpec discovery excluded.
- [x] 4.3 Bump extension/package metadata to `1.24.0-corporate.5` while retaining `.4` rollback compatibility.

## 5. Verification and release

- [x] 5.1 Add runtime tests for successful Repair fallback, fallback failure, input-hash identity, and model-proof rejection.
- [x] 5.2 Add orchestration/lifecycle tests for interrupted resume recovery, repeated create normalization, and idempotent replay.
- [x] 5.3 Add best-effort tests for safe readability failures, unsafe structural failures, improve preservation, publication conflict, trace verification, and no-regression strict success.
- [x] 5.4 Run focused tests, full extension tests, installer/release suites, strict OpenSpec validation, and deterministic ZIP verification.
- [x] 5.5 Build the corporate ZIP and checksum, commit the isolated branch, push it, and record install/rollback instructions.
