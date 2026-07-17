from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "gigacode"
ARCHIVE = ROOT / "dist" / "drawio-skill-agent-extension.zip"


FAKE_GIGACODE = r'''#!/usr/bin/env bash
set -euo pipefail
: "${GIGACODE_EXTENSIONS_DIR:?}"
registry="${FAKE_GIGACODE_REGISTRY:?}"
log="${FAKE_GIGACODE_LOG:?}"
printf '%q ' "$@" >>"$log"
printf '\n' >>"$log"

if [[ "${1:-}" != extensions ]]; then exit 2; fi
case "${2:-}" in
  list)
    [[ -f "$registry" ]] && cat "$registry"
    ;;
  validate)
    [[ "${3:-}" == --help ]] && exit 0
    [[ -f "${3:?}/gemini-extension.json" ]]
    ;;
  install)
    if [[ "${3:-}" == --help ]]; then echo 'Options: --yes --force'; exit 0; fi
    source_path="${3:?}"
    destination="$GIGACODE_EXTENSIONS_DIR/publish-drawio-skill"
    rm -rf "$destination"
    mkdir -p "$GIGACODE_EXTENSIONS_DIR"
    cp -aL "$source_path" "$destination"
    [[ "${FAKE_GIGACODE_FAIL_INSTALL:-0}" == 1 ]] && exit 42
    echo publish-drawio-skill >"$registry"
    ;;
  uninstall)
    if [[ "${3:-}" == --help ]]; then echo 'Options: --yes --force'; exit 0; fi
    rm -rf "$GIGACODE_EXTENSIONS_DIR/publish-drawio-skill"
    rm -f "$registry"
    ;;
  *) exit 2 ;;
esac
'''


class InstallerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / ".gigacode"
        self.bin = self.home / "bin" / "gigacode"
        self.bin.parent.mkdir(parents=True)
        self.bin.write_text(FAKE_GIGACODE, encoding="utf-8")
        self.bin.chmod(0o755)
        self.archive = self.root / ARCHIVE.name
        shutil.copy2(ARCHIVE, self.archive)
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.checksum = self.root / f"{ARCHIVE.name}.sha256"
        self.checksum.write_text(f"{digest}  {ARCHIVE.name}\n", encoding="utf-8")
        self.env = os.environ.copy()
        self.env.update(
            {
                "HOME": str(self.root),
                "GIGACODE_HOME": str(self.home),
                "GIGACODE_BIN": str(self.bin),
                "GIGACODE_SKILLS_DIR": str(self.home / "skills"),
                "GIGACODE_EXTENSIONS_DIR": str(self.home / "extensions"),
                "GIGACODE_EXTENSION_SOURCES_DIR": str(self.home / "extension-sources"),
                "GIGACODE_BACKUP_DIR": str(self.home / "backups" / "drawio-agent-extension"),
                "FAKE_GIGACODE_REGISTRY": str(self.root / "registry.txt"),
                "FAKE_GIGACODE_LOG": str(self.root / "gigacode.log"),
            }
        )

    def run_script(self, name: str, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            [str(SCRIPTS / name), *args],
            cwd=ROOT,
            env=self.env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        if check and result.returncode:
            self.fail(f"{name} failed ({result.returncode}):\n{result.stdout}")
        return result

    def install(self) -> subprocess.CompletedProcess[str]:
        return self.run_script(
            "install_drawio_agent_extension.sh",
            "--archive",
            str(self.archive),
            "--checksum",
            str(self.checksum),
            "--skip-deps",
        )

    def test_install_backs_up_legacy_skill_and_verifies(self) -> None:
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "legacy.txt").write_text("old", encoding="utf-8")

        result = self.install()

        self.assertIn("Installed publish-drawio-skill 1.22.0-corporate.1", result.stdout)
        self.assertFalse(legacy.exists())
        installed = self.home / "extensions" / "publish-drawio-skill"
        self.assertTrue((installed / "agents" / "diagram-supervisor.md").is_file())
        backups = list((self.home / "backups" / "drawio-agent-extension").iterdir())
        self.assertEqual(1, len(backups))
        self.assertEqual("old", (backups[0] / "legacy-skill" / "legacy.txt").read_text())
        self.run_script("verify_drawio_agent_extension.sh", "--skip-self-check")

    def test_rollback_restores_legacy_skill(self) -> None:
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "legacy.txt").write_text("old", encoding="utf-8")
        self.install()

        self.run_script("rollback_drawio_agent_extension.sh", "--latest")

        self.assertEqual("old", (legacy / "legacy.txt").read_text())
        self.assertFalse((self.home / "extensions" / "publish-drawio-skill").exists())
        self.assertFalse((self.root / "registry.txt").exists())

    def test_rollback_preflights_backup_before_removing_current_install(self) -> None:
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "legacy.txt").write_text("old", encoding="utf-8")
        self.install()
        backup_root = self.home / "backups" / "drawio-agent-extension"
        backup = next(backup_root.iterdir())
        shutil.rmtree(backup / "legacy-skill")
        installed = self.home / "extensions" / "publish-drawio-skill"

        result = self.run_script(
            "rollback_drawio_agent_extension.sh", "--latest", check=False
        )

        self.assertNotEqual(0, result.returncode)
        self.assertIn("Legacy skill backup is missing", result.stdout)
        self.assertTrue(installed.is_dir())
        self.assertEqual(
            "publish-drawio-skill\n", (self.root / "registry.txt").read_text()
        )

    def test_checksum_rejection_does_not_mutate_gigacode_home(self) -> None:
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "keep.txt").write_text("keep", encoding="utf-8")

        result = self.run_script(
            "install_drawio_agent_extension.sh",
            "--archive",
            str(self.archive),
            "--sha256",
            "0" * 64,
            "--skip-deps",
            check=False,
        )

        self.assertNotEqual(0, result.returncode)
        self.assertIn("Checksum mismatch", result.stdout)
        self.assertTrue((legacy / "keep.txt").is_file())
        self.assertFalse((self.home / "backups").exists())

    def test_dry_run_does_not_mutate_active_directories(self) -> None:
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "keep.txt").write_text("keep", encoding="utf-8")

        result = self.run_script(
            "install_drawio_agent_extension.sh",
            "--archive",
            str(self.archive),
            "--checksum",
            str(self.checksum),
            "--skip-deps",
            "--dry-run",
        )

        self.assertIn("[dry-run]", result.stdout)
        self.assertTrue((legacy / "keep.txt").is_file())
        self.assertFalse((self.home / "extensions").exists())
        self.assertFalse((self.home / "extension-sources").exists())
        self.assertFalse((self.home / "backups").exists())

    def test_verifier_rejects_active_legacy_conflict(self) -> None:
        self.install()
        (self.home / "skills" / "drawio-skill").mkdir(parents=True)

        result = self.run_script(
            "verify_drawio_agent_extension.sh", "--skip-self-check", check=False
        )

        self.assertNotEqual(0, result.returncode)
        self.assertIn("would compete with the extension", result.stdout)

    def test_registered_extension_without_restorable_files_is_not_uninstalled(self) -> None:
        registry = self.root / "registry.txt"
        registry.write_text("publish-drawio-skill\n", encoding="utf-8")
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "keep.txt").write_text("keep", encoding="utf-8")

        result = self.install_with_expected_failure()

        self.assertNotEqual(0, result.returncode)
        self.assertIn("no restorable files were found", result.stdout)
        self.assertEqual("publish-drawio-skill\n", registry.read_text())
        self.assertTrue((legacy / "keep.txt").is_file())
        log = (self.root / "gigacode.log").read_text()
        self.assertNotIn("extensions uninstall", log)

    def test_failed_native_install_automatically_restores_legacy_skill(self) -> None:
        legacy = self.home / "skills" / "drawio-skill"
        legacy.mkdir(parents=True)
        (legacy / "legacy.txt").write_text("old", encoding="utf-8")
        self.env["FAKE_GIGACODE_FAIL_INSTALL"] = "1"

        result = self.install_with_expected_failure()

        self.assertNotEqual(0, result.returncode)
        self.assertIn("restoring backup", result.stdout)
        self.assertEqual("old", (legacy / "legacy.txt").read_text())
        self.assertFalse((self.home / "extensions" / "publish-drawio-skill").exists())
        version_dir = (
            self.home
            / "extension-sources"
            / "publish-drawio-skill"
            / "1.22.0-corporate.1"
        )
        self.assertFalse(version_dir.exists())

    def install_with_expected_failure(self) -> subprocess.CompletedProcess[str]:
        return self.run_script(
            "install_drawio_agent_extension.sh",
            "--archive",
            str(self.archive),
            "--checksum",
            str(self.checksum),
            "--skip-deps",
            check=False,
        )


if __name__ == "__main__":
    unittest.main()
