## Context

The BPMN Architect skill already uses a sound architecture: the agent authors `process.yaml`, the local `corp-bpmn` CLI generates BPMN 2.0 XML with DI, and validation produces a machine-readable report. A recent coffee-process run showed that this pipeline works, but the agent reached success by repeatedly fixing avoidable first-draft mistakes and by making a few weak modeling choices.

The change must preserve the core policy: full BPMN support is available, but simple BPMN remains the default until it would distort the process meaning.

## Goals / Non-Goals

**Goals:**

- Make the first `process.yaml` draft more likely to satisfy the documented schema.
- Prevent misuse of lanes as ordinary branch variants.
- Prevent arbitrary exclusive gateway defaults.
- Keep plain duration notes out of advanced event modeling unless they affect control flow.
- Reduce false-positive semantic warnings for Russian-language process labels.

**Non-Goals:**

- Do not remove support for full BPMN 2.0 element families.
- Do not require executable BPMN for descriptive business diagrams.
- Do not introduce external renderers, SaaS validators, or public APIs.
- Do not replace BPMN semantics with presentation-only diagrams.

## Decisions

1. Treat first-draft authoring as a normative skill behavior.

   The skill should provide and follow a minimal valid skeleton rather than relying on the CLI to teach the agent basic shape through errors. The CLI remains the final authority, but the agent-facing contract must be explicit enough to prevent malformed `nodes`, string-only lanes, missing flow ids, and `pools` aliases.

2. Model choices with gateways, not lanes.

   Lanes remain available for roles, systems, departments, tools, or responsibility partitions. When a user asks for variants such as "V60, french press, espresso", the default representation is an exclusive gateway with separate branches in one participant unless each variant truly belongs to a different responsible role/system.

3. Require semantic justification for default flows.

   A default flow is valid only when there is a real fallback path such as "other", "not selected", "unknown", or a business-defined default. If all branches are deliberate alternatives, each non-default outgoing flow needs a label or condition, and the validation rule should not push the agent into choosing an arbitrary default.

4. Use advanced time events only when time controls the process.

   Durations such as "wait 4 minutes" can be task labels or documentation in simple descriptive models. Timer events are reserved for wait states, deadlines, escalations, SLA behavior, reminders, or automation semantics.

5. Localize semantic lint.

   Corporate semantic validation should not assume English imperative task names for Russian diagrams. It may still check for empty names, unlabeled branches, structural errors, and readability problems, but Russian labels should not create routine warnings solely because they do not begin with English verbs.

## Risks / Trade-offs

- More prescriptive authoring guidance may hide unusual but valid BPMN modeling choices. Mitigation: keep exceptions allowed when documented in assumptions or process documentation.
- Relaxing gateway default pressure could allow ambiguous branch handling. Mitigation: require labels or conditions on all non-default outgoing flows and report unlabeled branches as errors.
- Language-aware semantic rules may miss some style issues. Mitigation: keep style warnings informational and reserve warnings/errors for findings that affect comprehension, structure, or execution.
