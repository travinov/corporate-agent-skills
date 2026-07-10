## Why

The BPMN toolchain currently accepts fields that are not preserved in generated BPMN XML, and its flat collaboration model can attach multiple participants to one process. A valid parse therefore does not guarantee that the business semantics authored in `process.yaml` survived generation.

## What Changes

- Introduce explicit schema versions and strict, fail-closed validation for the BPMN YAML model.
- Preserve sequence-flow conditions and canonical default-flow references in generated BPMN XML.
- Validate forward references, supported element shapes, engine extensions, and every accepted field before generation.
- Add semantic round-trip validation from YAML through BPMN XML back to a normalized model.
- **BREAKING**: introduce a v2 collaboration model with scoped `processes[]`, participant `process_ref`, and message flows across processes; provide migration for unambiguous v1 single-process inputs.
- Replace unsupported “full BPMN” claims with a tested capability matrix until each family is supported end to end.

## Capabilities

### New Capabilities

- `bpmn-semantic-roundtrip`: Verify that generated BPMN preserves conditions, defaults, ownership, events, extensions, and message endpoints.
- `bpmn-collaboration-v2`: Define multi-process collaboration, migration, and cross-participant message-flow semantics.

### Modified Capabilities

- `process-yaml-model`: Add schema versioning, strict accepted shapes, fail-closed unsupported fields, and the v2 collaboration form.
- `corp-bpmn-cli`: Generate and validate the versioned contracts and expose stable machine-readable findings.
- `bpmn-validation-reporting`: Add round-trip, capability, migration, and stable finding-code layers.
- `bpmn-architect-skill`: Route authoring through the correct versioned model and report unsupported capabilities honestly.

## Impact

- Affects the BPMN JSON Schema, YAML validator, generator, validator, CLI commands, documentation, fixtures, and tests in `publish-bpmn-skill`.
- Keeps all process content local and uses the existing approved Node dependency set.
- Unversioned files remain accepted as v1 for a transition release with a warning.
