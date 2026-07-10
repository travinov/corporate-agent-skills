# Troubleshooting

| Problem | Action |
|---|---|
| `Cannot find package` | Check the configured approved registry, then run `npm ci` in `scripts/corp-bpmn` |
| YAML schema errors | Fix `process.yaml`; do not edit generated BPMN XML |
| Layout fails | Run `generate` first, then `layout`; inspect XML parse errors |
| Validation reports cycle | Check whether the loop has a reachable exit to an end event |
| `schema.version_implicit` | Add explicit `schema_version: 1`, then convert legacy conditions/defaults to canonical form |
| `capability.unsupported` | Remove the field/family or choose a supported semantic alternative; do not rely on generator fallback |
| `roundtrip.*` | Treat as a toolchain defect or semantic loss; do not claim completion even if XML parses |
| Ambiguous v1 migration | Author explicit v2 `processes[]` and participant `process_ref` ownership |
| Service task warnings | Keep `target_engine: none` for descriptive BPMN or wait for a supported engine extension mapping |
| BPMN opens but looks crowded | Treat layout warnings as visual review items in a BPMN modeler |
