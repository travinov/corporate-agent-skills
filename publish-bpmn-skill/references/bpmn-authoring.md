# BPMN Authoring

Use BPMN semantics, not generic box-and-arrow notation.

Default choices:

- Start/end: `startEvent`, `endEvent`.
- Work: `userTask`, `serviceTask`, `manualTask`, `businessRuleTask`.
- Either/or decision: `exclusiveGateway` with labeled outgoing flows.
- All branches in parallel: `parallelGateway`.
- Roles in one organization/process: lanes.
- Independent organizations/processes: participants/pools with message flows.

## Variants and Responsibility Partitions

Model alternatives such as V60, French press, and espresso as outgoing branches of one `exclusiveGateway` when they belong to the same process and responsibility context. A method, product option, result, or scenario is not a lane.

Use a lane only when it identifies who or what is responsible for work: an actor, role, system, department, tool, or other stable responsibility partition. Assign every node that belongs to that responsibility to the same lane. If each variant is genuinely performed by a different responsible role or system, lanes may be appropriate; the reason is the responsibility boundary, not the existence of variants.

## Exclusive Gateway Branches

Give each deliberate alternative an outgoing sequence-flow `label` or `condition`. A gateway does not need a default when every alternative is explicit.

Use `default` only when one branch has real fallback semantics, for example:

- other or unknown;
- no option selected;
- timeout or exception handling;
- a business-defined default action.

Do not select an arbitrary alternative merely to satisfy validation. In canonical versioned `process.yaml`, `default` identifies only the outgoing sequence-flow id. A target node id is rejected. A default flow may omit a label or condition, but every other outgoing flow must remain explicit.

## Durations and Timers

Keep descriptive durations in a task name, task documentation, or `documentation.assumptions`, for example `Wait 4 minutes`. Do not add a timer event when the duration is only explanatory.

Use a timer catch event or timer boundary event only when time changes control flow: a wait state, deadline, escalation, SLA, reminder, timeout, or automation trigger. Record the semantic reason in `documentation.advanced_elements` or `documentation.assumptions`.

Advanced constructs are allowed but not default:

- `boundaryEvent` for timeout/error/message behavior attached to a specific activity.
- `subProcess` for a large reusable or collapsible fragment.
- `transaction`/compensation only for real transactional semantics.
- `eventBasedGateway` when branches race on external events.
- multi-process collaboration only through schema v2 with process-scoped elements and participant `process_ref`.

The installed capability matrix is authoritative. In 0.2.0, ad-hoc subprocesses, choreography, conversation, data/artifact generation, and arbitrary engine extensions are unsupported and must fail before generation. A transaction is partial because it requires manual layout/engine review and therefore fails strict mode.

When using an advanced construct, document why in `documentation.advanced_elements` or `documentation.assumptions`.
