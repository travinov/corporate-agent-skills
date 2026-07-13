## MODIFIED Requirements

### Requirement: Apply BPMN DI layout
The CLI SHALL add or update BPMN DI layout information for generated BPMN XML and SHALL reject produced geometry that contains error-level spatial defects.

#### Scenario: Layout command
- **WHEN** the user runs `corp-bpmn layout process.bpmn --out process.bpmn`
- **THEN** the output contains `bpmndi:BPMNDiagram` and boundary-anchored visual bounds and waypoints for applicable elements

#### Scenario: Collaboration layout
- **WHEN** layout processes a schema-v2 collaboration with branching internal processes
- **THEN** it creates deterministic multi-level process geometry, dynamic participant bounds, and obstacle-aware message routes

#### Scenario: Layout cannot avoid a structural collision
- **WHEN** produced geometry contains a detached endpoint, route through an unrelated shape, or shape outside its owner
- **THEN** the command reports a layout error and exits with the documented layout failure code
