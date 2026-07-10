# OpenSpec scenario coverage

Reviewed against the 101 scenarios in
`openspec/changes/harden-drawio-skill-contracts/specs/` on 2026-07-10.

| Capability | Positive coverage | Negative/edge coverage |
|---|---|---|
| `gitflow-input-contract` | `GitflowValidationTests`, `GitflowGeneratorTests`, `GitflowContractTests.test_out_of_order_and_ties_use_normalized_chronology`, `GitflowFindingFixtureTests.test_date_order_and_custom_positive_fixtures_run_full_strict_pipeline` | `GitflowFindingFixtureTests.test_negative_fixture_matrix_covers_every_gitflow_finding_code` loads `fixtures/gitflow/negative_cases.json` and covers all 28 structural, reference, lifecycle, and policy finding codes |
| `drawio-artifact-validation` | `RoadmapContractTests.test_every_scale_validates_generates_profiles_and_is_deterministic`, `DeterminismTests`, `ExportSmokeTests` | `ArtifactFindingFixtureTests` covers malformed XML, structural/readability fixtures, every roadmap/git-flow semantic mismatch profile code, double-escaped text, and generic-code fallbacks; `ExportFindingFixtureTests` covers all 8 export codes including truncated `IEND` |
| `roadmap-diagram-skill` | `SelfCheckTests`, clean-venv full suite, `RoadmapDocumentationTests`, `ContractDocumentationTests` | unsupported-version, invalid-schema, missing-dependency/version-boundary helper tests |
| `roadmap-yaml-model` | `RoadmapFindingFixtureTests.test_all_scales_with_and_without_baseline_are_strict_positive` covers week/month/quarter/date/order both with and without baseline; every baseline fixture also generates and passes strict source-aware profile validation | `RoadmapFindingFixtureTests.test_negative_fixture_matrix_covers_every_roadmap_finding_code` loads `fixtures/roadmap/negative_cases.json` and covers all 29 negative schema/contract/reference/semantic codes plus the valid `roadmap.lanes.defaulted` informational path |
| `roadmap-rendering` | five-scale strict profile pipelines, baseline shift fixture, dense fixture, outcomes/status/risk regression | wrong-coordinate, double-escaped-label, overlap/text-fit, missing-reference regressions |

The final verification additionally runs every valid bundled roadmap and
git-flow source through strict source validation, generation, source-aware
artifact validation, and deterministic double generation. Representative
roadmap and git-flow artifacts are exported by the real local draw.io Desktop
CLI and checked for PNG signature and terminal `IEND`.

The exhaustive fixture matrices are intentionally separate from wording-based
assertions: every case declares stable expected finding codes, and each test
also asserts that the union covers the complete registry for that validator.
