## Why

The extended draw.io skill now accepts roadmap and git-flow data that can pass shallow validation while rendering the wrong chronology, losing declared fields, or corrupting XML labels. The installable skill needs versioned input contracts and end-to-end artifact validation before these generators can be trusted on corporate diagrams.

## What Changes

- Add versioned JSON Schemas for roadmap and git-flow inputs, with unversioned inputs temporarily treated as v1 with a deprecation warning.
- Separate structural schema validation from reference, chronology, and business-semantic validation.
- Correct roadmap escaping, time-scale behavior, milestone outcomes, risk/status rendering, and declared baseline comparison behavior.
- Correct git-flow event requirements and stable semantic ordering before layout.
- Add deterministic generation, strict Draw.io structural validation, and real export smoke coverage.
- Declare and verify the Python dependencies required by the extended generators.

## Capabilities

### New Capabilities

- `gitflow-input-contract`: Define the versioned git-flow JSON model, event-specific required fields, semantic chronology checks, and deterministic layout contract.
- `drawio-artifact-validation`: Define structural, semantic-coordinate, text-integrity, and export validation for generated `.drawio` artifacts.

### Modified Capabilities

- `roadmap-yaml-model`: Version and tighten the roadmap contract, including the supported time-scale variants and baseline references.
- `roadmap-rendering`: Require lossless labels, correct time semantics, milestone outcomes, risk/status treatment, and deterministic output.
- `roadmap-diagram-skill`: Require schema and semantic validation before generation and strict artifact validation before completion.

## Impact

- Affects `publish-drawio-skill/data`, roadmap/git-flow generators and validators, references, tests, and dependency manifests.
- Keeps the draw.io skill independent from `bpmn-architect` and local-first.
- Does not require Graphviz; builtin routing remains the supported fallback.
