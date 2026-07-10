## 1. Release Configuration

- [x] 1.1 Add root release configuration with separate allowlists, archive roots, output names, and version sources for draw.io and BPMN skills.
- [x] 1.2 Add pinned Python dependency manifests for the draw.io runtime and declare supported Node/Python versions.
- [x] 1.3 Add required license files and align version-bearing metadata within each skill.

## 2. Release Driver

- [x] 2.1 Implement dependency preflight for configured Python packages, npm packages, draw.io, and optional Graphviz.
- [x] 2.2 Implement deterministic allowlist-based ZIP creation with normalized ordering, timestamps, permissions, and forbidden-path checks.
- [x] 2.3 Generate per-file archive manifests and basename-only SHA-256 records under `dist`.
- [x] 2.4 Implement source-to-ZIP presence and content-hash parity validation.

## 3. Installed Skill Verification

- [x] 3.1 Add a compact runtime self-check entrypoint to each skill.
- [x] 3.2 Unpack each archive into a clean temporary directory and run schema compilation and self-checks from the archive.
- [x] 3.3 Run representative draw.io roadmap/git-flow and BPMN generation/strict-validation flows from unpacked archives.
- [x] 3.4 Verify forbidden files and undeclared generated outputs are absent from both archives.

## 4. Tests and Handoff

- [x] 4.1 Add release tests for missing allowlisted files, version mismatch, stale archive content, checksum verification, and deterministic rebuilds.
- [x] 4.2 Document one preflight/build/verify command sequence for both independent skills.
- [x] 4.3 Build and verify fresh draw.io and BPMN ZIPs and replace stale `dist` artifacts only after all gates pass.
- [x] 4.4 Run OpenSpec strict validation and record final release verification results.
