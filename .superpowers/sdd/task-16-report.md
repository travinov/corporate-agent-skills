# Task 16 Report: Final Verification, Deterministic ZIP, and Rollback Evidence

## Scope

- Branch: `codex/drawio-layout-engine-v1.25.0-corporate.1`
- Repo HEAD at start of verification: `46b877e`
- Working tree ownership for this task: verification only plus generated/tracked `dist/*` and this report
- Final release archive:
  - `/private/tmp/corporate-agent-skills-route-preconditions-v12402/dist/drawio-skill-agent-extension.zip`
  - SHA256: `bc6d5c352447dc39cac3b2f4412dbd41c492b93174e1587c9c65e8b80e1cfcc0`
- Final checksum file:
  - `/private/tmp/corporate-agent-skills-route-preconditions-v12402/dist/drawio-skill-agent-extension.zip.sha256`
- Final zip inventory:
  - `unzip -l` showed `234` archive entries including `drawio-skill/MANIFEST.sha256`
  - `scripts/release_skills.py verify --skill drawio` reported `233` files
- Command-output logs captured in:
  - `/tmp/task16-step1.log`
  - `/tmp/task16-step2.log`
  - `/tmp/task16-step3.log`
  - `/tmp/task16-step4.log`
  - `/tmp/task16-step5.log`
  - `/tmp/task16-step5b.log`

## Step 1: Syntax and targeted regression gates

Commands run:

```bash
.venv/bin/python -m compileall -q publish-drawio-skill/scripts publish-drawio-skill/tests
.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_layout_*.py'
.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_validate.py'
.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_diagram_supervisor.py'
.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_diagram_orchestrator.py'
.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_lifecycle_v2.py'
```

Results:

- `compileall`: passed
- `test_layout_*.py`: `Ran 109 tests in 14.451s` `OK`
- `test_validate.py`: `Ran 1 test in 0.059s` `OK`
- `test_diagram_supervisor.py`: `Ran 91 tests in 17.422s` `OK`
- `test_diagram_orchestrator.py`: `Ran 78 tests in 214.983s` `OK`
- `test_lifecycle_v2.py`: `Ran 19 tests in 4.152s` `OK`

## Step 2: Repository-wide gates

Commands run:

```bash
.venv/bin/python -m unittest discover -s publish-drawio-skill/tests -p 'test_*.py'
.venv/bin/python -m unittest tests.gigacode.test_extension_installers tests.test_release_skills
.venv/bin/python scripts/release_skills.py verify --skill drawio
```

Results:

- `test_*.py`: `Ran 432 tests in 278.717s` `OK`
- `tests.gigacode.test_extension_installers tests.test_release_skills`: `Ran 53 tests in 28.353s` `OK`
- `scripts/release_skills.py verify --skill drawio`: initially failed before the rebuild with archive parity drift
- The prebuild failure was:

```json
{
  "status": "failed",
  "error": "archive parity failed: missing=[], extra=[], changed=['README.md', 'SKILL.md', 'data/semantic-analysis.v2.schema.json', 'scripts/agent_runtime.py', 'tests/test_agent_contracts.py', 'tests/test_agent_runtime.py', 'tests/test_diagram_orchestrator.py', 'tests/test_lifecycle_v2.py']"
}
```

## Step 3: Deterministic ZIP rebuild

Commands run:

```bash
.venv/bin/python scripts/release_skills.py build --skill drawio
shasum -a 256 dist/drawio-skill-agent-extension.zip
cp dist/drawio-skill-agent-extension.zip /tmp/drawio-layout-first.zip
.venv/bin/python scripts/release_skills.py build --skill drawio
cmp /tmp/drawio-layout-first.zip dist/drawio-skill-agent-extension.zip
shasum -a 256 dist/drawio-skill-agent-extension.zip > dist/drawio-skill-agent-extension.zip.sha256
```

Results:

- First build archive SHA256: `bc6d5c352447dc39cac3b2f4412dbd41c492b93174e1587c9c65e8b80e1cfcc0`
- Second build matched byte-for-byte with `cmp` exit `0`
- The checksum file was rewritten to a clean single-line format after I found my first capture wrapper had contaminated it

## Step 4: ZIP inventory and manifest verification

Commands run:

