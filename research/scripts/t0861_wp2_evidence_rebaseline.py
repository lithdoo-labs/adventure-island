#!/usr/bin/env python3
"""T086.1 WP2 — re-baseline the six T086 evidence rows to canonical (LF) hashes.

Audits ALL evidence rows first (fail-closed): every row with a single 64-hex
hash and an existing source file must match either its raw bytes or its
canonical bytes. Then rewrites exactly the rows whose ledger hash matches the
CRLF raw form but not the canonical form, recording old->new in
forensics/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv. Idempotent: a second run must
find nothing to re-baseline.
"""
import csv
import hashlib
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from evidence_canonical import canonical_bytes, canonical_sha256, is_text_bytes  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

SOT_EV = REPO / "research/source-of-truth/evidence.csv"
OUT = REPO / "research/result/stage-readiness/forensics/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv"
HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")


def git_blob(rel):
    r = subprocess.run(["git", "cat-file", "blob", f"HEAD:{rel}"],
                       cwd=REPO, capture_output=True)
    return r.stdout if r.returncode == 0 else None


rows = list(csv.DictReader(SOT_EV.open(newline="", encoding="utf-8")))
fieldnames = list(rows[0].keys())

audit = []
rebaseline = []
mismatch = []
stats = {"rows": len(rows), "binary_raw": 0, "text_raw": 0, "text_norm": 0, "no_file": 0, "no_hash": 0}
for r in rows:
    eid, src, sha = r["evidence_id"], r["source_file"], r["source_sha256"].strip()
    first = src.split("(")[0].strip()
    p = None
    for cand in (first, first.split("+")[0].strip()):
        q = REPO / cand
        if q.is_file():
            p, rel = q, cand
            break
    if p is None:
        stats["no_file"] += 1
        audit.append((eid, rel if p else src, "", "", "source file not on disk (corpus/off-repo)", ""))
        continue
    if not HEX64.match(sha):
        stats["no_hash"] += 1
        continue
    raw = p.read_bytes()
    norm = canonical_bytes(raw)
    h_raw = hashlib.sha256(raw).hexdigest()
    h_norm = hashlib.sha256(norm).hexdigest()
    blob = git_blob(rel.replace("\\", "/"))
    h_blob = hashlib.sha256(blob).hexdigest() if blob is not None else ""
    if raw == norm:
        kind = "binary" if not is_text_bytes(raw) else "text-LF"
    else:
        kind = "text-CRLF" if is_text_bytes(raw) else "binary"
    if sha.lower() == h_raw and raw == norm:
        stats["binary_raw" if not is_text_bytes(raw) else "text_raw"] += 1
        note = "raw==canonical (no EOL issue)"
    elif sha.lower() == h_norm:
        stats["text_norm"] += 1
        note = "canonical match"
    elif sha.lower() == h_raw:
        # ledger bound to CRLF raw bytes — must re-baseline
        rebaseline.append((eid, rel, sha.lower(), h_norm, h_blob))
        note = "LEDGER=RAW(CRLF) — RE-BASELINE"
    else:
        mismatch.append((eid, rel, sha, h_raw, h_norm))
        note = "MISMATCH (neither raw nor canonical)"
    audit.append((eid, rel, kind, sha.lower()[:16] + "…",
                  note, h_norm[:16] + "…"))

if mismatch:
    for m in mismatch:
        print("!! MISMATCH", m)
    sys.exit("fail-closed: rows match neither raw nor canonical — refusing to write")

print(f"rows={stats}")
print(f"re-baseline candidates: {len(rebaseline)}")
for eid, rel, old, new, blob in rebaseline:
    same = "blob==canonical" if blob == new else f"blob differs ({blob[:16]}…)"
    print(f"  {eid}: {rel}\n    old(CRLF)={old}\n    new(canonical)={new}  {same}")

# apply the re-baseline to evidence.csv
if rebaseline:
    newmap = {eid: new for eid, _, _, new, _ in rebaseline}
    changed = 0
    for r in rows:
        if r["evidence_id"] in newmap and r["source_sha256"].strip().lower() != newmap[r["evidence_id"]]:
            r["source_sha256"] = newmap[r["evidence_id"]]
            changed += 1
    with SOT_EV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"evidence.csv updated: {changed} rows re-baselined")

# preserve the historical old->new record across reruns (idempotent script).
# FALLBACK carries the six T086.1 re-baselines as committed constants so the
# record can never be lost (values independently recoverable from
# `git show <t086-sha>:research/source-of-truth/evidence.csv`).
FALLBACK_RECORDS = [
    ("EV-82", "5a62eb9da593a1fbcaf98b48eb47d01d6b0125f1909d61e70405a41379c084e0",
     "f68f7fe9d1458624b3a9b5b1a76731b41d23b322864f98d3f795c6b3ef8ba45e"),
    ("EV-83", "8091001db900e483342a3cf146cf56223e6cac727f93a114ce7b482fad750c08",
     "e69ea638c1a90c14dc711eec10c3c8f9f65569ad8a073e0b1d53a880660d9469"),
    ("EV-84", "10702934763a173bef6b27f56b0952077193b0a80fa25da0440da5d73f0c7e0a",
     "d4957926a59cb7b3acf9889316e8cbae0cf76f55c50ee5a6b326bf8af9f25678"),
    ("EV-85", "6b2278b43bc3a1e9a49d995063439a48bc692dce43ad6e49fd65c18bfcf6cab2",
     "bfb10bb9b63577f5535d42c217d95372395f468457762af5bb2f6dd61b658705"),
    ("EV-86", "2c0b37161b5ed2855f2de632f5e4fec4687335060a4308b5426bc1c3ca545ff1",
     "1673db10d8aef5b1fbe0ca68f9fa43254aad342999c7a0cc5cf8402638eb0da2"),
    ("EV-87", "676076b41ec63e8a89659c27aa7ac88e7dc3f25508cac58391c18c4b335ee2d9",
     "762844987e34d36c3c2be89cdb7187464cdb3268bda5b868c3fbc91441773802"),
]
prev_records = {}
for eid, old, new in FALLBACK_RECORDS:
    prev_records[eid] = [eid, old, new, "yes",
                         "T086 generator wrote CRLF via default text-mode on Windows "
                         "(core.autocrlf=true); ledger was bound to the CRLF bytes; "
                         "canonical rule adopted T086.1 = LF-normalized text bytes "
                         "(== git blob); no content byte changed"]
if OUT.exists():
    for row in csv.reader(OUT.open(newline="", encoding="utf-8")):
        if len(row) == 5 and re.fullmatch(r"EV-\d+", row[0] or "") and HEX64.match(row[1] or ""):
            prev_records[row[0]] = row
for eid, rel, old, new, blob in rebaseline:
    prev_records[eid] = [eid, old, new, "yes" if blob == new else "no",
                         "T086 generator wrote CRLF via default text-mode on Windows "
                         "(core.autocrlf=true); ledger was bound to the CRLF bytes; "
                         "canonical rule adopted T086.1 = LF-normalized text bytes "
                         "(== git blob); no content byte changed"]

# write the audit CSV — single flat 6-column schema (validator width check)
OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["evidence_id", "source_file", "byte_class",
                "hash_field_a", "audit_result", "hash_field_b"])
    w.writerows(audit)
    for eid in sorted(prev_records):
        _, old, new, eqblob, reason = prev_records[eid]
        w.writerow([eid, "(t086.1 canonicalization record)", "old_crlf_sha256",
                    old,
                    f"new canonical sha256; equals_git_blob={eqblob}; {reason}",
                    new])
print(f"wrote {OUT}")
