## Context

The command Markdown already runs a deterministic Python host with the current directory as `--workspace`, but the Python parser still requires shell-style flags for every lifecycle action. The extension must become natural-language-first without making target selection or publication ambiguous and without breaking existing automated callers.

## Goals / Non-Goals

**Goals:**

- Support `/drawio:create "request"`, `/drawio:improve "request"`, `/drawio:review`, `/drawio:resume <decision> [feedback]`, and `/drawio:trace` from the current workspace.
- Keep all existing explicit `--diagram`, `--request`, `--run`, `--decision`, and `--feedback` forms.
- Generate readable collision-safe filenames and never overwrite an existing create target.
- Auto-select only when selection is deterministic; otherwise return actionable candidates without starting model work.
- Include resolved inputs and short next commands in host results.

**Non-Goals:**

- Removing the explicit automation interface.
- Recursively searching arbitrary subdirectories for diagrams.
- Guessing among multiple editable diagrams or multiple pending runs.
- Changing role routing, validation, repair, review, or acceptance behavior.

## Decisions

1. Add a small shared `command_ux.py` module used by both lifecycle and review hosts. Centralizing normalization prevents the custom-command Markdown and individual hosts from drifting.
2. Treat positional text as the request. When the first positional token ends in `.drawio`, treat it as an optional short-form target/source and join the remaining tokens as the request.
3. Generate create targets from a normalized Unicode slug after removing common Russian/English create-diagram prefixes. Limit the slug and add `-2`, `-3`, and so on on collisions. Explicit and generated create targets must not exist at start or publication.
4. For improve/review, auto-select only when exactly one non-hidden `.drawio` exists at workspace root. Zero or multiple files produce a structured selection error before preflight or model invocation.
5. For resume, auto-select only when exactly one run has a pending checkpoint. For trace, select the most recently updated workflow because trace is read-only. Explicit run identifiers always win.
6. Preserve argparse flags as the stable advanced interface and normalize both syntaxes into the same existing host functions.

## Risks / Trade-offs

- [Risk] Natural-language filenames may contain Unicode characters. → Use filesystem-safe normalization and preserve explicit `--diagram` for ASCII naming policies.
- [Risk] Multiple diagrams or pending runs make implicit selection unsafe. → Fail before agent execution and list exact candidates.
- [Risk] A create target appears between planning and publication. → Recheck non-existence immediately before atomic publication.
- [Risk] Qwen argument escaping differs across corporate builds. → Keep parsing entirely in Python and retain explicit flag syntax as fallback.

## Migration Plan

Publish `1.23.0-corporate.2` on a new branch and offline ZIP. Existing commands continue unchanged. The installer replaces the active extension under the same extension name while the prior branch and ZIP remain available for rollback.

## Open Questions

None. Ambiguity is handled fail-closed rather than through model guessing.
