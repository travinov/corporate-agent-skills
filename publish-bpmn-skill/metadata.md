# BPMN Architect Skill

- Name: `bpmn-architect`
- Version: `0.2.0`
- Description: Creates, validates, and documents semantic BPMN 2.0 process models from natural-language process descriptions using a local `process.yaml -> corp-bpmn CLI -> process.bpmn` workflow.
- Applicability: Use when the user needs a real editable `.bpmn` process model for Camunda, Zeebe, Flowable, Activiti, bpmn.io, or corporate BPMN tooling. Use draw.io instead for presentation-only process diagrams.
- Constraints: Local-first. Do not send process content to external SaaS, public renderers, public APIs, or external MCP servers.
- Runtime: Node.js 22+ recommended. CLI dependencies are installed under `scripts/corp-bpmn`.
