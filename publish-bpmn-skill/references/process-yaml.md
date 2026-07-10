# Process YAML

`process.yaml` is the versioned source of truth. Unknown contract fields fail closed. Keep vendor data out of the model unless a future capability matrix explicitly documents an extension mapping.

## V1: One Process

Use v1 for one process and zero or one participant. Lanes represent responsibility inside that process.

```yaml
schema_version: 1
process:
  id: example-process
  name: Example Process
  executable: false
  target_engine: none

participants:
  - id: company
    name: Company
    lanes:
      - id: process-owner
        name: Process Owner

nodes:
  - id: start
    type: startEvent
    name: Request received
    lane: process-owner
  - id: handle-request
    type: userTask
    name: Handle request
    lane: process-owner
  - id: end
    type: endEvent
    name: Request handled
    lane: process-owner

flows:
  - id: flow-start-handle
    from: start
    to: handle-request
  - id: flow-handle-end
    from: handle-request
    to: end

message_flows: []
data: []
artifacts: []
extensions: {}
documentation:
  purpose: Describe why this process exists.
  assumptions: []
```

V1 message flows, multiple participants, non-empty data/artifacts, and arbitrary extensions are unsupported in 0.2.0. Use v2 for collaboration.

## V2: Multi-Process Collaboration

V2 scopes nodes, lanes, and sequence flows inside their owning processes. Each participant has one explicit `process_ref`; message flows cross ownership boundaries.

```yaml
schema_version: 2
definitions:
  id: order-definitions
  name: Order Collaboration
  target_namespace: http://corp.example/bpmn
processes:
  - id: customer-process
    name: Customer Process
    nodes:
      - id: customer-start
        type: startEvent
        name: Start
      - id: send-order
        type: sendTask
        name: Send order
      - id: customer-end
        type: endEvent
        name: Order sent
    flows:
      - id: customer-flow-1
        from: customer-start
        to: send-order
      - id: customer-flow-2
        from: send-order
        to: customer-end
  - id: supplier-process
    name: Supplier Process
    nodes:
      - id: supplier-start
        type: startEvent
        name: Ready
      - id: receive-order
        type: receiveTask
        name: Receive order
      - id: supplier-end
        type: endEvent
        name: Order received
    flows:
      - id: supplier-flow-1
        from: supplier-start
        to: receive-order
      - id: supplier-flow-2
        from: receive-order
        to: supplier-end
participants:
  - id: customer
    name: Customer
    process_ref: customer-process
  - id: supplier
    name: Supplier
    process_ref: supplier-process
message_flows:
  - id: order-message
    from: send-order
    to: receive-order
    label: Order
extensions: {}
documentation:
  purpose: Exchange an order between independent participants.
```

Sequence flows never cross process boundaries. Message-flow node endpoints are currently limited to send tasks, receive tasks, and intermediate catch/throw events; participant ids are also valid endpoints.

## Conditions and Defaults

Conditions are objects and are preserved as BPMN formal expressions:

```yaml
flows:
  - id: flow-approved
    from: decision
    to: approve-request
    label: Approved
    condition:
      body: riskScore <= 3
      language: FEEL
```

A real fallback is referenced by its outgoing sequence-flow id, never by a target node:

```yaml
nodes:
  - id: decision
    type: exclusiveGateway
    name: Which route?
    default: flow-other
```

The default flow may omit a label or condition. Every other outgoing exclusive branch must remain explicit.

## Version and Migration Rules

- New files always declare `schema_version`.
- Unversioned legacy files are interpreted as v1 for one transition release and produce `schema.version_implicit`.
- Legacy string conditions and target-node defaults are normalized only on that unversioned compatibility path and produce warnings.
- Canonical versioned files reject those legacy shorthands.
- `corp-bpmn migrate ... --to-version 2 --out ...` migrates v1 files with zero or one participant without changing the source.
- A v1 file with multiple participants fails migration as ambiguous; author explicit v2 process ownership instead.

## Common Shape Mistakes

- Do not put sequence-flow objects under `nodes`; use `flows` in the owning process.
- Do not use an undocumented `pools` key; use `participants`.
- Do not write lanes as strings; every lane needs `id` and `name`.
- Do not omit `id`, `from`, or `to` on a flow.
- Do not use lanes for methods, outcomes, or scenario variants.
- Do not put `actor`, `system`, arbitrary engine properties, or unknown fields on nodes in v1/v2 0.2.0.
- Do not use non-empty `data`, `artifacts`, or `extensions` until the capability matrix marks their mappings supported.
