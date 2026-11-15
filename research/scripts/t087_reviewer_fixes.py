#!/usr/bin/env python3
"""T087 reviewer-correction ledger fixes (post ACCEPT-WITH-CORRECTIONS)."""
import csv
import io

# ---- claims.csv: C-103 (rotate direction + writer-set scope), C-105 (grammar) ----
path = r"research\source-of-truth\claims.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
hdr = rows[0]

def sub(row, col, old, new):
    i = hdr.index(col)
    assert old in row[i], f"{row[0]}.{col}: pattern not found"
    row[i] = row[i].replace(old, new)

for r in rows[1:]:
    if r[0] == "C-103":
        # correction 1: rotate direction prose
        sub(r, "claim",
            "key = rotate-right-by-(type div 8) bytes then rotate-LEFT-by-(type mod 8) bits over the 16-byte base key at 0xB07640",
            "key = rotate-LEFT-by-(type div 8) bytes (temp[i]=key[(r+i)%%16] per 0x7A4D17) then rotate-LEFT-by-(type mod 8) bits over the 16-byte base key at 0xB07640")
        # correction 3: writer-set scope (funnel + direct-slot family)
        sub(r, "claim",
            "CAMERA WRITE FORMULA 0x5CA91A (7-site E8 census):",
            "CAMERA WRITE FUNNEL 0x5CA91A (7-site E8 census; t087-reviewer correction: a DIRECT [vt+0x90] writer family on the same namespace-cached Vector2D also exists — 0x43781F/0x692280/0x6BE6F4/0x6ED7CC verified, census open):")
        sub(r, "reasoning",
            "full byte-pattern censuses (disp32=0xD4: 208 refs; 0x48AEC3 E8 callers: 71; 0x5CA91A E8 callers: 7; [0xBDD838] refs: 113 with 1 writer) + namespace cipher re-implementation with the EV-07 cross-check",
            "full byte-pattern censuses (disp32=0xD4: 208 refs; 0x48AEC3 E8 callers: 71; 0x5CA91A E8 callers: 7 = the FUNNEL; direct slot+0x90 sites: >=4 verified, 24 candidates open; [0xBDD838] refs: 113 with 1 install + 2 release clears) + namespace cipher re-implementation with the EV-07 cross-check (blind-reviewer reproduced)")
        sub(r, "falsification",
            "a differing decrypted name for id 0x31D, a second writer of [0xBDD6F4], or an 8th E8 caller of 0x5CA91A inside the band",
            "a differing decrypted name for id 0x31D, a second install writer of [0xBDD6F4], an 8th E8 caller of 0x5CA91A inside the band, or a direct-slot site whose variants prove non-position semantics")
    if r[0] == "C-105":
        # correction 2: 0x98 grammar (three routing fixes)
        sub(r, "claim",
            "handler 0x98 = TWO-BYTE STATE MACHINE (state u8, flag u8: states 1|6 -> 0x564FBE when [this+0x774]==0; states 2|5 -> 0x56512A when ==0; state 4 -> 0x56512A when [this+0x774]==1 && flag==1, and when ==0; states 0|3 no-op)",
            "handler 0x98 = TWO-BYTE STATE MACHINE (state u8, flag u8; SIGNED compares, only state<0 or >6 is a no-op — t087-reviewer corrected: states 0|1|6 -> 0x564FBE when [this+0x774]==0; states 2|5 -> 0x564E52 when ==0; states 3|4 -> 0x56512A when [this+0x774]==1 && flag==1, else 0x564E52 when ==0)")

buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerow(hdr)
w.writerows(rows[1:])
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("claims.csv corrected")

