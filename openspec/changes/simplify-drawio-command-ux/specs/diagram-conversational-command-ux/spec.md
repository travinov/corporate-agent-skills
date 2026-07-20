## ADDED Requirements

### Requirement: Conversational create command
The extension SHALL accept a natural-language request as the only argument to `/drawio:create`, SHALL use the current workspace, and SHALL choose a readable collision-safe `.drawio` target without overwriting an existing file.

#### Scenario: Request-only creation
- **WHEN** the user runs `/drawio:create "Создай диаграмму обработки заказа"` from a workspace
- **THEN** the host SHALL resolve the quoted text as the request, generate a target inside that workspace, and run the normal multi-agent creation workflow

#### Scenario: Generated filename collision
- **WHEN** the preferred generated filename already exists
- **THEN** the host SHALL choose a new suffixed filename and SHALL NOT replace the existing file

### Requirement: Conversational existing-diagram commands
The extension SHALL allow improve and review commands to omit the diagram path only when exactly one eligible `.drawio` exists at the workspace root.

#### Scenario: One diagram is present
- **WHEN** the user runs `/drawio:improve "Исправь маршруты стрелок"` or `/drawio:review` and exactly one `.drawio` is present
- **THEN** the host SHALL select it and report the resolved path and selection reason

#### Scenario: Diagram selection is ambiguous
- **WHEN** zero or multiple eligible `.drawio` files are present and no explicit path was supplied
- **THEN** the host SHALL start no role or validator work and SHALL return an actionable list or instruction for explicit selection

### Requirement: Conversational resume and trace commands
The extension SHALL allow a human decision without a run id when exactly one pending run exists and SHALL allow trace without a run id by selecting the most recently updated run.

#### Scenario: Resume the only pending run
- **WHEN** the user runs `/drawio:resume continue "Сохрани существующие роли"` and exactly one run has a pending checkpoint
- **THEN** the host SHALL apply the decision and feedback to that run and report the resolved run id

#### Scenario: Pending run selection is ambiguous
- **WHEN** more than one run has a pending checkpoint
- **THEN** the host SHALL modify no run and SHALL list the pending run ids for explicit selection

#### Scenario: Trace the latest run
- **WHEN** the user runs `/drawio:trace` without a run id
- **THEN** the read-only host SHALL trace the most recently updated workflow and report why it was selected

### Requirement: Advanced syntax compatibility
All existing explicit lifecycle flags SHALL remain supported and SHALL normalize to the same deterministic host behavior as conversational syntax.

#### Scenario: Existing automation command
- **WHEN** a caller supplies `--diagram`, `--request`, `--run`, `--decision`, or `--feedback` in the previous supported combinations
- **THEN** the command SHALL retain its previous meaning and validation behavior

### Requirement: Resolved input and next-command guidance
Every conversational lifecycle result SHALL expose the resolved workspace, diagram or run selection, selection reason, and concise valid next commands at a human checkpoint.

#### Scenario: Human checkpoint result
- **WHEN** a run stops at semantic approval, plateau, or final acceptance
- **THEN** the result SHALL show short resume commands that do not require a run id when automatic selection is unambiguous and SHALL also retain the explicit run id
