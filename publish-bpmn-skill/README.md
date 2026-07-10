# BPMN Architect Skill

`bpmn-architect` is a skill-based GigaCode CLI extension for creating validated semantic BPMN models, not only presentation diagrams.

The skill uses a deterministic local toolchain:

```text
process description -> process.yaml -> corp-bpmn CLI -> process.bpmn -> validation-report.json + process.md
```

Core rule: the agent writes `process.yaml`; the CLI generates BPMN XML, adds layout, validates the result, and writes documentation.

## Install in GigaCode CLI

Unpack the released ZIP as the `bpmn-architect` skill, install its locked local dependencies, and run the built-in contract check:

```bash
mkdir -p ~/.gigacode/skills
unzip bpmn-architect-skill.zip -d ~/.gigacode/skills
cd ~/.gigacode/skills/bpmn-architect/scripts/corp-bpmn
npm ci
npm run self-check
npm test
```

The released ZIP always contains the top-level `bpmn-architect/` directory. The CLI runs locally after installation and does not send process content to external renderers or SaaS services.

## Quick Check from the Source Tree

```bash
cd scripts/corp-bpmn
npm ci
npm run self-check
npm test
npm run build:example
```

The example build writes:

```text
examples/credit-approval/process.bpmn
examples/credit-approval/process.md
examples/credit-approval/validation-report.json
```

## Modeling Policy

Prefer the simplest BPMN construct that preserves business meaning. Schema v1 covers one process; schema v2 covers explicit multi-process collaboration. The shipped capability matrix is authoritative: `supported` means schema, generation, parse-back, round-trip, and validation coverage exist; `partial` requires review and fails strict mode; `unsupported` is rejected before generation. Do not claim unconditional full BPMN 2.0 support.

Canonical builds validate `process.yaml`, generate BPMN XML, parse it back, and compare semantic projections before reporting success. Conditions, gateway defaults, participant ownership, process-scoped flows, event definitions, documentation, and message-flow endpoints are protected by this round-trip check.
