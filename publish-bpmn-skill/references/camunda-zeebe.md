# Camunda and Zeebe

Set `process.target_engine` when execution readiness matters:

- `none`: no engine-specific requirements.
- `camunda-platform`: Camunda 7 style checks.
- `zeebe`: Camunda 8 / Zeebe style checks.
- `flowable`, `activiti`, `corporate`: reserved profiles.

Engine checks are separate from BPMN correctness. Version 0.3.0 preserves only the neutral BPMN contract and does not accept arbitrary Camunda/Zeebe extension fields. Selecting an engine profile may therefore produce implementation-review warnings for service tasks. Do not add undeclared fields to silence them; wait for a capability-matrix-supported extension mapping or keep the model descriptive with `target_engine: none`.
