# Task 15 Report: Documentation, Offline Packaging, and Release Version

## Scope

- Branch: `codex/drawio-layout-engine-v1.25.0-corporate.1`
- RED base: `a214a52b521ccc5bdb622082a9f477e6e515b2b0`
- Release version: `1.25.0-corporate.1`
- Installer default branch:
  `codex/drawio-layout-engine-v1.25.0-corporate.1`
- Release implementation commit: `972fd8f`
- Release tests:
  - `tests/gigacode/test_extension_installers.py`
  - `tests/test_release_skills.py`
- Test commits:
  - `8813aa7` — define the release archive/runtime inventory RED contract;
  - `a214a52` — tighten version, no-Node, and fail-closed verifier RED cases;
  - `5903766` — add the post-review manifest checksum tamper regression.

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
- Added a focused regression that tampers
  `vendor/elkjs/elk.bundled.js` after installation and requires the verifier
  to report
  `inventory mismatch: vendor/elkjs/elk.bundled.js (manifest checksum mismatch in active)`.
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
Ran 53 tests in 28.835s
OK
```

The 53 tests include archive inventory, installer/verifier version consistency,
installation with no Node on `PATH`, missing runtime/schema/vendor inventory,
and the post-review active manifest checksum tamper regression from `5903766`.

Task 15 clean-extract release verification before the post-review test-only
commit:

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

The generated archive above predates `5903766`. That repository-level installer
test is intentionally not part of the `publish-drawio-skill` archive inventory;
Task 16 owns the deterministic rebuild plus final source and clean-extract
verification after the test has passed against the packaged installer/verifier.

`git diff --check` also exited `0`.

The generated `dist/` artifacts are intentionally left for Task 16, whose
declared scope owns deterministic double-build, final ZIP/checksum evidence,
inventory inspection, and delivery verification.
