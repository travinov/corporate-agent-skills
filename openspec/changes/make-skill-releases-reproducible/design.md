## Context

The workspace produces two independently installable skills from `publish-drawio-skill` and `publish-bpmn-skill`. The draw.io archive is currently older than its source tree, checksum files assume different working directories, and dependency availability is verified informally rather than by the release command. The user explicitly requires two skills, not an umbrella package, and permits installing dependencies after an availability preflight.

## Goals / Non-Goals

**Goals:**

- Build two deterministic ZIPs from explicit source manifests.
- Prove that dependencies are available before packaging and that clean installations work.
- Prove source-to-archive parity and run validation from the unpacked archives.
- Keep package versions, archive names, checksums, licenses, and skill metadata consistent.
- Ship a small runtime self-check while keeping full test and release tooling in the repository.

**Non-Goals:**

- Do not merge the skills or introduce an umbrella extension.
- Do not publish to GitHub automatically as part of the local build command.
- Do not bundle platform-specific virtual environments or `node_modules`.
- Do not require network access when an installed skill is invoked.

## Decisions

1. **Use one root release driver with two manifests.** A Python standard-library driver will read an explicit manifest for each skill, run its checks, and build its archive. Central orchestration avoids checksum drift while the manifests keep runtime contents independent.

2. **Use allowlists, not broad directory zips.** Each manifest will identify runtime paths and deliberate test/self-check fixtures. `.git`, `.DS_Store`, caches, dependency directories, temporary files, and generated outputs are rejected even if accidentally listed.

3. **Make archives byte-reproducible where practical.** Entries will be sorted, use normalized permissions and timestamps, and be written with a fixed compression policy. The release report will record every archived path and SHA-256.

4. **Check availability before installation.** Python packages will be declared in pinned requirement files and probed through the configured package index; Node dependencies will be checked through the configured npm registry and installed with `npm ci`. The preflight and installation are separate report layers.

5. **Test from the archive, not only from source.** Each ZIP will be unpacked to a fresh temporary directory. Schema compilation, runtime self-check, representative generation, strict validation, and tests selected by the manifest will run from that directory.

6. **Use one checksum convention.** `dist/SHA256SUMS.txt` will contain archive basenames and be verifiable from `dist/`. Per-archive `.sha256` files may be generated with the same basename-only convention.

7. **Keep version ownership per skill.** The release driver will compare all declared version-bearing files for a skill and fail on disagreement. Draw.io and BPMN versions remain independent.

## Risks / Trade-offs

- **[Risk]** Full clean installation can be slower than unit tests. → **Mitigation:** expose separate `preflight`, `build`, and `verify` commands while requiring all three for a release.
- **[Risk]** Exact ZIP byte reproducibility can vary across compression libraries. → **Mitigation:** use the same standard-library writer and compare the manifest hashes as the mandatory guarantee; compare ZIP SHA in CI on the supported runtime.
- **[Risk]** Corporate registries can be temporarily unavailable. → **Mitigation:** report availability separately and allow an approved cached/offline source without weakening package identity checks.
- **[Risk]** Runtime self-check fixtures can bloat skills. → **Mitigation:** include only minimal fixtures needed to prove schema and generator health; keep the full suite in the repository.

## Migration Plan

1. Add manifests and dependency declarations without changing current ZIPs.
2. Add preflight and archive verification tests.
3. Build both archives into a temporary output directory and compare them with current contents.
4. Replace `dist` artifacts only after both archive verification flows pass.
5. Retain the previous ZIPs outside `dist` until the new archives have passed installation smoke tests.

## Open Questions

- The approved corporate registry endpoints are environment configuration and are intentionally not hard-coded.
