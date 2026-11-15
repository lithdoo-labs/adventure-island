#!/usr/bin/env python3
"""Append C-103..C-105 to claims.csv (LF line endings, csv-quoting)."""
import csv
import io

path = r"research\source-of-truth\claims.csv"

new_rows = [
    ["C-103", "Camera",
     "G10 IDENTITY+FORMULA RESOLUTION (t087, EV-89/EV-90): [fieldctx+0xD4] IS the world camera and it is the SHARED namespace object id 0x31D = 'Shape2D#Vector2D' (name statically decrypted by re-implementing the namespace cipher 0x7A4DA9/0x7A484B/0x7A48B3/0x7A4CBE: key = rotate-right-by-(type div 8) bytes then rotate-LEFT-by-(type mod 8) bits over the 16-byte base key at 0xB07640, plain = cipher XOR key[i mod 16]; cross-check id 0x819='Gr2D_DX8' matches EV-07); the SAME instance is attached at [singleton+0x9B0] (0x5CA6B1) — one namespace slot per id, so [fieldctx+0xD4] == [0xBDD838]+0x9B0; fieldctx ctor 0x9EC3E1 installs [0xBDD6F4], zeroes +0xD4, attaches the object via 0x447891 (0x9EC4EE) and immediately calls [vt+0x90](obj, -400, -300, V, V) (0x9EC61A/0x9EC620/0x9EC62A) — the negative half-screen vector, i.e. Set centres the WORLD ORIGIN at screen (400,300); CAMERA WRITE FORMULA 0x5CA91A (7-site E8 census): [Vector2D.vt+0x90](obj, x-0x190, y-0x12C, V, V) at 0x5CA9C1 — camera := point - (400,300), writers = singleton-ctor init 0x5CA774, cursor setter 0x5CB0E0 (0x5CB12E/0x5CB139), 0x5CB3DF, keyboard mover 0x5CB74B, FIELD writers 0x9E6D18 (record pair +0x38/+0x3C) and 0x9F1ADF (packed 16:16 dword: low word x, high word y); world->screen edge PROVEN at 0x9EA446 (screen = world - camera, both X's read via the 0x404B07 getter wrapper); 0x9EC924/0x9EC989 are therefore SCREEN<->WORLD CONVERTERS (cursor + camera / in - camera), not camera IO; Shape2D.dll hosts the class (RTTI '.?AVCWzVector2D@@' + UTF-16 'Shape2D#Vector2D' at .data 0x115D0, dll sha256 9802bacc..c8111b); BOUNDED: follow cadence/deadzone of the two field writers (the only place a deadzone could live) NOT decoded; Shape2D-internal routing behind vt+0x90 goes through its PCOM property layer (EXE-side contract + observable X/Y semantics proven, internal stores not instruction-traced)",
     "CLOSED-STATIC", "A", "EV-89;EV-90", "unpack079+Shape2D.dll",
     "0x9EC3E1-0x9EC4EE; 0x9EC5E3-0x9EC62A; 0x5CA91A-0x5CA9C1; 0x5CB0E0; 0x9E6CF8-0x9E6D1D; 0x9F1AD2-0x9F1AEA; 0x9EA402-0x9EA446; 0x7A4DA9/0x7A484B/0x7A48B3/0x7A4CBE; Shape2D.dll 0x115D0/0x10248",
     "full byte-pattern censuses (disp32=0xD4: 208 refs; 0x48AEC3 E8 callers: 71; 0x5CA91A E8 callers: 7; [0xBDD838] refs: 113 with 1 writer) + namespace cipher re-implementation with the EV-07 cross-check",
     "a differing decrypted name for id 0x31D, a second writer of [0xBDD6F4], or an 8th E8 caller of 0x5CA91A inside the band",
     "(none)",
     "forensics/T087-FIELDCTX-D4-CONSTRUCTION.txt;T087-FIELDCTX-D4-WRITER-CENSUS.csv;T087-BDD838-CLASS-VTABLE.txt;T087-BDD838-WRITER-ALIASES.csv;T087-CAMERA-DATAFLOW-AND-FORMULAS.md"],
    ["C-104", "Camera",
     "[0xBDD838] IDENTITY RESOLVED (t087, EV-90/EV-91): the singleton is the INPUT/CURSOR MANAGER (report-level UI-SCROLL-SURFACE / SHARED-SCREEN-COORDINATE-SERVICE hybrid), NOT the world camera: exactly ONE global writer (0xA012E5; created 0xA0125F: 0xA04-byte object, ctor A 0xA012D3 + ctor B 0x5CA5A9); layout — device objects via [0xBE157C](0,0,0,0) at +0x14/+0x18/+0x1C and the +0x10 switchable device (0x5CBDF7), 256-entry key tables +0x24/+0x424 filled from the 204-byte table 0xBA1D7B, flags +0x92C, CURSOR position +0x938/+0x93C initialized to (400,300) = SCREEN CENTRE (0x5CA787/0x5CA78D) and clamped [0,800]x[0,600] in 0x5CB0E0, speed +0x970, cursor sprites at +0x97C (namespace id 0xA58 = 'UI/Basic.img/Cursor/%d'), the shared camera Vector2D at +0x9B0, notify queue +0x9BC (cmds 0x200/0x500); input dispatch 0x5CAB38 driven at 0x9FEE24 by mode [0xBE179C](3,input+0x88,0): case0 keyboard processor 0x5CB9EC (256-byte device read via [dev+0x24], prev-state table, edge-toggled flags 0x10000000/0x20000000 in +0x92C), case1 0x5CB573 keyboard-axis cursor mover (T086.1 formula re-verified; every move ALSO writes the camera via 0x5CA91A — cursor-followed camera mode), case2 0x5CBE2A joystick processor (0x110-byte state, +/-0x2BC=700 deadband, +/-0x3E8=1000 saturation, edge flags +0x9DE/+0x9DF, cmd {0x500,3,0}); post-dispatch 0x5CAB5F reads the +0x9C4/+0x9C8 triple and 0xA020E2 re-dispatches it as WINDOW MESSAGES (0x100 WM_KEYDOWN band, mouse band 0x200-0x20A forwarded WITH (x,y) into [0xBDD6F4] methods) — resolving the T086.1 'two UI-grid producers vs one input updater' ambiguity: ALL position producers target the CURSOR; the class NAME stays unrecoverable (no RTTI in the packed EXE)",
     "CLOSED-STATIC", "A", "EV-90;EV-91", "unpack079",
     "0xA0125F-0xA01318; 0x5CA5A9-0x5CA909; 0x5CAB38-0x5CAB5C; 0x5CB9EC; 0x5CBE2A; 0x9FEDCE-0x9FEE4B; 0xA020E2-0xA0213C",
     "single-writer proof by full-band global census (113 refs); all three dispatch cases decoded from raw bytes; [0xBDD838] role = behavioural classification (bounded, no RTTI)",
     "a second writer of the global 0xBDD838, or a fourth dispatch case reaching +0x938/+0x93C",
     "(none)",
     "forensics/T087-BDD838-CLASS-VTABLE.txt;T087-BDD838-WRITER-ALIASES.csv;T087-5CB573-INPUT-UPDATE.txt;T087-CAMERA-DATAFLOW-AND-FORMULAS.md"],
    ["C-105", "Protocol",
     "G17 BOAT_EFFECT payload grammars (t087, EV-92; names remain UNRESOLVED-VERSION-AUTHORITY per the T086.1 discipline): router 0x5658FF (scene-family vtable slot47) binds 0x97 -> 0x565935 and 0x98 -> 0x56599A (both this-8 adjusted), default -> 0x54112E; handler 0x97 = SUB-OPCODE dispatcher (first payload byte in {7..12}: sub 7/9/11 are EMPTY ret-4 stubs; sub 8 takes one arg byte, ==2 -> 0x564E52(boat); sub 10 takes one arg byte, 4 -> 0x56512A, 5 -> 0x565492; sub 12 takes one arg byte, ==6 -> 0x564FBE); handler 0x98 = TWO-BYTE STATE MACHINE (state u8, flag u8: states 1|6 -> 0x564FBE when [this+0x774]==0; states 2|5 -> 0x56512A when ==0; state 4 -> 0x56512A when [this+0x774]==1 && flag==1, and when ==0; states 0|3 no-op); both grammars drive the SAME boat object at this+0x768 with docked-state dword this+0x774; 0x564FBE and 0x564E52 both resolve namespace id 0x43A = 'Whistle' (sound resource) under mutually exclusive gates ([boat+0x40]!=0&&[boat+0xC]==0 vs [boat+0x44]!=0&&[boat+0xC]==1); jar cross-check: recvops has SHIP_OBJECT=0xD9 and NO BOAT_EFFECT entry; sendops has BOAT_EFFECT=0x98/BOAT_HIDE=0x99 — the payload grammars are mutually exclusive shapes over one object and neither can adjudicate the send-side name, so no naming upgrade is made",
     "PARTIAL-STATIC", "B", "EV-92", "unpack079+server079.jar",
     "0x5658FF-0x565934; 0x565935-0x565998; 0x56599A-0x565A1D; 0x565A1F-0x565A7E; 0x564FBE-0x564FEC",
     "full handler disassembly incl. all sub-opcode branches + namespace record decryption of id 0x43A + jar properties grep",
     "a CMS079 client instruction or credible production source binding the name BOAT_EFFECT to 0x97/0x98 in the recv namespace",
     "(none)",
     "forensics/T087-G17-BOAT-0x97-0x98.txt"],
]

with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
assert rows[-1][0] == "C-102"
buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
for r in new_rows:
    w.writerow(r)
with open(path, "a", encoding="utf-8", newline="") as f:
    f.write(buf.getvalue())
print("appended", len(new_rows), "claims")
