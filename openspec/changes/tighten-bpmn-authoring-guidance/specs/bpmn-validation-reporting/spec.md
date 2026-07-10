## ADDED Requirements

### Requirement: Validate exclusive gateway branches without forcing arbitrary defaults
Validation SHALL detect ambiguous exclusive gateway branches without requiring an arbitrary default branch when all alternatives are explicitly labeled or conditioned.

#### Scenario: Explicit alternatives without default
- **WHEN** an exclusive gateway has multiple outgoing flows and each outgoing flow has a label or condition
- **THEN** validation does not report an error solely because no default branch exists

#### Scenario: Unlabeled alternatives without default
- **WHEN** an exclusive gateway has multiple outgoing flows and any outgoing flow lacks both a label and a condition
- **THEN** validation reports an error identifying the ambiguous branch

#### Scenario: Default branch exists
- **WHEN** an exclusive gateway declares a default branch
- **THEN** validation verifies that the default references one of the gateway outgoing targets or outgoing flow ids according to the documented YAML schema

### Requirement: Localize semantic style validation
Validation SHALL avoid English-only style warnings for non-English BPMN labels while preserving structural and comprehension checks.

#### Scenario: Russian task labels
- **WHEN** a non-executable or descriptive BPMN model uses Russian task labels that are non-empty and understandable
- **THEN** validation does not warn solely because the task name does not start with an English verb

#### Scenario: Gateway labels
- **WHEN** an exclusive gateway name is a clear decision phrase in Russian or another supported language
- **THEN** validation does not warn solely because the name is not written as an English question

#### Scenario: Empty or ambiguous labels
- **WHEN** tasks, gateways, or outgoing branches are empty or ambiguous
- **THEN** validation still reports the appropriate warning or error regardless of language
