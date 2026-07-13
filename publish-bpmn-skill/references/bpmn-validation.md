# BPMN Validation

Validation is fail-closed and layered:

1. YAML parse and schema-version dispatch.
2. JSON Schema 2020-12 validation.
3. Capability and scoped reference validation.
4. Corporate semantic validation.
5. BPMN generation and artifact parse.
6. Source-to-artifact semantic round-trip.
7. BPMN DI/layout, bpmnlint, and engine-profile checks.

`validation-report.json` has its own `report_version`, independent `schema_version`, declared-version metadata, preservation status, summary, and findings. Automation must key on `layer`, `severity`, `code`, `path`, and `element`; message text is explanatory, not a stable API.

Important codes include:

- `schema.version_implicit`, `schema.version_invalid`, `schema.version_unsupported`;
- `schema.required`, `schema.additional_property`, `schema.variant`;
- `references.duplicate_id`, `references.unresolved_*`, `references.invalid_default`;
- `capability.unsupported`, `capability.partial`;
- `roundtrip.condition_missing`, `roundtrip.process_ownership`, and other `roundtrip.*` mismatches;
- `migration.ambiguous_process_ownership`.
- `layout.edge.invalid_waypoints`, `layout.endpoint.detached`, `layout.route.through_shape`;
- `layout.shape.outside_pool`, `layout.shape.outside_lane`, `layout.shape.overlap`;
- `layout.route.duplicate`, `layout.route.crossing`, `layout.pool.overlap`;
- `semantic.message_endpoint.participant_ambiguous`.

Normal mode allows warnings. `--strict` treats every warning as a failure, including partial capability, layout, bpmnlint, and engine warnings.

Do not treat all cycles as errors. A rework loop with a reachable exit is valid. A cycle without a reachable path to an end event is an error.

Artifact-only `validate` cannot prove preservation; it reports `roundtrip.not_evaluated`. Supply `--yaml` or use `build` before claiming that authored semantics survived generation.

Fix errors in `process.yaml`, then rebuild. Never repair generated XML as the source of truth.
