---
name: bpmn-architect
description: Use when the user asks to create, review, validate, edit, or document semantic BPMN 2.0 process models; convert text, SOPs, regulations, or workflow descriptions into editable .bpmn files; work with Camunda, Zeebe, Flowable, Activiti, bpmn.io, pools, lanes, gateways, events, tasks, sequence flows, message flows, boundary events, subprocesses, or BPMN validation. Produces process.yaml, process.bpmn, process.md, and validation-report.json through a local corp-bpmn CLI. Do not use for presentation-only process diagrams unless the user explicitly wants BPMN semantics.
license: MIT
metadata: {"version":"0.3.0","compatibility":"Requires Node.js 22+ recommended. Run `npm ci` in `scripts/corp-bpmn` before first CLI use.","category":"process-modeling","tags":["bpmn","workflow","process","camunda","zeebe","bpmn-js","validation"],"requires_tools":["node","npm"],"local_first":true}
---

# BPMN Architect

Create real BPMN 2.0 process models through a local, deterministic toolchain.

## Core Rule

Do not hand-author final BPMN XML as the source of truth. Create or edit `process.yaml`, then run the bundled `corp-bpmn` CLI to generate BPMN XML, layout, validation report, and process documentation.

Pipeline:

```text
Process description
  -> process.yaml
  -> corp-bpmn build
  -> process.bpmn + process.md + validation-report.json
```

## When to Use

Use this skill for semantic BPMN work:

- creating `.bpmn` files from text, SOPs, regulations, or workflow descriptions;
- reviewing or fixing BPMN process models;
- creating process models for Camunda, Zeebe, Flowable, Activiti, bpmn.io, or internal BPMN tools;
- modeling pools, lanes, events, tasks, gateways, subprocesses, boundary events, sequence flows, or message flows;
- validating process structure, execution readiness, layout, and corporate BPMN rules.

If the user only needs a presentation diagram with BPMN-looking shapes, route to draw.io instead and explain the difference.

## Complexity Policy

Complexity must be available, not imposed.

- Prefer the simplest BPMN construct that preserves business meaning.
- Do not use advanced BPMN elements for visual sophistication.
- Use advanced BPMN only when a simpler model would distort semantics or the user explicitly asks for it.
- Use only BPMN families marked `supported` or `partial` in the shipped capability matrix. Do not claim unconditional full BPMN 2.0 support.
- If an advanced construct is used, explain the business reason in `process.md`.

## First-Draft Authoring Rules

Start every new model from the canonical skeleton in `references/process-yaml.md`. The first draft must already use lane objects, valid ids, nodes only in `nodes`, sequence flows only in `flows`, and the documented `participants` key. Do not rely on validation failures to discover the basic YAML shape.

- Use schema v1 for one process and at most one participant/pool.
- Use schema v2 when multiple participants own distinct processes and communicate with message flows.
- Never represent multiple pools by attaching them to one v1 process. Ask for process ownership if it is unclear.
- In v2, use concrete `sendTask`, `receiveTask`, intermediate throw, or intermediate catch node ids for message endpoints whenever they are known. Use participant ids only for black-box or genuinely unspecified interactions and record that assumption.
- Write conditions as `{ body, language? }` objects and gateway defaults as outgoing sequence-flow ids.
- Treat `unsupported` capability findings as blockers. A `partial` capability is allowed only when semantic round-trip passes; it fails strict mode and requires review.

- Model preparation methods, fulfillment paths, approval outcomes, and other alternatives as gateway branches. Do not create lanes merely to display variants.
- Use lanes only for actors, roles, systems, departments, tools, or other real responsibility partitions, and assign their nodes consistently.
- Add an exclusive-gateway default only for a real fallback such as `other`, `unknown`, `not selected`, timeout, exception, or a business-defined default. Otherwise label or condition every outgoing branch without inventing a default.
- Keep descriptive durations such as "wait 4 minutes" in the task name, documentation, or assumptions. Use timer events only when time controls a wait state, deadline, escalation, SLA, reminder, timeout, or automation behavior.

## Human Input Rule

If missing information is material enough to ask the user, ask and stop. Do not continue generation in the same turn.

Do not:

- ask a question and answer it yourself;
- offer choices and immediately select one;
- write `process.yaml`, run `corp-bpmn`, or create files after asking a material question;
- say "if no clarifications..." and then proceed without a user reply.

Allowed:

- If missing information is not material for BPMN semantics, make a conservative assumption without asking and record it in `process.md`.
- If asking, provide 2-4 concrete options plus free-form answer support.
- After asking, end the turn and wait for the user.

## Local-First Constraint

Do not send process content to external SaaS, online renderers, public APIs, or external MCP servers. Use local files, bundled scripts, and approved internal/package-registry dependencies only.

## References

Read these files only when needed:

| File | Read when |
|---|---|
| `references/bpmn-intake.md` | The request is broad, sourced from a document, or needs process discovery questions |
| `references/process-yaml.md` | Writing or editing `process.yaml` |
| `references/bpmn-authoring.md` | Choosing BPMN element semantics or advanced constructs |
| `references/bpmn-layout.md` | Explaining layout, BPMN DI, or layout warnings |
| `references/bpmn-validation.md` | Interpreting `validation-report.json` or fixing validation failures |
| `references/camunda-zeebe.md` | User targets Camunda Platform, Zeebe, or engine-specific execution |
| `references/troubleshooting.md` | CLI install/build/layout/validation fails |

## Workflow

1. Intake the process: goal, boundaries, start/end states, participants, responsibility partitions, process variants, tasks, systems, decisions, exceptions, data, messages, and assumptions.
2. If a material clarification is required, ask the question and stop. Continue only after the user answers.
3. If clarification is not material, proceed with conservative assumptions and record them.
4. Apply the complexity policy. Start simple; escalate only when the process meaning requires it.
5. Choose v1 for a single process or v2 for real collaboration, then write a versioned `process.yaml` following `references/process-yaml.md`.
6. Run:
   ```bash
   node <skill-dir>/scripts/corp-bpmn/src/cli/index.mjs build path/to/process.yaml --strict
   ```
7. Read `validation-report.json`, including `schema_version`, capability, `round-trip`, and every `layout.*` finding.
8. If any strict blocker exists, including detached endpoints, routes through unrelated shapes, duplicate routes, crossings, or shapes outside their participant/lane, fix `process.yaml` or layout and rebuild.
9. Report artifact paths, schema version, preservation status, and warnings. Do not claim completion until build and semantic round-trip validation pass.

## Setup

Install CLI dependencies once:

```bash
cd <skill-dir>/scripts/corp-bpmn
npm ci
```

Useful commands:

```bash
node scripts/corp-bpmn/src/cli/index.mjs init diagrams/my-process
node scripts/corp-bpmn/src/cli/index.mjs init diagrams/my-collaboration --schema-version 2
node scripts/corp-bpmn/src/cli/index.mjs build diagrams/my-process/process.yaml
node scripts/corp-bpmn/src/cli/index.mjs validate diagrams/my-process/process.bpmn --yaml diagrams/my-process/process.yaml
node scripts/corp-bpmn/src/cli/index.mjs migrate legacy/process.yaml --to-version 2 --out migrated/process.yaml
node scripts/corp-bpmn/src/cli/index.mjs self-check
```
