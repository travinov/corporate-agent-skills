# Runtime dependencies

Install from the package source already configured for the Python environment:

```bash
python3 -m pip install -r requirements.txt
```

Supported ranges:

- `PyYAML>=6.0,<7`
- `jsonschema>=4.18,<5`
- `openpyxl>=3.1,<4`

Availability was verified on 2026-07-09 without changing the configured package
source. The tested environment resolved and imported PyYAML 6.0.3 and
jsonschema 4.26.0, and openpyxl 3.1.5.

Supported interpreter: Python 3.11-3.14.

Run `python3 scripts/self_check.py --check-registry` before first use to verify
both registry resolution and the installed runtime. The check never adds or
changes an index URL.

## Optional offline ELK layout backend

The extension includes the exact `elkjs@0.11.1` runtime bundle and upstream
license under `vendor/elkjs/`. `vendor/elkjs/NOTICE.json` records the npm
package, upstream repository, tarball integrity, tarball SHA256, and SHA256 of
the committed bundle and license. The committed bundle is the runtime source of
truth: installation and runtime never invoke `npm`, `npx`, a package registry,
`curl`, or any network/package resolver.

Node.js is optional when `layout_backend` is `auto`. The host accepts a Node
executable only after both `node --version` and the bundled JSON bridge probe
succeed. Set `node_bin` to an approved absolute executable path to pin it, or
leave it `null` for verified `PATH` discovery. If no verified Node executable
is available, `auto` deterministically uses the bundled Python layout backend.
Explicit `elk` mode fails closed when Node cannot be verified.

From the extracted extension root, prove the optional Node path without any
package install or network access:

```bash
node --version
node scripts/elk_runner.mjs --probe
```

The second command must return
`{"bridge":"drawio-elk-runner","elkjs_version":"0.11.1"}`. To prove the
mandatory Node-free path, force Python mode through the focused offline test:

```bash
python3 -m unittest tests.test_layout_backend.LayoutBackendTests.test_python_mode_and_sanitized_path_do_not_require_node
```

Configuration:

```json
{
  "drawio_bin": null,
  "node_bin": null,
  "layout_backend": "auto",
  "layout_timeout_seconds": 30,
  "layout_capture_max_bytes": 4194304,
  "layout_wall_clock_seconds": 180
}
```

`layout_backend` accepts:

- `auto`: verified vendored ELK first, then the Python backend on any bounded
  ELK execution or contract failure;
- `elk`: require a verified Node executable and fail closed on every ELK
  execution, stderr, capture, or result-contract failure;
- `python`: do not resolve or start Node;
- `legacy-generic-v2`: explicit compatibility renderer selection only; it is
  never an automatic layout default.

`layout_timeout_seconds` bounds one ELK subprocess. The subprocess runs in an
isolated process group on macOS/POSIX; timeout or capture overflow kills and
reaps the full group, with a direct-child fallback on platforms without process
group APIs. `layout_capture_max_bytes` bounds each of stdout and stderr while
they stream to evidence files (default 4 MiB, hard maximum 64 MiB). A truncated
prefix is retained and hashed with observed-byte and truncation evidence; it is
never parsed as a result. Any non-whitespace stderr is a failed ELK attempt.
The lifecycle host owns the larger `layout_wall_clock_seconds` budget across a
finite strategy set.

Durable trace evidence records `backend_requested`, `backend_selected`,
`node_executable`, `node_version`, `elkjs_version`, `strategy_id`,
`effective_options`, `options_sha256`, `request_sha256`, `result_sha256`,
`fallback_reason`, capture sizes/truncation flags, and stdout/stderr paths and
SHA-256 values. The vendored bundle, license, notice, bridge, Python fallback,
and all layout schemas are release inventory protected by `MANIFEST.sha256`.
