# Task 15 Report: Documentation, Offline Packaging, and Release Version

## Scope

- Branch: `codex/drawio-layout-engine-v1.25.0-corporate.1`
- RED base: `a214a52b521ccc5bdb622082a9f477e6e515b2b0`
- Release version: `1.25.0-corporate.1`
- Installer default branch:
  `codex/drawio-layout-engine-v1.25.0-corporate.1`
- Tests were not edited.

## RED evidence

Command:

```bash
.venv/bin/python -m unittest tests.gigacode.test_extension_installers tests.test_release_skills
```

Exact result before implementation:

```text
Ran 52 tests in 24.233s
FAILED (failures=13)
```

The 13 failures proved the intended release gap:

- installer/verifier and manifests still reported `1.24.0-corporate.5`;
- the release ZIP missed 17 intake/layout runtime, schema, and vendored ELK
  entries;
- the verifier could not exercise the missing layout backend, bridge, bundle,
  license, or notice;
- the Node-free PATH test exposed an unqualified `ln` command.

## GREEN implementation

- Bumped `SKILL.md`, `metadata.md`, `gemini-extension.json`, installer, verifier,
  corporate guide, and release documentation to `1.25.0-corporate.1`.
- Added every Task 15 runtime, schema, ELK bundle, license, and notice to the
  release allowlist and installer inventory. `node_modules` remains forbidden.
- Added `node` only to `optional_commands`; `python3` and `drawio` remain the
  required commands.
- Kept the mandatory Python layout path installable without Node.
- Added fail-closed verifier checks. A missing or manifest-mismatched Task 15
  payload reports `inventory mismatch: <path>`.
- Preserved existing install/source/backup paths and rollback behavior.
- Updated the obsolete verifier role-policy literal to the current host-owned
  assignment exposed by the packaged orchestrator.
- Documented short create/improve commands, bounded interactive intake, strict
  versus best-effort outcomes, Node/bridge proof, forced Python fallback, ELK
  trace fields, read-only status monitoring from another terminal, offline ZIP
  checksum/install/verify/rollback, and the no npm/network runtime rule.

## GREEN evidence

Syntax and configuration checks:

```bash
.venv/bin/python -m json.tool release/skills.json
.venv/bin/python -m json.tool publish-drawio-skill/gemini-extension.json
/bin/bash -n scripts/gigacode/install_drawio_agent_extension.sh
/bin/bash -n scripts/gigacode/verify_drawio_agent_extension.sh
```

Result: all exited `0`.

Targeted release suite:

```bash
.venv/bin/python -m unittest tests.gigacode.test_extension_installers tests.test_release_skills
```

Exact result:

```text
Ran 52 tests in 27.637s
OK
```

Clean-extract release verification:

```bash
.venv/bin/python scripts/release_skills.py verify --skill drawio
```

Exact result:

```json
{
  "reports": [
    {
      "archive": "drawio-skill-agent-extension.zip",
      "files": 233,
      "sha256": "d57e331e8221618744129f17a551b4f3cae4e6dda90926666b93687377015fec",
      "skill": "drawio",
      "status": "passed"
    }
  ],
  "status": "passed"
}
```

`git diff --check` also exited `0`.

The generated `dist/` artifacts are intentionally left for Task 16, whose
declared scope owns deterministic double-build, final ZIP/checksum evidence,
inventory inspection, and delivery verification.
