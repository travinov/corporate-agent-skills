# BPMN Layout

BPMN DI stores the visual diagram: shapes, bounds, and edge waypoints. `corp-bpmn layout` uses `bpmn-auto-layout` to add BPMN DI.

Layout validation checks:

- expected BPMN shapes exist;
- expected BPMN edges exist;
- bounds are positive and readable;
- severe overlaps are reported;
- advanced element families may emit capability warnings.

Layout warnings are not semantic failures. If XML is valid but layout confidence is partial, tell the user the `.bpmn` should open in a BPMN modeler for manual visual review.

Schema v2 collaboration may contain multiple process planes/pools. Layout must never rewrite participant ownership or convert cross-process message flows into sequence flows. A partial layout capability is a warning in normal mode and a failure in strict mode, while semantic round-trip remains mandatory.
