## 1. Skill Authoring Guidance

- [x] 1.1 Update `publish-bpmn-skill/SKILL.md` to mention first-draft YAML quality, branch-vs-lane modeling, gateway defaults, and duration-vs-timer policy.
- [x] 1.2 Update `references/bpmn-authoring.md` with concrete BPMN modeling guidance for variants, lanes, exclusive gateways, defaults, and timer usage.
- [x] 1.3 Update `references/process-yaml.md` with a canonical minimal valid `process.yaml` skeleton and common shape mistakes to avoid.
- [x] 1.4 Update `references/bpmn-intake.md` so intake distinguishes process variants from responsibility partitions before choosing lanes.

## 2. Validation Behavior

- [x] 2.1 Adjust semantic validation so an exclusive gateway with all outgoing flows labeled or conditioned does not require a default branch.
- [x] 2.2 Keep error-level findings for exclusive gateway outgoing flows that lack both labels and conditions when no valid default semantics are present.
- [x] 2.3 Adjust language-sensitive style checks so Russian task and gateway labels do not trigger English-only verb/question warnings.
- [x] 2.4 Verify default-branch validation accepts only documented gateway target or flow references.

## 3. Tests and Packaging

- [x] 3.1 Add or update fixtures covering a three-method coffee process without lanes-as-variants and without arbitrary default flow.
- [x] 3.2 Add tests for localized Russian labels that should not produce English-only style warnings.
- [x] 3.3 Run `npm test` in `publish-bpmn-skill/scripts/corp-bpmn`.
- [x] 3.4 Rebuild and verify the skill ZIP if implementation files change.
