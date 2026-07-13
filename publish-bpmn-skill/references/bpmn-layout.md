# BPMN Layout

BPMN DI stores the visual diagram: shapes, bounds, and edge waypoints. `corp-bpmn layout` uses the public `bpmn-auto-layout` API per executable process, composes dynamic participant bounds, preserves authored lanes and boundary attachments, and routes messages orthogonally from endpoint boundaries.

Layout validation checks:

- expected BPMN shapes exist;
- expected BPMN edges exist;
- bounds are positive and readable;
- severe overlaps are reported;
- endpoints are docked to source/target boundaries;
- routes avoid unrelated flow-node interiors and duplicate routes are staggered;
- nodes remain inside their owning participant and authored lane;
- advanced element families may emit capability warnings.

Error-level spatial findings block layout/build. Normal mode may retain readability warnings, while strict mode blocks them. Do not declare completion while any strict `layout.*` blocker remains.

Schema v2 collaboration may contain multiple process planes/pools. Layout must never rewrite participant ownership or convert cross-process message flows into sequence flows. A partial layout capability is a warning in normal mode and a failure in strict mode, while semantic round-trip remains mandatory.
