# GigaCode Draw.io extension installers

These scripts are prepared on a machine without GigaCode and are intended to
run on the corporate macOS laptop where the CLI is installed at:

```text
/Users/travinov-sv/.gigacode/bin/gigacode
/Users/travinov-sv/.gigacode/skills
/Users/travinov-sv/.gigacode/extensions
```

They never install the agent package as a skill. An active legacy
`skills/drawio-skill` is copied to a timestamped backup and removed from active
discovery before the new extension is registered.

## Offline installation

Transfer this whole `scripts/gigacode` directory together with:

```text
dist/drawio-skill-agent-extension.zip
dist/drawio-skill-agent-extension.zip.sha256
```

Then run on the corporate laptop from the repository/package directory:

```bash
chmod +x scripts/gigacode/*.sh
scripts/gigacode/install_drawio_agent_extension.sh \
  --archive dist/drawio-skill-agent-extension.zip \
  --checksum dist/drawio-skill-agent-extension.zip.sha256
```

Use `--skip-deps` only if the locked Python dependencies are already installed
or the corporate Python environment is managed separately. Use `--dry-run` to
validate the archive through the native GigaCode validation command and show
all later filesystem/install actions without executing them.

## Online installation

If the corporate laptop can access GitHub, copy only this directory and run:

```bash
scripts/gigacode/install_drawio_agent_extension.sh
```

The installer downloads the extension archive and its checksum from branch
`codex/drawio-agent-extension-v1.22.0`.

## Verification and rollback

```bash
scripts/gigacode/verify_drawio_agent_extension.sh
scripts/gigacode/rollback_drawio_agent_extension.sh --latest
```

After verification, restart GigaCode and run `/agents list`. Expected agents:

- `diagram-supervisor`
- `diagram-reviewer`
- `diagram-repair`
- `diagram-semantic-analyst`

`rollback_drawio_agent_extension.sh --backup PATH` selects a specific backup.
Backups are stored under
`~/.gigacode/backups/drawio-agent-extension/<UTC timestamp>`.
