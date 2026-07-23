import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import agent_runtime


class AgentRuntimeIntakeTests(unittest.TestCase):
    def test_layout_repair_selects_intent_contract_without_changing_semantic_patch(self):
        layout_payload = {
            "schema_version": 1,
            "repair_mode": "layout_intent",
            "run_id": "run-1",
        }
        semantic_payload = {"schema_version": 1, "run_id": "run-1"}
        self.assertEqual(
            agent_runtime.role_schema_name("repair", layout_payload),
            "layout-repair-intent.v1.schema.json",
        )
        self.assertEqual(
            agent_runtime.role_schema_name("repair", semantic_payload),
            "diagram-patch.v1.schema.json",
        )
        self.assertIn(
            "layout-repair-intent.v1.schema.json",
            agent_runtime.role_output_contract("repair", layout_payload),
        )

    def test_semantic_intake_phase_selects_intake_analysis_schema(self):
        payload = {
            "schema_version": 1,
            "phase": "intake",
            "mode": "create",
            "request": "Покажи сервисы и их зависимости",
            "existing_evidence": None,
            "answers": [],
        }
        self.assertEqual(
            agent_runtime.role_schema_name("semantic_analyst", payload),
            "diagram-intake-analysis.v1.schema.json",
        )
        contract = agent_runtime.role_output_contract("semantic_analyst", payload)
        self.assertIn("diagram-intake-analysis.v1.schema.json", contract)
        self.assertIn("host assigns", contract.lower())

    def test_intake_analysis_contract_rejects_host_owned_fields(self):
        payload = {
            "schema_version": 1,
            "phase": "intake",
            "mode": "create",
            "request": "Покажи сервисы",
            "existing_evidence": None,
            "answers": [],
        }
        output = {
            "schema_version": 1,
            "role": "semantic_analyst",
            "status": "ok",
            "result": {
                "diagram_type": "dependency",
                "confidence": 0.9,
                "alternatives": [],
                "sufficient": True,
                "blocking_questions": [],
                "assumptions": [],
                "intake_id": "model-owned",
            },
        }
        with self.assertRaises(Exception):
            agent_runtime.validate_role_output(
                "semantic_analyst", json.loads(json.dumps(output)), payload
            )


if __name__ == "__main__":
    unittest.main()
