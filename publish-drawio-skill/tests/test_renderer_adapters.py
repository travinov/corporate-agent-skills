import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import renderer_adapters
from lifecycle_contracts import canonical_json_sha256


SHA = "a" * 64


def sequence_plan():
    request_content = {"request": "Create a sequence diagram"}
    source_bundle = {
        "schema_version": 2,
        "bundle_id": "bundle-sequence",
        "run_id": "run-sequence",
        "revision": 1,
        "created_at": "2026-07-23T00:00:00Z",
        "source_priority": [
            "explicit_user_decision",
            "confirmed_clarification",
            "original_user_request",
            "explicit_user_document",
            "existing_diagram",
            "agent_assumption",
        ],
        "sources": [
            {
                "source_id": "source-request",
                "kind": "original_user_request",
                "uri": "request://run-sequence",
                "revision": None,
                "fragment": None,
                "content_sha256": canonical_json_sha256(request_content),
                "confidence": 1,
                "content": request_content,
            }
        ],
        "evidence": {
            "imported_diagramspec": None,
            "baseline_validation": None,
            "eligible_review_handoff": None,
        },
        "transaction_id": "transaction-sequence",
        "previous_bundle_sha256": None,
        "previous_snapshot_sha256": None,
    }
    source_hash = canonical_json_sha256(source_bundle)
    plan = {
        "schema_version": 2,
        "role": "semantic_analyst",
        "status": "ok",
        "run_id": "run-sequence",
        "source_bundle_sha256": source_hash,
        "baseline_semantic_digest": SHA,
        "result": {
            "mode": "create",
            "diagram_type": "sequence",
            "title": "Sequence",
            "direction": "LR",
            "pages": [
                {
                    "page_id": "sequence-page",
                    "name": "Sequence",
                    "nodes": [
                        {
                            "stable_identity": {"page_id": "sequence-page", "cell_id": "user"},
                            "label": "User",
                            "semantic_type": "actor",
                            "parent": None,
                            "style_hint": None,
                        },
                        {
                            "stable_identity": {"page_id": "sequence-page", "cell_id": "api"},
                            "label": "API",
                            "semantic_type": "participant",
                            "parent": None,
                            "style_hint": None,
                        },
                    ],
                    "edges": [
                        {
                            "stable_identity": {"page_id": "sequence-page", "cell_id": "m1"},
                            "source": {"page_id": "sequence-page", "cell_id": "user"},
                            "target": {"page_id": "sequence-page", "cell_id": "api"},
                            "label": "request",
                            "relationship": "async",
                            "parent": None,
                            "style_hint": None,
                        },
                        {
                            "stable_identity": {"page_id": "sequence-page", "cell_id": "m2"},
                            "source": {"page_id": "sequence-page", "cell_id": "api"},
                            "target": {"page_id": "sequence-page", "cell_id": "user"},
                            "label": "response",
                            "relationship": "return",
                            "parent": None,
                            "style_hint": None,
                        },
                    ],
                }
            ],
            "semantic_delta": {
                "schema_version": 2,
                "baseline_semantic_digest": SHA,
                "source_bundle_sha256": source_hash,
                "operations": [],
            },
            "assumptions": [],
            "requires_human": False,
            "human_questions": [],
        },
    }
    return plan, source_bundle


