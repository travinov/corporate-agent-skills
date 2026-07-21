#!/usr/bin/env python3
"""Workspace-contained run serialization with bounded stale-lock recovery."""
from __future__ import annotations

import json
import os
import shutil
import socket
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from lifecycle_contracts import atomic_write_bytes, contained_path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


@dataclass(frozen=True)
class LockOwner:
    token: str
    pid: int
    hostname: str
    acquired_at: str
    heartbeat_at: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": 2,
            "token": self.token,
            "pid": self.pid,
            "hostname": self.hostname,
            "acquired_at": self.acquired_at,
            "heartbeat_at": self.heartbeat_at,
        }


class RunAlreadyLocked(RuntimeError):
    def __init__(self, run_id: str, owner: dict[str, Any] | None, *, stale: bool) -> None:
        super().__init__(f"diagram run {run_id} is already locked")
        self.run_id = run_id
        self.owner = owner
        self.stale = stale

    def as_result(self) -> dict[str, Any]:
        return {
            "schema_version": 2,
            "status": "already_running",
            "code": "run.locked",
            "run_id": self.run_id,
            "stale": self.stale,
            "owner": self.owner,
            "message": str(self),
        }


class RunLock:
    """Atomic directory lock owned by one token.

    Recovery is bounded to ``max_recovery_attempts`` and only considers a lock
    stale after its heartbeat lease expires.  A live local PID always wins even
    after lease expiry; a remote owner cannot be probed and is recoverable only
    after the lease.
    """

    def __init__(
        self,
        *,
        workspace: Path | str,
        run_dir: Path | str,
        run_id: str,
        stale_after_seconds: float = 300.0,
        max_recovery_attempts: int = 1,
    ) -> None:
        self.workspace = Path(workspace).expanduser().resolve()
        self.run_dir = contained_path(self.workspace, run_dir)
        self.run_id = run_id
        if stale_after_seconds <= 0:
            raise ValueError("stale_after_seconds must be positive")
        if max_recovery_attempts < 0:
            raise ValueError("max_recovery_attempts cannot be negative")
        self.stale_after_seconds = float(stale_after_seconds)
        self.max_recovery_attempts = int(max_recovery_attempts)
        self.lock_dir = self.run_dir / ".run-lock"
        self.owner_path = self.lock_dir / "owner.json"
        now = utc_now()
        self.owner = LockOwner(
            token=uuid.uuid4().hex,
            pid=os.getpid(),
            hostname=socket.gethostname(),
            acquired_at=now,
            heartbeat_at=now,
        )
        self.acquired = False
        self.recovery_records: list[dict[str, Any]] = []

    def _read_owner(self) -> dict[str, Any] | None:
        try:
            value = json.loads(self.owner_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return None
        return value if isinstance(value, dict) else None

    def _age_seconds(self, owner: dict[str, Any] | None) -> float:
        try:
            timestamp = str(owner["heartbeat_at"]).replace("Z", "+00:00")
            return max(0.0, time.time() - datetime.fromisoformat(timestamp).timestamp())
        except (KeyError, TypeError, ValueError):
            try:
                return max(0.0, time.time() - self.lock_dir.stat().st_mtime)
            except OSError:
                return 0.0

    def _is_stale(self, owner: dict[str, Any] | None) -> bool:
        if self._age_seconds(owner) <= self.stale_after_seconds:
            return False
        if owner and owner.get("hostname") == socket.gethostname():
            try:
                if _pid_alive(int(owner.get("pid", -1))):
                    return False
            except (TypeError, ValueError):
                pass
        return True

    def _create(self) -> bool:
        try:
            self.lock_dir.mkdir(parents=False)
        except FileExistsError:
            return False
        try:
            atomic_write_bytes(
                self.owner_path,
                json.dumps(self.owner.as_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\n",
            )
        except Exception:
            shutil.rmtree(self.lock_dir, ignore_errors=True)
            raise
        self.acquired = True
        return True

    def acquire(self) -> "RunLock":
        self.run_dir.mkdir(parents=True, exist_ok=True)
        for recovery_index in range(self.max_recovery_attempts + 1):
            if self._create():
                return self
            current_owner = self._read_owner()
            stale = self._is_stale(current_owner)
            if not stale or recovery_index >= self.max_recovery_attempts:
                raise RunAlreadyLocked(self.run_id, current_owner, stale=stale)
            recovered = self.run_dir / f".run-lock.recovered-{uuid.uuid4().hex}"
            try:
                os.rename(self.lock_dir, recovered)
            except (FileNotFoundError, FileExistsError):
                continue
            self.recovery_records.append(
                {
                    "schema_version": 2,
                    "run_id": self.run_id,
                    "recovered_at": utc_now(),
                    "prior_owner": current_owner,
                    "recovered_path": recovered.name,
                }
            )
            shutil.rmtree(recovered, ignore_errors=True)
        raise RunAlreadyLocked(self.run_id, self._read_owner(), stale=False)

    def heartbeat(self) -> None:
        if not self.acquired:
            raise RuntimeError("cannot heartbeat a lock that is not held")
        current = self._read_owner()
        if not current or current.get("token") != self.owner.token:
            raise RuntimeError("run lock ownership changed")
        self.owner = LockOwner(
            token=self.owner.token,
            pid=self.owner.pid,
            hostname=self.owner.hostname,
            acquired_at=self.owner.acquired_at,
            heartbeat_at=utc_now(),
        )
        atomic_write_bytes(
            self.owner_path,
            json.dumps(self.owner.as_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\n",
        )

    def release(self) -> None:
        if not self.acquired:
            return
        current = self._read_owner()
        if not current or current.get("token") != self.owner.token:
            raise RuntimeError("refusing to release a run lock owned by another process")
        try:
            self.owner_path.unlink()
            self.lock_dir.rmdir()
        finally:
            self.acquired = False

    def __enter__(self) -> "RunLock":
        return self.acquire()

    def __exit__(self, exc_type, exc, traceback) -> None:
        self.release()
