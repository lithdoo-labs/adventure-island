#!/usr/bin/env python3
"""Foreground conversion controller for Issue #50. Never detach WZ conversion."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.request import Request, urlopen

REPO = "lithdoo-labs/adventure-island"
WORK = Path("/runner/state/lithdoo-labs-org/agent-projects/adventure-island/issue-agent/work/cms079-issue-50")
WZ = Path("/shared/CMS079/怀旧岛079V5客户端/冒险岛online")
PACKAGES = ("Base.wz", "Character.wz", "Effect.wz", "Etc.wz", "Item.wz", "Map.wz",
            "Mob.wz", "Morph.wz", "Npc.wz", "Quest.wz", "Reactor.wz", "Skill.wz",
            "Sound.wz", "String.wz", "TamingMob.wz", "UI.wz")
MAX_ROUNDS = 32
SECONDS = 230 * 60
TOKEN_NAMES = ("GH_TOKEN", "GITHUB_TOKEN", "AGENT_GITHUB_TOKEN",
               "GITHUB_ACCESS_TOKEN", "GITHUB_ORG_ACCESS_TOKEN")


def child_env():
    """Never pass GitHub credentials into PR-authored converter code."""
    env = os.environ.copy()
    for key in TOKEN_NAMES:
        env.pop(key, None)
    return env


def github(method, path, payload=None):
    token = os.environ["GH_TOKEN"]
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request("https://api.github.com" + path, method=method, data=data,
                  headers={"Authorization": "Bearer " + token,
                           "Accept": "application/vnd.github+json",
                           "X-GitHub-Api-Version": "2022-11-28",
                           "Content-Type": "application/json"})
    with urlopen(req, timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if raw else {}


def done_packages(state):
    completed = []
    for package in PACKAGES:
        marker = state / (package + ".json")
        if marker.is_file():
            item = json.loads(marker.read_text())
            if (item.get("status"), item.get("package")) != ("complete", package):
                raise RuntimeError("invalid package marker: " + package)
            if not item.get("inputSha256") or not item.get("converterCommit"):
                raise RuntimeError("missing package identity: " + package)
            completed.append(package)
    return completed


def journal_bytes(state):
    return sum(p.stat().st_size for p in (
        state / "manifest/journal.jsonl",
        state / "manifest/manifest/journal.jsonl"
    ) if p.is_file())


def journal_positions(state):
    paths = (state / "manifest/journal.jsonl",
             state / "manifest/manifest/journal.jsonl")
    return {str(path): path.stat().st_size for path in paths if path.is_file()}


def new_write_intents(previous_positions):
    """Only actual new output intents count as durable conversion progress."""
    count = 0
    for name, offset in previous_positions.items():
        path = Path(name)
        if not path.is_file() or path.stat().st_size < offset:
            continue
        with path.open("rb") as handle:
            handle.seek(offset)
            for raw in handle:
                try:
                    event = json.loads(raw)
                except (ValueError, UnicodeDecodeError):
                    continue
                if event.get("op") in ("record", "group", "resource") and event.get("sha"):
                    count += 1
    return count


def runtime_paths(work):
    """Only inspect shallow tool/venv paths, never walk millions of FSDB files."""
    if not work.is_dir():
        raise RuntimeError("Runner persistent work root is absent")
    parents = [work]
    excluded = {"fsdb-all", "fsdb-avatar", "batch-state", "reports", "logs", "input-manifest"}
    for folder in [work, work / "converter-checkout", work / "tools", work / "parser"]:
        if not folder.is_dir():
            continue
        if folder not in parents:
            parents.append(folder)
        for child in folder.iterdir():
            if child.is_dir() and child.name not in excluded and child not in parents:
                parents.append(child)
    parser_roots = [p for p in parents if (p / "wzpy/__init__.py").is_file()]
    if len(parser_roots) != 1:
        raise RuntimeError("expected one pinned wzpy checkout, found " + str(len(parser_roots)))
    wzpy_parent = parser_roots[0]
    expected_pin = "79344c95774a911adf93a4d43c67e5fc51fa6e76"
    git_root = next((p for p in [wzpy_parent, wzpy_parent / "wzpy"]
                     if (p / ".git").exists()), None)
    if git_root is not None:
        actual = subprocess.run(["git", "rev-parse", "HEAD"], cwd=git_root,
                                capture_output=True, text=True, check=True).stdout.strip()
        if actual != expected_pin:
            raise RuntimeError("wzpy pinned commit mismatch")
    candidates = []
    for parent in parents:
        for name in ("venv", ".venv"):
            candidate = parent / name / "bin/python"
            if candidate.exists():
                candidates.append(str(candidate))
    candidates.append(sys.executable)
    for python in dict.fromkeys(candidates):
        result = subprocess.run(
            [python, "-c", "import PIL,numpy; from wzpy import WzFile; from wzpy.canvas import decode_canvas"],
            env={**child_env(), "PYTHONPATH": str(wzpy_parent)},
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            return python, str(wzpy_parent)
    raise RuntimeError("no interpreter has PIL, numpy and pinned wzpy")


def stop(proc):
    if proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait(timeout=30)


def foreground(cmd, cwd, log, limit=SECONDS):
    log.parent.mkdir(parents=True, exist_ok=True)
    start = time.monotonic()
    with log.open("ab", buffering=0) as stream:
        process = subprocess.Popen(cmd, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT,
                                   start_new_session=True,
                                   env={**child_env(), "PYTHONUNBUFFERED": "1"})
        try:
            while True:
                try:
                    rc = process.wait(timeout=min(60, max(1, limit - (time.monotonic() - start))))
                    return "complete" if rc == 0 else "failed", rc
                except subprocess.TimeoutExpired:
                    print("Foreground process still running; elapsed="
                          + str(round(time.monotonic() - start)) + "s", flush=True)
                    if time.monotonic() - start >= limit:
                        stop(process)
                        return "time_budget", 124
        finally:
            stop(process)


def issue_report(status, done, detail, sha):
    missing = [p for p in PACKAGES if p not in done]
    body = (
        "### CMS079 deterministic foreground conversion — Issue #50 / PR #53\n"
        "- Status: " + status + "\n"
        "- Completed: " + str(len(done)) + "/16 (" + (", ".join(done) or "none") + ")\n"
        "- Remaining: " + (", ".join(missing) or "none") + "\n"
        "- Converter SHA: " + (sha or "unknown") + "\n"
        "- Actions run: https://github.com/" + REPO + "/actions/runs/"
        + os.getenv("GITHUB_RUN_ID", "unknown") + "\n\n"
        + detail[:3500] + "\n\n"
        "Foreground execution only; no source assets uploaded and no automatic PR merge."
    )
    github("POST", "/repos/" + REPO + "/issues/50/comments", {"body": body})


def run(source, round_number):
    state = WORK / "batch-state"
    sha = ""
    try:
        if os.getenv("GITHUB_REPOSITORY") != REPO:
            raise RuntimeError("wrong GitHub repository")
        pr = github("GET", "/repos/" + REPO + "/pulls/53")
        sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=source,
                             capture_output=True, text=True, check=True).stdout.strip()
        if (pr.get("state") != "open" or not pr.get("draft")
                or pr.get("head", {}).get("sha") != sha
                or pr.get("head", {}).get("ref") != "agent/issue-50"
                or pr.get("base", {}).get("ref") != "main"
                or "<!-- adventure-island-issue-agent:issue=50 -->" not in (pr.get("body") or "")):
            raise RuntimeError("Draft PR #53 provenance or SHA mismatch")
        if not (source / "scripts/wz_fsdb/convert_cms.py").is_file():
            raise RuntimeError("PR checkout lacks converter")
        before = WORK / "input-manifest/sha256-pre.txt"
        after = WORK / "input-manifest/sha256-post.txt"
        if not before.is_file() or not after.is_file() or before.read_bytes() != after.read_bytes():
            raise RuntimeError("original input identity manifests unavailable or inconsistent")
        for pkg in PACKAGES + ("List.wz",):
            if not (WZ / pkg).is_file():
                raise RuntimeError("WZ input missing: " + pkg)
        python, wzpy = runtime_paths(WORK)
        previous = done_packages(state)
        if len(previous) != 16:
            old_journal = journal_positions(state)
            command = [python, "-u", str(source / "scripts/wz_fsdb/convert_cms.py"),
                       "--scope", "all", "--wz-root", str(WZ), "--wzpy", wzpy,
                       "--out", str(WORK / "fsdb-all/[FSDB]cms"),
                       "--report-dir", str(WORK / "reports/all"),
                       "--batch-state", str(state)]
            logfile = WORK / "logs" / ("foreground-conversion-" + os.getenv("GITHUB_RUN_ID", "manual") + ".log")
            print("Starting conversion (foreground), round=" + str(round_number)
                  + ", completed=" + str(len(previous)) + "/16; log=" + str(logfile), flush=True)
            outcome, rc = foreground(command, source, logfile)
            completed = done_packages(state)
            if outcome == "failed":
                raise RuntimeError("converter exited " + str(rc) + "; local log: " + str(logfile))
            if len(completed) < 16:
                if outcome != "time_budget":
                    raise RuntimeError("converter exited successfully before 16/16; refusing false success")
                new_outputs = new_write_intents(old_journal)
                if new_outputs <= 0 and len(completed) <= len(previous):
                    raise RuntimeError("no new output intents or completed packages this round; refusing endless retries")
                if round_number >= MAX_ROUNDS:
                    raise RuntimeError("32 continuation rounds reached; manual review required")
                github("POST", "/repos/" + REPO + "/actions/workflows/cms079-full-conversion.yml/dispatches",
                       {"ref": "main", "inputs": {"issue_number": "50",
                                                  "round_number": str(round_number + 1)}})
                issue_report("PARTIAL; follow-up run auto-dispatched", completed,
                             "The foreground conversion reached its 230-minute budget. "
                             "New output intents=" + str(new_outputs) + ". "
                             "The next run resumes this exact persistent batch state.", sha)
                return 0
        complete = done_packages(state)
        if len(complete) != 16:
            raise RuntimeError("finalization forbidden without 16/16 completed package markers")
        finalize = [python, "-u", str(source / "scripts/wz_fsdb/convert_cms.py"),
                    "--scope", "all", "--finalize", "--wz-root", str(WZ), "--wzpy", wzpy,
                    "--out", str(WORK / "fsdb-all/[FSDB]cms"),
                    "--report-dir", str(WORK / "reports/all"),
                    "--batch-state", str(state)]
        final_log = WORK / "logs" / ("foreground-finalize-" + os.getenv("GITHUB_RUN_ID", "manual") + ".log")
        outcome, rc = foreground(finalize, source, final_log, limit=25 * 60)
        if outcome != "complete":
            raise RuntimeError("finalize did not complete: " + outcome + ", rc=" + str(rc))
        if not (WORK / "reports/all/convert-all-final.json").is_file():
            raise RuntimeError("finalize report missing")
        issue_report("16/16 FINALIZED; full-data verification STILL REQUIRED", complete,
                     "Conversion completed. Do NOT merge until full FSDB verification, "
                     "ContentClient group/sound reads, anomaly classification, and regressions pass.", sha)
        return 0
    except Exception as error:
        reason = type(error).__name__ + ": " + str(error)
        print("BLOCKED: " + reason, file=sys.stderr, flush=True)
        try:
            issue_report("BLOCKED; no claim of completion", done_packages(state), reason, sha)
        except Exception as report_error:
            print("Unable to post failure comment: " + str(report_error), file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--round", type=int, required=True)
    args = parser.parse_args()
    if not 1 <= args.round <= MAX_ROUNDS:
        raise SystemExit("invalid conversion round")
    raise SystemExit(run(args.source.resolve(), args.round))


if __name__ == "__main__":
    main()
