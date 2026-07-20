## Why

The lifecycle commands currently expose implementation-oriented `--diagram` and `--request` flags for every invocation, even though GigaCode already has a working directory and the user's natural-language request. This makes the extension feel like a shell wrapper instead of an agent-facing diagram product.

## What Changes

- Add a conversational `/drawio:create "request"` form that uses the current workspace and generates a collision-safe `.drawio` filename.
- Add conversational improve and review forms that automatically select the only `.drawio` in the workspace or return a clear selection request when the choice is ambiguous.
- Keep the existing explicit flags and absolute/relative paths fully supported for automation and advanced use.
- Return the resolved workspace, target diagram, selection reason, and exact next command in structured host output.
- Bump and publish the offline extension as `1.23.0-corporate.2` without replacing the previous release branch.

## Capabilities

### New Capabilities

- `diagram-conversational-command-ux`: Natural-language-first lifecycle commands with deterministic workspace defaults, safe filename generation, and ambiguity handling.

### Modified Capabilities


## Impact

Affected areas are the draw.io custom-command definitions, orchestration argument normalization, host results, tests, user documentation, installer/verifier metadata, release inventory, and offline ZIP.
