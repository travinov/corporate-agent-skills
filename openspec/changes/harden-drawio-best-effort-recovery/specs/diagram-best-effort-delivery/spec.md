## ADDED Requirements

### Requirement: Return the best structurally safe artifact after bounded work
The extension SHALL finish a bounded create or improve workflow with `best_effort_completed` when strict success is unavailable but a hash-bound artifact is parseable, structurally valid, semantically authorized, and free of integrity findings. It SHALL report `strict_passed: false`, remaining findings, and the selection reason.

#### Scenario: Create repair times out but baseline has only readability findings
- **WHEN** all bounded Repair attempts are exhausted and the generated baseline has only crossing, route-through, overlap, routing, or text-readability findings
- **THEN** the host atomically publishes the baseline to the unused create target and returns it as a best-effort final artifact

#### Scenario: No improved candidate exists for an improve run
- **WHEN** bounded repair produces no structurally safe monotonic improvement
- **THEN** the host preserves the source byte-for-byte and returns the source as the retained best-effort final artifact

### Requirement: Never degrade safety to obtain a result
Best-effort delivery MUST NOT publish malformed XML, structural errors, dangling references, semantic drift without approval, evidence mismatches, or overwrite conflicts.

#### Scenario: Candidate contains a structural error
- **WHEN** the last working candidate has a structural or integrity finding
- **THEN** the host keeps the last structurally safe artifact if one exists, otherwise returns manual handoff with the run-local evidence and does not publish the unsafe candidate

#### Scenario: Destination changed concurrently
- **WHEN** atomic publication detects that the create or improve target changed after run start
- **THEN** the host does not overwrite it and returns the run-local best artifact plus publication-conflict evidence

### Requirement: Distinguish strict success from degraded delivery
The host result and trace SHALL expose a best-effort flag, strict receipt status, publication disposition, selected artifact hash, selection evidence, remaining findings, and any missing Reviewer result.

#### Scenario: Readability findings remain
- **WHEN** a safe artifact is delivered with unresolved readability findings
- **THEN** neither the result nor trace claims `completed`, `approved`, or strict validation success
