## ADDED Requirements

### Requirement: Build two independent skill artifacts
The release system SHALL build one extended draw.io skill ZIP and one BPMN Architect skill ZIP without nesting either skill inside the other.

#### Scenario: Full local release build
- **WHEN** the release command builds all skills
- **THEN** it produces two separately named archives with independent versions and manifests

### Requirement: Check dependencies before packaging
The release system SHALL check declared Python, Node, draw.io, and optional Graphviz dependencies before building an affected skill.

#### Scenario: Required package is available
- **WHEN** preflight resolves every required package from the configured environment or approved registry
- **THEN** the report records package identity and version and permits the build to continue

#### Scenario: Required package is unavailable
- **WHEN** a required dependency cannot be imported or resolved
- **THEN** the build fails before writing a release archive and identifies the missing dependency

#### Scenario: Optional Graphviz is unavailable
- **WHEN** Graphviz is absent but the draw.io builtin routing fallback is available
- **THEN** preflight records a warning and does not fail the draw.io build

### Requirement: Package from an explicit runtime allowlist
Each skill archive SHALL contain only paths declared by its release manifest and SHALL reject forbidden metadata, caches, dependency directories, temporary files, and undeclared generated artifacts.

#### Scenario: Source contains macOS or cache metadata
- **WHEN** `.DS_Store`, `__pycache__`, `.git`, or `node_modules` exists below a source directory
- **THEN** none of those paths appears in the archive

#### Scenario: Required runtime file is missing
- **WHEN** an allowlisted schema, script, reference, license, or skill instruction file does not exist
- **THEN** packaging fails with the missing relative path

### Requirement: Produce deterministic archive manifests
The release system SHALL sort archive entries, normalize archive metadata, and write a machine-readable manifest containing the SHA-256 of every packaged file.

#### Scenario: Same commit is built twice
- **WHEN** the same source and release configuration are built twice on the supported runtime
- **THEN** the archive manifests are identical and the ZIP checksums are reproducible

### Requirement: Keep skill versions consistent
The release system SHALL verify that each skill's declared version agrees across all version-bearing files configured for that skill.

#### Scenario: Metadata version differs from skill version
- **WHEN** any configured version source disagrees
- **THEN** packaging fails and reports every conflicting file and value

### Requirement: Verify archives in clean temporary installations
The release system SHALL unpack each ZIP into a new temporary directory and run that skill's schema compilation, self-check, representative generation, validation, and selected tests from the unpacked tree.

#### Scenario: Source tests pass but archive is stale
- **WHEN** the source tree passes tests but an archive omits or changes a required file
- **THEN** archive parity or unpacked smoke validation fails the release

### Requirement: Use one checksum convention
The release system SHALL generate checksum records with archive basenames that are verifiable from the `dist` directory using one documented command.

#### Scenario: User verifies both downloaded archives
- **WHEN** the user runs the documented checksum command in `dist`
- **THEN** both skill ZIPs verify without path rewriting or changing working-directory conventions

### Requirement: Keep installed skills locally executable
The packaged skills SHALL perform generation and validation without sending diagram or process content to external services.

#### Scenario: Installed skill runs after dependencies are installed
- **WHEN** a user invokes runtime generation or validation from an unpacked skill
- **THEN** all content processing remains local and does not require release tooling or network access
