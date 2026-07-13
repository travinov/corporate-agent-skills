## ADDED Requirements

### Requirement: Detect spatial BPMN defects
Validation SHALL evaluate BPMN DI geometry in artifact-only and source-aware modes and SHALL emit stable findings for invalid waypoints, detached endpoints, routes through unrelated shapes, shapes outside participants or lanes, unintended shape overlap, duplicate routes, independent edge crossings, and overlapping participants.

#### Scenario: Edge endpoint is detached
- **WHEN** the first or last waypoint does not lie on the referenced source or target boundary within tolerance
- **THEN** validation emits `layout.endpoint.detached` as an error identifying the edge

#### Scenario: Route crosses an unrelated node
- **WHEN** an edge segment passes through the interior of a non-endpoint flow-node shape
- **THEN** validation emits `layout.route.through_shape` as an error identifying the edge and obstacle

#### Scenario: Shape escapes ownership bounds
- **WHEN** a node lies outside its participant or an authored lane-assigned node lies outside that lane
- **THEN** validation emits `layout.shape.outside_pool` or `layout.shape.outside_lane` as an error

#### Scenario: Readability warning exists
- **WHEN** shapes overlap, routes duplicate, or independent routes cross without invalidating BPMN semantics
- **THEN** validation emits a stable warning and normal mode may pass while strict mode fails

#### Scenario: Waypoints are unusable
- **WHEN** an edge has fewer than two finite numeric waypoints
- **THEN** validation emits `layout.edge.invalid_waypoints` as an error

### Requirement: Preserve spatial finding identity across validation modes
Spatial findings SHALL use the same `layer`, `code`, `element`, and geometry interpretation whether validation starts from generated source or an existing BPMN artifact.

#### Scenario: Mutated artifact is validated without YAML
- **WHEN** artifact-only validation encounters a detached or obstructed route
- **THEN** it reports the same stable finding code used by source-aware build validation
