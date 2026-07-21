## MODIFIED Requirements

### Requirement: Record source provenance and priority
The working model SHALL record only explicitly supplied source references with kind, URI, revision, fragment, content hash, and confidence and SHALL resolve them in the order explicit user decision, confirmed clarification, original user request, explicitly supplied user document, existing diagram, then agent assumption. The runtime SHALL NOT search for, select, or infer an applicable OpenSpec automatically.

#### Scenario: User explicitly supplies a specification document
- **WHEN** the user names or attaches a document as input to the diagram task
- **THEN** the extension hashes and records it as an explicitly supplied user document and includes it in semantic reconciliation without treating its presence as automatic repository discovery

#### Scenario: No additional document is supplied
- **WHEN** the user provides only a request and an optional existing diagram
- **THEN** analysis continues from those sources and recorded assumptions without searching the repository or claiming that an authoritative specification was selected

## ADDED Requirements

### Requirement: Persist one immutable source bundle
The host SHALL create a canonical hash-bound source bundle containing the original request, imported DiagramSpec, baseline validation, eligible review handoff, explicit documents, assumptions, decisions, and feedback revisions and SHALL pass the same bundle revision to every role and deterministic gate in that phase.

#### Scenario: Review findings continue into improve
- **WHEN** a hash-matching completed review is used by a subsequent improve command
- **THEN** the source bundle contains the reviewed artifact, validation report, receipt, Reviewer verdict, and structured findings with their hashes

#### Scenario: User supplies resume feedback
- **WHEN** a user continues a run with textual feedback
- **THEN** the host appends an immutable confirmed-clarification source record, creates a new source-bundle revision, and reconciles it against the accepted DiagramSpec

### Requirement: Separate preserved technical cells from model semantics
DiagramSpec SHALL preserve draw.io root, layer, wrapper, unknown, and technical cells for lossless artifact handling while its model-visible semantic view SHALL exclude technical roots such as cells `0` and `1` unless a contract explicitly marks them as business elements.

#### Scenario: Existing draw.io contains root and default layer cells
- **WHEN** the host imports a normal diagram containing technical cells `0` and `1`
- **THEN** original XML and DiagramSpec preservation data retain them but Semantic Analyst input does not list them as semantic nodes

### Requirement: Validate page-scoped semantic identities
The model-visible working graph SHALL identify each element by page and cell ID and SHALL validate parent, source, target, and page relationships before any role output is rendered or repaired.

#### Scenario: Duplicate cell IDs exist on different pages
- **WHEN** two pages legitimately contain the same local cell ID
- **THEN** their page-scoped stable identities remain distinct and validation accepts the document

#### Scenario: Parent or edge endpoint is invalid
- **WHEN** a plan references a missing parent, creates a parent cycle, or connects an endpoint on an incompatible page
- **THEN** deterministic validation reports the exact JSON Pointer and blocks rendering or patching
