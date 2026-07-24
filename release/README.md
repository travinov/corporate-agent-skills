# Skill release workflow

Builds two independent installable artifacts:

- `dist/drawio-skill-agent-extension.zip` (`1.25.0-corporate.1`)
- `dist/bpmn-architect-skill.zip`

Install the Draw.io agent package as a native GigaCode extension. Do not unpack
it into `skills`, because the agent extension and the legacy drawio skill would
compete for the same requests:

```bash
unzip dist/drawio-skill-agent-extension.zip -d ~/Downloads
cd ~/Downloads/drawio-skill
chmod +x install/*.sh
./install/install_drawio_agent_extension.sh
./install/verify_drawio_agent_extension.sh
```

The installer defaults to `/Users/travinov-sv/.gigacode/bin/gigacode` through
`$HOME/.gigacode`, backs up an active legacy skill/extension, validates the
complete internal manifest of the extracted package, and calls native
`gigacode extensions install` and, when supported by the installed CLI,
`gigacode extensions validate`. All paths can be
overridden with the environment variables printed by `--help`. Roll back the
latest installation with:

```bash
./install/rollback_drawio_agent_extension.sh --latest
```

For a transferred corporate ZIP, verify the separately supplied checksum before
installation:

```bash
cd ~/Downloads
shasum -a 256 -c drawio-skill-agent-extension.zip.sha256
/usr/bin/ditto -x -k drawio-skill-agent-extension.zip .
cd drawio-skill
./install/install_drawio_agent_extension.sh
./install/verify_drawio_agent_extension.sh
```

The Draw.io archive contains the Python layout fallback, versioned intake/layout
schemas, `scripts/elk_runner.mjs`, and the exact vendored ELK bundle, license,
and notice. Node is optional; a machine without Node must install and verify
successfully. The installed runtime never runs npm/npx, contacts a package
registry, or fetches layout code from the network.

The BPMN archive remains an independent skill:

```bash
mkdir -p ~/.gigacode/skills
unzip dist/bpmn-architect-skill.zip -d ~/.gigacode/skills
```

The archive roots are `drawio-skill/` and `bpmn-architect/`; there is no
umbrella extension and neither skill requires the other.

In corporate GigaCode 26.5.17 the deterministic Draw.io command host performs
`host-preflight` and invokes isolated Supervisor, Semantic Analyst, Repair, and
Reviewer roles itself. Native agent visibility and parent `/stats model` are not
execution evidence.

The package exposes these deterministic entry points:

```text
/drawio:review
/drawio:create "process description"
/drawio:improve "required changes"
/drawio:resume continue "correction"
/drawio:resume approve
/drawio:trace
```

Run from the repository root:

```bash
# Verify installed tools and configured package registries.
python3 scripts/release_skills.py preflight --registry

# Build deterministic archives and basename-only checksum files.
python3 scripts/release_skills.py build

# Compare source files with ZIP contents and run smoke checks from clean extracts.
python3 scripts/release_skills.py verify

# Run every gate in order.
python3 scripts/release_skills.py all --registry

# Verify final checksums from the only supported working directory.
cd dist && shasum -a 256 -c SHA256SUMS.txt
```

Use `--skill drawio` or `--skill bpmn` for one product. Graphviz is optional for the draw.io skill because builtin git-flow routing is required to remain available.

The build command does not publish releases. Publish only archives that pass `verify` from their unpacked temporary installations.
