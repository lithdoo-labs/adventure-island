#!/usr/bin/env python3
"""Fix EV-89/EV-90 rows (quoting bug from manual edit): rewrite evidence.csv via csv module."""
import csv
import io

path = r"research\source-of-truth\evidence.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))

hdr = rows[0]
assert len(hdr) == 9

# Rebuild EV-89/EV-90 with clean field separation (9 columns exactly).
EV89 = [
    "EV-89",
    "research/result/stage-readiness/forensics/T087-FIELDCTX-D4-CONSTRUCTION.txt",
    "7141f64646065f831604af48ba1a40a60dd5ac281a1e8dbddb8cedbddb471c24",
    "0x9EC3E1-0x9EC4EE; 0x9EC5E3-0x9EC62A; namespace 0x7A48D0/0x40634C/0x7A4DA9/0x7A484B/0x7A48B3/0x7A4CBE; 0x48AEC3 E8 census (71 sites); 0x9EA402-0x9EA446",
    "instruction+census",
    ("fieldctx ctor 0x9EC3E1 installs [0xBDD6F4]; zeroes +0xD4; resolves namespace id 0x31D and attaches the object via "
     "0x447891 (0x9EC4EE); then calls [vt+0x90](obj; -400; -300; V; V) (0x9EC61A/0x9EC620/0x9EC62A); namespace record-name "
     "cipher fully re-implemented (rotate16+XOR): id 0x31D='Shape2D#Vector2D'; id 0x819='Gr2D_DX8' (EV-07 cross-check); "
     "0x9EA446 world->screen edge screen=world-camera; full disp32=0xD4 census in the companion CSV "
     "(b337305600401ba644e3f3ff883ec5766797c83db03f64826959155647cbbe07)"),
    ("[fieldctx+0xD4] = the shared Shape2D#Vector2D world camera; initial value (-400; -300); source of C-103"),
    "C-103",
    "research/scripts/t087_wp1_fieldctx_d4.py (sha-pinned; companion census CSV)",
]
EV90 = [
    "EV-90",
    "research/result/stage-readiness/forensics/T087-BDD838-CLASS-VTABLE.txt",
    "940c8a4ca0511b5e6629e7ae17160f1392aa9b60fd326626af9514591c3ae306",
    "0xA0125F-0xA01318; 0x5CA5A9-0x5CA909; 0x5CA91A-0x5CA9E1; 0x5CB0E0-0x5CB167; 0x9E6CF8-0x9E6D1D; 0x9F1AD2-0x9F1AEA",
    "instruction",
    ("[0xBDD838] has exactly ONE global writer (0xA012E5; ctor A 0xA012D3; 0xA04-byte object; ctor B 0x5CA5A9): devices via "
     "[0xBE157C]; key tables from 0xBA1D7B; cursor pos init (400;300) at 0x5CA787/0x5CA78D; namespace id 0xA58='UI/Basic.img/"
     "Cursor/%d' at +0x97C; the SAME id-0x31D Vector2D at +0x9B0 (0x5CA6B1); CAMERA FORMULA 0x5CA91A: [Vector2D.vt+0x90]"
     "(obj; x-400; y-300; V; V) at 0x5CA9C1 with 7-site E8 writer census (ctor 0x5CA774; cursor setter 0x5CB12E/0x5CB139; "
     "0x5CB3DF; keyboard mover 0x5CB74B; field writers 0x9E6D18 record pair +0x38/+0x3C and 0x9F1ADF packed 16:16 coord); "
     "full [0xBDD838] reference census in the companion CSV (cff57f6f04df72701acde2b4cf03dd6cfdc39fb280cbda0ba881a1c62e390452)"),
    ("[0xBDD838] = input/cursor manager singleton; camera := point - (400; 300); source of C-103/C-104"),
    "C-103;C-104",
    "research/scripts/t087_wp2_singleton_camera.py (sha-pinned; companion alias CSV)",
]

out = []
for r in rows:
    if r and r[0] == "EV-89":
        out.append(EV89)
    elif r and r[0] == "EV-90":
        out.append(EV90)
    else:
        out.append(r)

buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerows(out)
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("evidence.csv rows rewritten")
