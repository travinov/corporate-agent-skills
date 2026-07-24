import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import command_ux


class IntakeCommandUXTests(unittest.TestCase):
    def test_intake_answers_parse_stable_question_bindings(self):
        answers = command_ux.parse_intake_answers([
            "question-aaaaaaaaaaaaaaaaaaaa=dependency",
            '{"question_id":"question-bbbbbbbbbbbbbbbbbbbb","text":"Свободный ответ"}',
        ])
        self.assertEqual(answers, [
            {
                "question_id": "question-aaaaaaaaaaaaaaaaaaaa",
                "text": "dependency",
            },
            {
                "question_id": "question-bbbbbbbbbbbbbbbbbbbb",
                "text": "Свободный ответ",
            },
        ])

    def test_awaiting_input_payload_carries_native_selection_and_replay(self):
        question = {
            "question_id": "question-aaaaaaaaaaaaaaaaaaaa",
            "kind": "classification",
            "prompt": "Какой тип схемы нужен?",
            "reason": "Есть два допустимых представления.",
            "recommended": {"value": "dependency", "label": "Dependency"},
            "choices": [
                {"value": "c4", "label": "C4"},
                {"value": "dependency", "label": "Dependency"},
            ],
            "allow_free_text": True,
        }
        payload = command_ux.intake_awaiting_input(
            intake_id="intake-123",
            question=question,
            command="create",
        )
        self.assertEqual(payload["status"], "awaiting_input")
        self.assertEqual(payload["selection_required"]["question"], question)
        replay = payload["selection_required"]["replay"]
        self.assertEqual(replay["intake_id"], "intake-123")
        self.assertIn("--intake-id", replay["command"])
        self.assertIn("--intake-answer", replay["command"])

    def test_qwen_transport_accepts_hidden_intake_flags(self):
        tokens = command_ux.qwen_command_tokens(
            '--intake-id intake-123 '
            '--intake-answer "question-aaaaaaaaaaaaaaaaaaaa=dependency" '
            '--accept-intake-assumptions "Покажи зависимости"'
        )
        self.assertEqual(tokens[0:2], ["--intake-id", "intake-123"])
        self.assertIn("--accept-intake-assumptions", tokens)

    def test_drawio_commands_keep_resume_for_real_human_cases_only(self):
        commands = ROOT / "commands" / "drawio"
        create = (commands / "create.md").read_text(encoding="utf-8")
        improve = (commands / "improve.md").read_text(encoding="utf-8")
        resume = (commands / "resume.md").read_text(encoding="utf-8")
        trace = (commands / "trace.md").read_text(encoding="utf-8")

        for document in (create, improve, resume, trace):
            self.assertIn("/drawio:", document)
        self.assertIn("deterministic plateau", create.lower())
        self.assertIn("deterministic plateau", improve.lower())
        self.assertIn("semantic ambiguity", resume.lower())
        self.assertIn("publication conflict", resume.lower())
        self.assertIn("read-only", trace.lower())


if __name__ == "__main__":
    unittest.main()
