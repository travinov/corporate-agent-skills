## Why

The checked draw.io release ZIP is older than its source tree, and the two skills currently lack one reproducible path that proves dependencies, versions, source manifests, archives, and post-install behavior agree. Corporate users need the tested source to be exactly what they install.

## What Changes

- Add deterministic, allowlist-based build commands for two independent artifacts: the extended draw.io skill ZIP and the BPMN Architect skill ZIP.
- Check dependency availability before builds and install from pinned Python/Node manifests in clean environments.
- Enforce source-to-ZIP manifest parity, consistent version metadata, archive hygiene, and one checksum convention.
- Unpack each ZIP into a clean temporary directory and run schema compilation, self-checks, and representative generation/validation flows from the archive.
- Keep full CI and release tooling in the repository while shipping a compact runtime `self-check` in each skill.

## Capabilities

### New Capabilities

- `skill-release-packaging`: Define reproducible packaging, clean-install validation, ZIP parity, checksum, and independent release requirements for both skills.

### Modified Capabilities

- None.

## Impact

- Adds root-level release scripts/configuration and dependency manifests used by `publish-drawio-skill`, `publish-bpmn-skill`, and `dist`.
- Produces two separate installable skills; it does not create an umbrella extension.
- Excludes `.git`, `.DS_Store`, `__pycache__`, `node_modules`, and generated example outputs unless explicitly allowlisted.
