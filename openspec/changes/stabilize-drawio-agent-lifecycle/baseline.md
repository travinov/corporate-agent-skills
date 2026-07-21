## Baseline recorded for task 1.1

Rollback artifact preserved:

- Version: `1.23.0-corporate.13`
- ZIP checksum: `7606387e6d82a9f4e6afc95df1d3001bf8d695c3166eafc6b553c39e0d33f4c2`
- ZIP manifest: `dist/drawio-skill-agent-extension.zip.manifest.json`

Command surface observed on the preserved baseline:

- `/drawio:create`
- `/drawio:improve`
- `/drawio:review`
- `/drawio:resume`
- `/drawio:trace`

Focused baseline checks already passed before this change:

- `python3 -m unittest discover -s publish-drawio-skill/tests -p 'test_diagram_orchestrator.py'`
- `python3 -m unittest discover -s publish-drawio-skill/tests -p 'test_diagram_supervisor.py'`
- `python3 -m unittest discover -s publish-drawio-skill/tests -p 'test_diagram_host.py'`
