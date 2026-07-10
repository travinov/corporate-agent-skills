import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("release_skills", ROOT / "scripts" / "release_skills.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ReleaseSkillsTests(unittest.TestCase):
    def fixture(self, root: Path, *, version_a="1.0.0", version_b="1.0.0"):
        source = root / "skill"
        (source / "scripts").mkdir(parents=True)
        (source / "SKILL.md").write_text(f"version: {version_a}\n", encoding="utf-8")
        (source / "meta.json").write_text(json.dumps({"version": version_b}), encoding="utf-8")
        (source / "scripts" / "run.py").write_text("print('ok')\n", encoding="utf-8")
        return source

    def spec(self):
        return {
            "source": "skill",
            "archive_root": "sample-skill",
            "output": "sample.zip",
            "include": ["SKILL.md", "meta.json", "scripts/*.py"],
            "version_sources": [
                {"path": "SKILL.md", "pattern": r"(?m)^version:\s*(\S+)\s*$"},
                {"path": "meta.json", "json_key": "version"},
            ],
            "verify_commands": [],
        }

    def test_missing_allowlist_path_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            with self.assertRaisesRegex(release.ReleaseError, "matched nothing"):
                release.resolve_files(root / "skill", ["missing.txt"], set())

    def test_forbidden_match_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self.fixture(root)
            (source / "__pycache__").mkdir()
            (source / "__pycache__" / "bad.pyc").write_bytes(b"bad")
            with self.assertRaisesRegex(release.ReleaseError, "forbidden"):
                release.resolve_files(source, ["**/*"], {"__pycache__"})

    def test_unallowlisted_files_are_not_packaged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self.fixture(root)
            (source / "scripts" / "run 2.py").write_text("print('stale copy')\n", encoding="utf-8")
            files = release.resolve_files(source, ["SKILL.md", "meta.json", "scripts/run.py"], set())
            self.assertEqual(
                [path.relative_to(source).as_posix() for path in files],
                ["SKILL.md", "meta.json", "scripts/run.py"],
            )

    def test_version_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self.fixture(root, version_b="2.0.0")
            with self.assertRaisesRegex(release.ReleaseError, "version mismatch"):
                release.read_versions(source, self.spec()["version_sources"])

    def test_build_is_deterministic_and_verifies_parity(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_root = Path(tmp)
            self.fixture(fake_root)
            output = fake_root / "dist"
            original_root = release.ROOT
            try:
                release.ROOT = fake_root
                first = release.build_skill("sample", self.spec(), set(), output)
                release.write_checksums({"skills": {"sample": self.spec()}}, output)
                first_bytes = (output / "sample.zip").read_bytes()
                second = release.build_skill("sample", self.spec(), set(), output)
                self.assertEqual(first_bytes, (output / "sample.zip").read_bytes())
                self.assertEqual(first["archive_sha256"], second["archive_sha256"])
                report = release.verify_skill("sample", self.spec(), set(), output, run_commands=False)
                self.assertEqual(report["status"], "passed")
                with zipfile.ZipFile(output / "sample.zip") as bundle:
                    self.assertIn("sample-skill/MANIFEST.sha256", bundle.namelist())
            finally:
                release.ROOT = original_root

    def test_stale_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_root = Path(tmp)
            source = self.fixture(fake_root)
            output = fake_root / "dist"
            original_root = release.ROOT
            try:
                release.ROOT = fake_root
                release.build_skill("sample", self.spec(), set(), output)
                release.write_checksums({"skills": {"sample": self.spec()}}, output)
                (source / "scripts" / "run.py").write_text("print('changed')\n", encoding="utf-8")
                with self.assertRaisesRegex(release.ReleaseError, "parity failed"):
                    release.verify_skill("sample", self.spec(), set(), output, run_commands=False)
            finally:
                release.ROOT = original_root

    def test_external_manifest_tampering_is_rejected(self):
        mutations = {
            "version": "BROKEN",
            "archive": "wrong.zip",
            "archive_root": "wrong-root",
            "version_sources": [],
            "files": [],
        }
        for field, value in mutations.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                fake_root = Path(tmp)
                self.fixture(fake_root)
                output = fake_root / "dist"
                original_root = release.ROOT
                try:
                    release.ROOT = fake_root
                    release.build_skill("sample", self.spec(), set(), output)
                    release.write_checksums({"skills": {"sample": self.spec()}}, output)
                    manifest_path = output / "sample.zip.manifest.json"
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    manifest[field] = value
                    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                    with self.assertRaisesRegex(release.ReleaseError, "external archive manifest"):
                        release.verify_skill("sample", self.spec(), set(), output, run_commands=False)
                finally:
                    release.ROOT = original_root

    def test_checksum_files_use_archive_basenames(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            archive = output / "sample.zip"
            archive.write_bytes(b"archive")
            config = {"skills": {"sample": {"output": "sample.zip"}}}
            release.write_checksums(config, output)
            expected = f"{release.sha256_file(archive)}  sample.zip\n"
            self.assertEqual((output / "sample.zip.sha256").read_text(), expected)
            self.assertEqual((output / "SHA256SUMS.txt").read_text(), expected)


if __name__ == "__main__":
    unittest.main()