# ---- gaps.csv: G10 (soften ONLY-place + direct-slot family), G17 (grammar) ----
path = r"research\source-of-truth\gaps.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
hdr = rows[0]
for r in rows[1:]:
    if r[0] == "G10":
        i = hdr.index("unresolved_scope")
        r[i] = r[i].replace(
            "follow cadence / deadzone: the upstream gating of the field camera writers 0x9E6D18/0x9F1ADF (virtual-dispatch targets; containing functions identified, triggers not decoded) — the ONLY place a deadzone can still live;",
            "follow cadence / deadzone: the upstream gating of the field camera writers 0x9E6D18/0x9F1ADF (virtual-dispatch targets; containing functions identified, triggers not decoded) is the primary remaining habitat for a deadzone (t087-reviewer: direct [vt+0x90] writer sites on the shared Vector2D — >=4 verified e.g. 0x43781F, census open — form an additional uncensused writer family);")
        i = hdr.index("next_action")
        r[i] = r[i].replace(
            "decode the containing functions of 0x9E6CA4 (writer A record loop) and 0x9F1ADF's parent (packed-coord path) to fix the trigger cadence;",
            "decode the containing functions of 0x9E6CA4 (writer A record loop) and 0x9F1ADF's parent (packed-coord path) to fix the trigger cadence; complete the direct-slot [vt+0x90] writer census (>=4 verified) incl. their VARIANT-arg semantics;")
    if r[0] == "G17":
        i = hdr.index("verified_scope")
        r[i] = r[i].replace(
            "0x97 = sub-opcode dispatcher (byte 7..12; sub 7/9/11 EMPTY; sub 8/10/12 arg-gated boat actions), 0x98 = 2-byte state machine (states 1|6/2|5/4 vs docked-state [this+0x774])",
            "0x97 = sub-opcode dispatcher (byte 7..12; sub 7/9/11 EMPTY; sub 8/10/12 arg-gated boat actions), 0x98 = 2-byte state machine (t087-reviewer corrected: states 0|1|6 -> 0x564FBE / states 2|5 -> 0x564E52 / states 3|4 -> 0x56512A-or-0x564E52 by docked-state [this+0x774] and flag; only state<0 or >6 no-op)")
buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerow(hdr)
w.writerows(rows[1:])
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("gaps.csv corrected")

# ---- evidence.csv: EV-90 ctor-init nuance + re-hash markers handled after regen ----
path = r"research\source-of-truth\evidence.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
hdr = rows[0]
for r in rows[1:]:
    if r and r[0] == "EV-90":
        i = hdr.index("instruction_or_data")
        # fix the ctor-writer characterization within the census sentence
        r[i] = r[i].replace(
            "with 7-site E8 writer census (ctor 0x5CA774; cursor setter 0x5CB12E/0x5CB139; "
            "0x5CB3DF; keyboard mover 0x5CB74B; field writers 0x9E6D18 record pair +0x38/+0x3C and 0x9F1ADF packed 16:16 coord)",
            "with 7-site E8 FUNNEL census (ctor re-notify 0x5CA774 — PRE-INIT values, stores follow at 0x5CA787/0x5CA78D; "
            "cursor setter 0x5CB12E/0x5CB139; 0x5CB3DF; keyboard mover 0x5CB74B; field writers 0x9E6D18 record pair +0x38/+0x3C and 0x9F1ADF packed 16:16 coord; PLUS reviewer-verified direct [vt+0x90] sites 0x43781F/0x692280/0x6BE6F4/0x6ED7CC, census open)")
buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerow(hdr)
w.writerows(rows[1:])
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("evidence.csv EV-90 corrected")

# ---- matrix: soften "only place" in P2-05/P2-06 ----
path = r"research\result\stage-readiness\P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
hdr = rows[0]
for r in rows[1:]:
    if r[0] in ("P2-05", "P2-06"):
        for col in ("unproven",):
            i = hdr.index(col)
            r[i] = r[i].replace("（deadzone 若存在只能在其上游）", "（deadzone 若存在主要藏于其上游；另有 reviewer 发现的直写槽位家族未普查）")
            r[i] = r[i].replace("若存在，只能藏在两个 field 写入者的上游门控", "若存在主要藏在两个 field 写入者的上游门控（另有直写 [vt+0x90] 家族 ≥4 站点未普查）")
buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerow(hdr)
w.writerows(rows[1:])
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("matrix softened")
