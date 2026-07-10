import os
import subprocess
import sys
import tempfile
import textwrap
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_cmd(*args):
    return subprocess.run(
        [sys.executable, *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )


class DrawioValidatorTextFitTests(unittest.TestCase):
    def test_long_label_in_small_rhombus_warns(self):
        diagram = textwrap.dedent("""\
            <?xml version="1.0" encoding="UTF-8"?>
            <mxfile host="app.diagrams.net">
              <diagram id="p1" name="Page-1">
                <mxGraphModel>
                  <root>
                    <mxCell id="0" />
                    <mxCell id="1" parent="0" />
                    <mxCell id="m1" value="SSO готов к интеграции" style="rhombus;whiteSpace=wrap;html=1;" parent="1" vertex="1">
                      <mxGeometry x="100" y="100" width="36" height="36" as="geometry" />
                    </mxCell>
                  </root>
                </mxGraphModel>
              </diagram>
            </mxfile>
        """)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "bad.drawio")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(diagram)
            proc = run_cmd("scripts/validate.py", path, "--strict")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("label likely overflows", proc.stderr + proc.stdout)


if __name__ == "__main__":
    unittest.main()