```bash
unzip -l dist/drawio-skill-agent-extension.zip
(cd dist && shasum -a 256 -c drawio-skill-agent-extension.zip.sha256)
unzip -p dist/drawio-skill-agent-extension.zip drawio-skill/MANIFEST.sha256 | shasum -a 256
```

Results:

- `shasum -a 256 -c`: `drawio-skill-agent-extension.zip: OK`
- Embedded manifest hash check: `9d7bb38389291a428ca2aad423c6d94764cb9ed23cd3e7d04d84b748c477b9ae  -`
- Extracted-tree manifest comparison:

```json
{
  "checked": 233,
  "mismatches": []
}
```

- Forbidden archive entries check: `OK`
- No `.DS_Store`, `.git`, `node_modules`, `__pycache__`, or `.pytest_cache` entries were found in the archive listing

## Step 5: Node / ELK probe and Python fallback

Commands run:

```bash
which -a node
node -v
.venv/bin/python -m unittest publish-drawio-skill.tests.test_layout_backend.LayoutBackendTests.test_python_mode_and_sanitized_path_do_not_require_node
```

Results:

- `node` path on this machine: `/usr/local/bin/node`
- `node -v`: `v22.17.0`
- `draw.io --version` from the installed desktop app: `30.3.6`
- Focused fallback test passed: `LayoutBackendTests.test_python_mode_and_sanitized_path_do_not_require_node`
- Backend probe evidence from a valid request:

```json
{
  "backend": "elk-layered-0.11.1",
  "backend_selected": "elk-layered-0.11.1",
  "elkjs_version": "0.11.1",
  "fallback_backend": null,
  "fallback_reason": null,
  "node_version": "v22.17.0"
}
```

## Step 6: Representative PNG exports

Generated under:

- `/tmp/task16-layout-export/order-processing.drawio`
- `/tmp/task16-layout-export/return-loop.drawio`
- `/tmp/task16-layout-export/c4-services.drawio`
- `/tmp/task16-layout-export/microservices.drawio`
- `/tmp/task16-layout-export/er-dependency.drawio`
- `/tmp/task16-layout-export/bpmn-lanes.drawio`

Exported PNGs:

- `/tmp/task16-layout-export/order-processing.png` - `1245 x 385`, `43240` bytes
- `/tmp/task16-layout-export/return-loop.png` - `321 x 515`, `21710` bytes
- `/tmp/task16-layout-export/c4-services.png` - `1725 x 165`, `22441` bytes
- `/tmp/task16-layout-export/microservices.png` - `1285 x 365`, `26470` bytes
- `/tmp/task16-layout-export/er-dependency.png` - `1765 x 145`, `18567` bytes
- `/tmp/task16-layout-export/bpmn-lanes.png` - `805 x 325`, `19276` bytes

Programmatic PNG checks:

- All six files had a valid PNG signature
- All six files had nonzero dimensions
- No empty outputs were produced

Visual review:

- `order-processing`: clean left-to-right flow, branch split readable, no overlap
- `return-loop`: feedback loop routes outside the main flow, no trunk collision
- `c4-services`: straight service chain, no accidental cross-route
- `microservices`: fan-out is clean, labels remain readable
- `er-dependency`: simple dependency chain, no crossing artifacts
- `bpmn-lanes`: lanes and flow remain separated, no obvious clipping

## Step 7: Installer / verifier / rollback evidence

Fake-CLI release coverage already executed in:

- `tests.gigacode.test_extension_installers`
- `tests.test_release_skills`

Relevant commands from the bundled corporate instructions:

```bash
cd ~/Downloads/drawio-skill
chmod +x install/*.sh
./install/install_drawio_agent_extension.sh
./install/verify_drawio_agent_extension.sh
./install/rollback_drawio_agent_extension.sh --latest
```

Rollback target:

- The `--latest` rollback path returns to the previous backup, which is the prior `1.24.0-corporate.5` archive in the fake-CLI test flow

Limitations:

- Corporate GigaCode acceptance remains pending because no live corporate laptop install/rollback was executed in this container
- The initial `scripts/release_skills.py verify --skill drawio` run failed before the rebuild because the checked-in archive was stale relative to the current source tree; the rebuilt archive passed the final verifier

## Final State

- Deterministic rebuild confirmed with a byte-identical second ZIP
- Final checksum file is clean and validates with `shasum -a 256 -c`
- Embedded manifest hashes match the extracted tree
- Node/ELK and forced Python fallback evidence captured
- Representative PNG corpus exported and visually reviewed
