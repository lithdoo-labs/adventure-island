"""Offline lifecycle tests for the no-detach CMS079 conversion runner."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "cms079_full_conversion",
    ROOT / "scripts/issue_agent/cms079_full_conversion.py",
)
conversion = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(conversion)


class ForegroundConversionTests(unittest.TestCase):
    def test_validated_completed_package_markers(self):
        with tempfile.TemporaryDirectory() as temp:
            state = Path(temp)
            self.assertEqual(conversion.done_packages(state), [])
            (state / "Base.wz.json").write_text(json.dumps({
                "package": "Base.wz", "status": "complete",
                "inputSha256": "input", "converterCommit": "src:hash",
            }))
            self.assertEqual(conversion.done_packages(state), ["Base.wz"])
            (state / "Character.wz.json").write_text(json.dumps({
                "package": "wrong", "status": "complete",
                "inputSha256": "input", "converterCommit": "src:hash",
            }))
            with self.assertRaisesRegex(RuntimeError, "invalid package marker"):
                conversion.done_packages(state)

    def test_journal_progress_supports_existing_layouts_without_mutation(self):
        with tempfile.TemporaryDirectory() as temp:
            state = Path(temp)
            journal1 = state / "manifest/journal.jsonl"
            journal2 = state / "manifest/manifest/journal.jsonl"
            journal1.parent.mkdir(parents=True)
            journal1.write_bytes(b"one\n")
            journal2.parent.mkdir(parents=True)
            journal2.write_bytes(b"two\nmore\n")
            self.assertEqual(conversion.journal_bytes(state), 13)

    def test_converter_child_environment_excludes_all_github_write_tokens(self):
        secrets = {name: "secret" for name in conversion.TOKEN_NAMES}
        with patch.dict(os.environ, secrets, clear=False):
            env = conversion.child_env()
        for name in secrets:
            self.assertNotIn(name, env)

    def test_checkpoint_only_journal_growth_is_not_progress(self):
        with tempfile.TemporaryDirectory() as temp:
            state = Path(temp)
            path = state / "manifest/manifest/journal.jsonl"
            path.parent.mkdir(parents=True)
            path.write_text('{"op":"checkpoint"}\n')
            previous = conversion.journal_positions(state)
            with path.open("a") as handle:
                handle.write('{"op":"pkgStart","package":"Character.wz"}\n')
                handle.write('{"op":"stat","key":"nodes","delta":1}\n')
            self.assertEqual(conversion.new_write_intents(previous), 0)
            with path.open("a") as handle:
                handle.write('{"op":"record","sha":"abc"}\n')
            self.assertEqual(conversion.new_write_intents(previous), 1)

    def test_foreground_command_finishes_without_detaching(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            log = root / "run.log"
            outcome, rc = conversion.foreground(
                [sys.executable, "-c",
                 "import pathlib;pathlib.Path('finished').write_text('yes')"],
                root, log, limit=15,
            )
            self.assertEqual((outcome, rc), ("complete", 0))
            self.assertEqual((root / "finished").read_text(), "yes")

    def test_foreground_timeout_terminates_process_group(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            outcome, rc = conversion.foreground(
                [sys.executable, "-c", "import time;time.sleep(8)"],
                root, root / "timeout.log", limit=1,
            )
            self.assertEqual((outcome, rc), ("time_budget", 124))

    def test_failed_conversion_never_dispatches_followup(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            source.mkdir()
            (source / "scripts/wz_fsdb").mkdir(parents=True)
            (source / "scripts/wz_fsdb/convert_cms.py").write_text("# safe\n")
            inputs = root / "input-manifest"
            inputs.mkdir()
            (inputs / "sha256-pre.txt").write_text("identical")
            (inputs / "sha256-post.txt").write_text("identical")
            state = root / "batch-state"
            state.mkdir()
            pr = {"state": "open", "draft": True, "head": {"sha": "a" * 40,
                    "ref": "agent/issue-50"}, "base": {"ref": "main"},
                    "body": "<!-- adventure-island-issue-agent:issue=50 -->"}
            calls = []

            def fake_github(method, path, payload=None):
                calls.append((method, path))
                if method == "GET":
                    return pr
                return {}

            with patch.object(conversion, "WORK", root), \
                 patch.object(conversion, "WZ", root), \
                 patch.object(conversion, "github", side_effect=fake_github), \
                 patch.object(conversion, "runtime_paths", return_value=(sys.executable, str(root))), \
                 patch.object(conversion, "foreground", return_value=("failed", 7)), \
                 patch.object(conversion, "done_packages", return_value=[]), \
                 patch.object(conversion, "subprocess") as proc, \
                 patch.dict(os.environ, {"GITHUB_REPOSITORY": conversion.REPO}, clear=False):
                proc.run.return_value.stdout = "a" * 40
                for name in conversion.PACKAGES + ("List.wz",):
                    (root / name).write_bytes(b"sample")
                result = conversion.run(source, 1)
            self.assertEqual(result, 1)
            self.assertFalse(any("/dispatches" in path for _, path in calls))
            self.assertTrue(any("/issues/50/comments" in path for _, path in calls))

    def test_partial_auto_dispatch_requires_durable_progress(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            source.mkdir()
            (source / "scripts/wz_fsdb").mkdir(parents=True)
            (source / "scripts/wz_fsdb/convert_cms.py").write_text("# safe\n")
            inputs = root / "input-manifest"
            inputs.mkdir()
            for item in ("sha256-pre.txt", "sha256-post.txt"):
                (inputs / item).write_text("same")
            for name in conversion.PACKAGES + ("List.wz",):
                (root / name).write_bytes(b"wz")
            events = []
            pr = {"state": "open", "draft": True, "head": {"sha": "a" * 40,
                  "ref": "agent/issue-50"}, "base": {"ref": "main"},
                  "body": "<!-- adventure-island-issue-agent:issue=50 -->"}
            def fake_github(method, path, payload=None):
                events.append((method, path, payload))
                return pr if method == "GET" else {}

            for old_bytes, new_bytes, expect in ((100, 101, 0), (100, 100, 1)):
                events.clear()
                with self.subTest(journal_delta=new_bytes - old_bytes), \
                     patch.object(conversion, "WORK", root), \
                     patch.object(conversion, "WZ", root), \
                     patch.object(conversion, "github", side_effect=fake_github), \
                     patch.object(conversion, "runtime_paths", return_value=(sys.executable, str(root))), \
                     patch.object(conversion, "foreground", return_value=("time_budget", 124)), \
                     patch.object(conversion, "done_packages", return_value=["Base.wz"]), \
                     patch.object(conversion, "journal_positions", return_value={}), \
                     patch.object(conversion, "new_write_intents", return_value=new_bytes - old_bytes), \
                     patch.object(conversion, "subprocess") as proc, \
                     patch.dict(os.environ, {"GITHUB_REPOSITORY": conversion.REPO}, clear=False):
                    proc.run.return_value.stdout = "a" * 40
                    observed = conversion.run(source, 2)
                self.assertEqual(observed, expect)
                dispatches = [p for m, p, _ in events if "/dispatches" in p]
                self.assertEqual(len(dispatches), 1 if expect == 0 else 0)


if __name__ == "__main__":
    unittest.main()
