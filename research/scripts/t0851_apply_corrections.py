#!/usr/bin/env python3
"""t085.1 D1/D2/D4/D5/D6 corrections: evidence hashes + claim wording."""
import csv
import os
import sys

SOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "research", "source-of-truth")

def update_evidence_sha():
    path = os.path.join(SOT, "evidence.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    new_hash = {
        "EV-78": "5cfad9a52e2d6be5a589e7b2d00ba848b1600d205c608a4f1af5e1a3e40f3b4e",
        "EV-79": "8720a2b0455fa2ea771b068009e8a80f26e9e7ab71247324f691dd7d7d75d5e7",
        "EV-81": "434de673e62998b9130c4b0abb149c71a9f89e5a1d818eb08cb83e0f59c19594",
    }
    for r in rows[1:]:
        if r[0] in new_hash:
            r[2] = new_hash[r[0]]
    with open(path, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)
    print("evidence hashes updated:", list(new_hash))

def patch_claim(claim_id, old, new):
    path = os.path.join(SOT, "claims.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    hit = 0
    for r in rows[1:]:
        if r[0] == claim_id:
            for i in range(len(r)):
                if old in r[i]:
                    r[i] = r[i].replace(old, new)
                    hit += 1
    with open(path, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"{claim_id}: {hit} field(s) patched")

def main():
    update_evidence_sha()
    # D1: [M+0x120] census wording - receiver-provenance-bounded, not encoding-exhaustive
    patch_claim("C-088",
        "DEAD BRANCHES (census-proven): [M+0x120] has NO setter in the image (ctor=0 0x9BC348 + slot5 and0 0x9BFB9D only; all encodings incl and/pop/SIB/rep-movs checked) so the pinned-segment filter",
        "DEAD BRANCHES (census-bounded by receiver provenance, t085.1 D1 wording): no write of a move-object +0x120 with a nonzero value exists in the movement family (direct disp32 census: ctor=0 0x9BC348 + slot5 and0 0x9BFB9D only; no rep-movs alias into [M+0x100..0x128]; the image does contain a LEA-alias installer 0x9B7F43->0x9B87EA@0x9B8817 for a NON-M class - callers 0x7540B4/0x754384/0xA15EF5/0xA32327 - so the no-setter claim is bounded to M-provenance, not to encoding exhaustion) so the pinned-segment filter")
    patch_claim("C-088",
        "any setter of M+0x120 anywhere in the image (would re-live the dead branches), or a target-map foothold with x1>x2",
        "any write of a nonzero value into a move-object +0x120 (would re-live the dead branches), or a target-map foothold with x1>x2")
    # D2: two interaction sites + inert co-occurrence + census window bound
    patch_claim("C-094",
        "Exactly two sites where the constants meet, neither a conversion",
        "Exactly two sites where the constants INTERACT, neither a conversion (an inert co-occurrence exists in T5 tick 0x9CBE89: 0x9CC0CF push 0x1E and 0x9CC640 and edi,0x5A share the function without interacting); censuses bounded to the 0x401000-0xA80000 instruction window")
    patch_claim("C-094",
        "(b) 0x9C9CF7 (T4 slot9, vtable dword 0xB0C884+0x24)",
        "(b) 0x9C9CF7 (T4 slot9, vtable dword 0xB0C894 = 0xB0C870+0x24)")
    # D4 + D6: census count + 0x948BD8
    patch_claim("C-090",
        "all 30 `call [reg+0x38]` sites censused (2 SIB false positives excluded); 0x965A09 exists in exactly one image dword (0xB0BD60 = user vt 0xB0BD28 slot14). Exactly THREE user dispatch sites exist:",
        "all `call [reg+0x38]` sites censused: 29 code sites + 1 data-section coincidence (0xC93B63 beyond .text) + 2 SIB data-island false positives (0xB2418B/0xB9147B); 0x965A09 exists in exactly one image dword (0xB0BD60 = user vt 0xB0BD28 slot14). Exactly THREE user dispatch sites exist (plus one user-family-LIKELY site 0x948BD8 inside 0x948B66 - same 0x4B1C27+p-0xC M-retrieval idiom and [ebx+0x2C]/0x70DF65 gate signature as 0x948AA2, but the receiver is formally unproven this round and it is counted separately):")
    return 0

if __name__ == "__main__":
    sys.exit(main())
