#!/usr/bin/env python3
"""T087 ledger fixes: C-028 upgrade, G10/G17 gap scope updates, crosswalk note."""
import csv
import io
import re

REPO = r"."

def rewrite(path, fn):
    with open(path, encoding="utf-8", newline="") as f:
        text = f.read()
    new = fn(text)
    assert new != text, f"no change applied to {path}"
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(new)
    print("updated", path)

# ---- claims.csv: C-028 upgrade (row-level, robust to quoting) ----
with open(r"research\source-of-truth\claims.csv", encoding="utf-8", newline="") as f:
    crows = list(csv.reader(f))
chdr = crows[0]
for r in crows[1:]:
    if r[0] == "C-028":
        assert r[3] in ("OPEN-RUNTIME", "PARTIAL-STATIC"), r[3]
        r[3] = "PARTIAL-STATIC"
        r[4] = "A"
        r[5] = "EV-21;EV-89;EV-90"
        r[6] = "unpack079+Shape2D.dll"
        r[7] = "0x9EC5E3-0x9EC62A;0x5CA91A-0x5CA9C1;0x9EA402-0x9EA446;0x9EC924/0x9EC989"
        r[8] = ("t087 (C-103/EV-89/EV-90): world-to-screen RECOVERED STATICALLY — screen = world - camera with camera = [fieldctx+0xD4] "
                "(shared Shape2D#Vector2D, ctor initial (-400,-300), i.e. world origin centred at screen (400,300)); camera WRITE formula "
                "camera := point - (400,300) at 0x5CA91A with a 7-site writer census incl. two field-family world-space writers (0x9E6D18 "
                "record pair, 0x9F1ADF packed 16:16); screen<->world converters 0x9EC924/0x9EC989 combine cursor+camera; STILL OPEN: follow "
                "cadence/deadzone (the upstream gating of the two field writers — the only place a deadzone could live — not decoded) and "
                "camera-vs-map-edge clamp (VR bounds feed the slot15 CULL window, no camera-side clamp proven)")
        r[9] = ("any additional E8 caller of 0x5CA91A in-band, or a deadzone/threshold constant inside the 0x9E6CA4/0x9F1ADF containing "
                "functions once decoded")
        r[11] = "MAP-CAMERA-REVERSE.md;GAP-REGISTER G10;R-04/R4-08;forensics/T087-CAMERA-DATAFLOW-AND-FORMULAS.md"
buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerow(chdr)
w.writerows(crows[1:])
with open(r"research\source-of-truth\claims.csv", "w", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("updated claims.csv C-028")

# ---- gaps.csv: G10 scope update ----
with open(r"research\source-of-truth\gaps.csv", encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
hdr = rows[0]
for r in rows[1:]:
    if r[0] == "G10":
        r[3] = ("PARTIAL-STATIC")
        r[4] = ("VR fold A (C-026); scene-manager skeleton (C-084); t086 (C-101/EV-87): slot15 caller census encoding-complete, slot12 direct caller 0x5658CA, 0x953AF4 dispatcher; "
                "t086.1 (C-102/EV-88): slot15 consumption chain + [0xBDD838] read/write architecture + 800x600-clamped wrapper writer + second direct writer 0x5CB573; "
                "t087 (C-103/C-104, EV-89/EV-90/EV-91) IDENTITY+FORMULA RESOLVED: [fieldctx+0xD4] = the shared namespace object id 0x31D 'Shape2D#Vector2D' (name statically decrypted; Shape2D.dll hosts CWzVector2D) — THE WORLD CAMERA; ctor 0x9EC3E1 installs [0xBDD6F4] and sets the camera to (-400,-300) (world origin centred); camera WRITE formula 0x5CA91A: camera := point-(400,300) with 7-site writer census incl. field writers 0x9E6D18 (record +0x38/+0x3C) and 0x9F1ADF (packed 16:16); world->screen edge 0x9EA446: screen = world - camera; 0x9EC924/0x9EC989 = screen<->world converters (cursor+camera); [0xBDD838] = INPUT/CURSOR MANAGER singleton (single writer 0xA012E5; cursor pos init (400,300); keyboard 0x5CB9EC / mover 0x5CB573 / joystick 0x5CBE2A dispatch; cursor sprites id 0xA58 'UI/Basic.img/Cursor/%d'; WM-band forwarding 0xA020E2) — resolves the T086.1 two-producer ambiguity: all its writers target the CURSOR, and cursor moves additionally write the camera (cursor-followed mode)")
        r[5] = ("follow cadence / deadzone: the upstream gating of the field camera writers 0x9E6D18/0x9F1ADF (virtual-dispatch targets; containing functions identified, triggers not decoded) — the ONLY place a deadzone can still live; camera-vs-map-edge clamp (VR bounds feed the slot15 cull window, no camera-side clamp proven); [scene+0x1CC] inner-object installer (slot15 X1/Y1 source); Shape2D-internal routing behind Vector2D vt+0x90 (PCOM property layer; EXE-side contract proven)")
        r[7] = ("decode the containing functions of 0x9E6CA4 (writer A record loop) and 0x9F1ADF's parent (packed-coord path) to fix the trigger cadence; find the [scene+0x1CC] installer in the slot15-family ctor chain")
        r[8] = ("world->screen transform + camera centering + per-map initial camera now EXACTLY implementable (ORIGINAL-STATIC-PROVEN); follow cadence/deadzone stays a design decision bounded by the proven write sites")
        r[9] = "C-026;C-027;C-028;C-084;C-101;C-102;C-103;C-104"
    if r[0] == "G17":
        r[4] = (r[4] + "; t087 (C-105/EV-92): BOAT 0x97/0x98 payload grammars decoded — 0x97 = sub-opcode dispatcher (byte 7..12; sub 7/9/11 EMPTY; sub 8/10/12 arg-gated boat actions), 0x98 = 2-byte state machine (states 1|6/2|5/4 vs docked-state [this+0x774]), both over boat object this+0x768 with the 'Whistle' sound (namespace 0x43A); jar: sendops BOAT_EFFECT=0x98/BOAT_HIDE=0x99, recvops SHIP_OBJECT=0xD9 with no BOAT_EFFECT row")
        r[9] = "C-047;C-095;C-105"

with open(r"research\source-of-truth\gaps.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(hdr)
    w.writerows(rows[1:])
print("updated gaps.csv")

# ---- crosswalk G17 note ----
with open(r"research\source-of-truth\issue-crosswalk.csv", encoding="utf-8", newline="") as f:
    xrows = list(csv.reader(f))
xhdr = xrows[0]
for r in xrows[1:]:
    if r[0] == "G17":
        r[4] = (r[4] + "; t087: payload grammars for both handlers decoded (C-105), names remain unresolved version authority")
with open(r"research\source-of-truth\issue-crosswalk.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(xhdr)
    w.writerows(xrows[1:])
print("updated crosswalk")
