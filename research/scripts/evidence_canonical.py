#!/usr/bin/env python3
"""evidence_canonical.py — cross-platform evidence byte canonicalization (T086.1).

Problem (found in T086.1): with `core.autocrlf=true` on Windows, generator
scripts that write text files in default text mode produce CRLF working-tree
bytes; git stores LF-normalized blobs. T086 recorded six evidence SHA-256
values over the CRLF working-tree bytes (EV-82..EV-87), so verification was
reproducible only on a machine that (a) never re-checked-out the files or
(b) shares the same autocrlf setting — a fresh clone on Linux breaks it
(worktree = LF), and a fresh clone on Windows breaks the T085-era LF-hashed
rows instead. Binary evidence (EXE/DLL/WZ) is unaffected by conversion but
MUST NOT be line-ending normalized (they contain 0D 0A byte pairs).

Canonical rule adopted in T086.1 (documented in
research/result/stage-readiness/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv and the
T086.1 report):

    canonical bytes = raw bytes                                  (binary files)
                    = raw bytes with CRLF -> LF normalization    (text files)

    text = decodes as UTF-8 AND contains no NUL byte
    (a UTF-8 BOM is content and is preserved; a lone CR is content; a
     missing/extra trailing newline changes the hash)

For every text file committed from this repository (autocrlf normalizes on
commit) the canonical bytes are byte-identical to the git blob, so the rule
is equivalent to "hash the git blob" while remaining computable without git
(validation fixtures are not git repositories). The rule is a pure function
of logical content: changing any non-EOL byte still changes the hash, so
this is a documented canonicalization, not a weakened check.
"""
from __future__ import annotations

import hashlib
from pathlib import Path


def is_text_bytes(raw: bytes) -> bool:
    """Text iff decodes as UTF-8 and has no NUL byte (BOM allowed)."""
    if b"\x00" in raw:
        return False
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def canonical_bytes(raw: bytes) -> bytes:
    """Apply the T086.1 canonical rule to raw file bytes."""
    if is_text_bytes(raw):
        return raw.replace(b"\r\n", b"\n")
    return raw


def canonical_sha256(path) -> str:
    """SHA-256 of a file's canonical bytes (path: str or Path)."""
    raw = Path(path).read_bytes()
    return hashlib.sha256(canonical_bytes(raw)).hexdigest()