class RendererAdapterTests(unittest.TestCase):
    def test_generic_adapter_uses_new_lineage_and_explicit_legacy_backend(self):
        adapter = renderer_adapters.select_adapter("flowchart").adapter
        self.assertEqual(adapter.adapter_id, "generic-v2")
        self.assertEqual(
            adapter.implementation_paths,
            (
                "scripts/layout_model.py",
                "scripts/layout_backend.py",
                "scripts/layout_builtin.py",
                "scripts/layout_renderer.py",
                "scripts/elk_runner.mjs",
                "vendor/elkjs/elk.bundled.js",
            ),
        )
        self.assertEqual(adapter.normalize_options()["backend"], "auto")
        self.assertEqual(adapter.normalize_options()["reflow"], "preserve")
        self.assertEqual(
            adapter.normalize_options({"backend": "legacy-generic-v2"})["backend"],
            "legacy-generic-v2",
        )
        with self.assertRaises(renderer_adapters.AdapterConfigurationError):
            adapter.normalize_options({"backend": "generic-v2"})
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "legacy.drawio"

            def legacy_renderer(_plan, path):
                path.write_text("<mxfile/>", encoding="utf-8")

            with self.assertRaisesRegex(
                renderer_adapters.AdapterConfigurationError, "legacy-generic-v2"
            ):
                renderer_adapters.render_with_adapter(
                    "generic", {"result": {}}, output, generic_renderer=legacy_renderer
                )
            renderer_adapters.render_with_adapter(
                "generic",
                {"result": {}},
                output,
                options={"backend": "legacy-generic-v2"},
                generic_renderer=legacy_renderer,
            )

    def test_specialized_adapter_paths_and_defaults_are_unchanged(self):
        roadmap = renderer_adapters.select_adapter("roadmap").adapter
        git_flow = renderer_adapters.select_adapter("git-flow").adapter
        c4 = renderer_adapters.select_adapter("c4").adapter
        self.assertEqual(
            roadmap.implementation_paths,
            ("scripts/roadmap.py", "scripts/roadmap_validate.py", "scripts/roadmap_timeline.py"),
        )
        self.assertEqual(git_flow.implementation_paths, ("scripts/gitflow.py", "scripts/gitflow_validate.py"))
        self.assertEqual(git_flow.normalize_options(), {"route": "auto"})
        self.assertEqual(c4.implementation_paths, ("scripts/c4.py", "scripts/autolayout.py"))
        self.assertEqual(c4.normalize_options(), {"direction": "TB"})

    def test_sequence_local_is_selected_without_explicit_renderer_source(self):
        plan, source_bundle = sequence_plan()
        selected = renderer_adapters.select_lifecycle_adapter_input(plan, source_bundle, mode="create")
        self.assertEqual(selected.selection.adapter.adapter_id, "sequence-local")
        self.assertIsNone(selected.source_record)
        self.assertEqual(selected.selection.adapter.supported_modes, ("create",))
        self.assertEqual(
            selected.selection.adapter.implementation_paths,
            ("scripts/sequence_adapter.py", "scripts/seqlayout.py"),
        )

    def test_sequence_wrapper_preserves_message_order_and_renders_locally(self):
        plan, _ = sequence_plan()
        from sequence_adapter import semantic_plan_to_sequence

        spec = semantic_plan_to_sequence(plan)
        self.assertEqual([message["label"] for message in spec["messages"]], ["request", "response"])
        self.assertTrue(spec["messages"][0]["async"])
        self.assertTrue(spec["messages"][1]["return"])
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "sequence.drawio"
            run = renderer_adapters.render_with_adapter("sequence", plan, output, mode="create")
            self.assertEqual(run.selection.adapter.adapter_id, "sequence-local")
            self.assertIn(b'id="m0"', output.read_bytes())
            self.assertIn(b'id="m1"', output.read_bytes())

    def test_sequence_rejects_unknown_participant_and_improve_does_not_full_reflow(self):
        plan, source_bundle = sequence_plan()
        plan["result"]["pages"][0]["edges"][0]["target"]["cell_id"] = "missing"
        from sequence_adapter import SequenceAdapterError, semantic_plan_to_sequence

        with self.assertRaises(SequenceAdapterError):
            semantic_plan_to_sequence(plan)

        valid, source_bundle = sequence_plan()
        selected = renderer_adapters.select_lifecycle_adapter_input(valid, source_bundle, mode="improve")
        self.assertEqual(selected.selection.adapter.adapter_id, "generic-v2")
        self.assertEqual(selected.options["reflow"], "preserve")
        self.assertEqual(selected.fallback_reason, "specialized_mode_unsupported")


if __name__ == "__main__":
    unittest.main()
