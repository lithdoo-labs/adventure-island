#!/usr/bin/env python3
"""T086 ledger update — appends claims C-095..C-101 and evidence EV-82..EV-87,
and updates gap rows G01/G07/G08/G09/G10/G17/G22/G24/G33 per the T086 report.
Column-exact (claims 12 cols, evidence 9 cols). Idempotent.
"""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CLAIMS = REPO / "research/source-of-truth/claims.csv"
EVID = REPO / "research/source-of-truth/evidence.csv"
GAPS = REPO / "research/source-of-truth/gaps.csv"

NEW_CLAIMS = [
    ["C-095", "Protocol",
     "G17 provenance audit: all 442 corpus opcode values trace to server079.jar recvops/sendops.properties (355 direct + 11 explicit 0xFF) or the ExternalCodeTableGetter default (76 = 0xFFFE; 75 enum-absent + MARRAGE_RECV), zero corpus-vs-jar conflicts; jar properties are value-identical to public ms079 on all 366 entries and conflict with Afauria's public 079 on 15 names; NEW client-instruction tier: EXE switch 0xA10CE3 (lea eax,[edx-0x20]; cmp 0x60; jmp [eax*4+0xA111A1]) statically binds 97 message ids 0x20..0x80 (92 non-default) to handler bodies = task44 map 92/92 (task44 rva+0x400000); handlers consume packets via 0x4066C9 readers; the old C-047 'properties not on disk' blocker text was stale (367 = 442-75 non-FFFE rows)",
     "CLOSED-STATIC", "A", "EV-83;EV-84", "server079.jar+unpack079",
     "jar:recvops.properties;sendops.properties;0xA10CE3-0xA111A1",
     "three-way join script t086_wp0_opcode_provenance.py + switch walker t086_client_dispatch_proof.py; both sha-pinned; public-server files fetched from mrzhqiang/ms079 and Afauria/MapleStory-Server-079 (URLs in report, not committed)",
     "any corpus row whose value is not reproducible from the jar properties + default rule",
     "(none)", "T086-STATIC-GAP-CLOSURE-REPORT.md;forensics/T086-G17-OPCODE-PROVENANCE.csv"],
    ["C-096", "Gr2D",
     "slot25 0x5040418C product node concrete class (t086, resolves G24's static residual): [ebp+8] arg slot is REUSED as a local at 0x50404215; 0x50405846 acquires a punk via 0x50406233 ([0x5043A198]->0x504074CF->ctor 0x504067D7(0)) and QIs it via 0x504062AA for IID @0x50436540 = {6DC8C7CE-8E81-4420-B4F6-4B60B7D5FCDF}; ctor 0x504067D7 installs vtable stack {+0: 0x5042E3F0 (76 code slots, adjoins intmap 0x2E520 exactly), +4: 0x5042E3EC, +8: 0x5042E3E8, +0xC: 0x5042E3D0 (6-slot tree-payload interface)}; QI thunk slot0 0x50406AB4 pushes intmap 0x5042E520 whose entry0 {piid=0x50436540(6DC8C7CE), dw=0, simple} -> QI returns pThis (primary); slot45(+0xB4)=0x50409ECD, slot56(+0xE0)=0x50409DBA (ARGB decompose to [obj+0x38]/[+0x3C]/[+0x34] sub-objects); *arg15 = the QI result at 0x504045CB",
     "CLOSED-STATIC", "A", "EV-82", "gr2d",
     "0x504041A0-0x504045CB;0x50405846;0x50406233;0x504062AA;0x504067D7;0x50406AB4;0x5042E3F0;0x5042E520;0x50436540",
     "full chain disassembled this round (sha-pinned scripts t086_wp1*); IID single-occurrence in Gr2D .data",
     "a different constructor installing 0x5042E3F0 at [obj+0] for an unrelated class",
     "(none)", "T086-STATIC-GAP-CLOSURE-REPORT.md;forensics/T086-EV82-NODE-CLASS-INSERT-COMPARATOR.txt"],
    ["C-097", "Map/Sort",
     "slot45 keyed ordered-tree insert + comparator recovered (t086; closes G01/G07 static territory — narrows and supersedes-in-part the refuted blanket C-012 reading, which scanned a candidate set that omitted the real primary table): slot45 0x50409ECD (ret 8) forwards (arg2=key, &node[0xC], node[0xF8]) thiscall to the container at [node+0x2C] via 0x50409EF4 — empty path payload SETKEY(slot1, key->node+0x44)/SETTAG(slot5, ->node+0xF8); non-empty path tree search 0x5040390D, GETKEY(slot0) vs new key compare, container count++, then comparator-steered insertion (iterator 0x50405476 / tree 0x5040C35E); COMPARATOR = free function 0x50403A42: payload slot4 (node+0xF8 chain) climb to comparable level, then slot0 (key dword node+0x44) compare with sign result; EQUAL-KEY TIE-BREAK compares slot0 keys of both (deterministic secondary order, not stable-insert; upgrades G33); fully-equal returns 0 with paired slot3(1) AddRef; C-075 keyed-carry reading now instruction-confirmed",
     "CLOSED-STATIC", "A", "EV-82", "gr2d",
     "0x50409ECD;0x50409EF4;0x50403A42;0x5040390D;0x50405476;0x5040C35E;0x5042E3D0 slots 0-5",
     "full bodies this round; payload vtable 0x5042E3D0 six methods dumped (getkey/setkey/indexed-array/gettag/settag)",
     "any comparison inside the chain not reducible to the slot0-key compare with tie-break",
     "(resolves the G07 comparator endpoint; runtime corroboration optional)", "T086-STATIC-GAP-CLOSURE-REPORT.md;forensics/T086-EV82-NODE-CLASS-INSERT-COMPARATOR.txt"],
    ["C-098", "Gr2D",
     "G22 RawCanvas-family vtable start ambiguity RESOLVED (t086): the 0x2E2C4/0x2E2CC '149/151-slot family' tables are purecall-padded ABSTRACT interface stubs — 0x50402A30 installs 0x5042E2C4 on a 0x10-byte subobject stored at [owner+0x384]; 0x50402874 installs 0x5042E2EC/[esi+4]=0x5042E2D8 whose entries from 0x2E2D8 to 0x2E378 are ALL jmp [0x5042D0A0] (the __imp__purecall thunk, C-009); the REAL 6DC8C7CE-class primary vtable is 0x5042E3F0 (76 slots, adjoins intmap 0x2E520) installed by ctor 0x504067D7",
     "CLOSED-STATIC", "A", "EV-82", "gr2d",
     "0x50402A30;0x50402874;0x5042E2C4;0x5042E2D8;0x5042E380;0x5042E3F0",
     "vtable-install census (C7 imm32 scan over the table block) + dword map + ctor windows",
     "a live object whose primary vtable is 0x2E2C4 or 0x2E2CC with non-purecall slot45",
     "(supersedes the G22 two-start question; slot numbering concerns for the stub tables are moot)",
     "T086-STATIC-GAP-CLOSURE-REPORT.md"],
    ["C-099", "Map/Sort",
     "CMS079 avatar insertion key formula (t086, machine-code recovered; closes G08): key = 10*(layer*3000 - zM) - 0x40000000 + 29990 + (flag!=0 ? 7 : 2) where the object is [user+0xF28] (M-holder family), layer/zM at field+0x130/+0x134 (same layout as tile key C-001), flag = field+0x18 dword (neg/sbb yields 5-or-0, then +1+1); two avatar sites compute this expression: 0x9363D9 passes the key to 0x452147 whose body does push key; push [[this+0x88]+0xE44]; call [eax+0xB4] (the C-097 keyed slot), while 0x93E7F2 (imul ecx,ecx,0xBB8 @0x93E80D) applies a further -1 (dec edi) and feeds a 0x427EB3-family PUT wrapper 0x439AAD (VT_ERROR-missing VARIANT init from 0xBE7330); type-base family enumerated: -2^31+{29983..29999} lea disp32 at 34 sites — avatar 29990 (0x93E80D/0x6C45A4/0x70DDD7/0x741942), mob 29991 (0x6C3ABD/0x7A9A0E + 0x693xxx per-state cluster 29983-29991), NPC 29995 (0x5181E6/0x9889A8/0x989AED/0x6C3A2C), drop 29999 (0x50ED77), avatar-variant 29992 (0x7A99D5), 29996 (0x48CE02/0x9882E4), obj-like 30000*x-2^31 (0x559F07) and 59970/59980 family (0x559F39/0x559F6B); v83 OpenMS constants were NOT copied — structure isomorphic, constants CMS079-native",
     "CLOSED-STATIC", "A", "EV-85", "unpack079",
     "0x9363D9-0x936410;0x93E7F2-0x93E82A;0x48CDF2-0x48CE0E;0x50ED69-0x50ED80;0x5181D9-0x5181EF;0x559EFB-0x559F6B;imul 0xBB8 sites;lea -0x3FFF8Axx census",
     "immediate census (29991/29992/29995/29999 as plain immediates: ZERO hits — constants live in lea disp32) + disp32 window census + per-site windows (t086_wp2/wp2b)",
     "a differing instruction sequence at 0x9363D9/0x93E7F2 or an avatar-registration key site outside the 34-site family",
     "(refines the C-025 avatar-ordering product rule)", "T086-STATIC-GAP-CLOSURE-REPORT.md;forensics/T086-G08-KEY-SITES-DISASM.txt"],
    ["C-100", "Avatar",
     "CMS079 avatar layer DATA anchors (t086, shipped-WZ side): zmap.img / zmap_cn.img / smap.img / StandardPDD.img live in Base.wz (not Character.wz/Etc.wz); zmap.img = exactly 149 layers (matches the C-043 EXE-consumed model); zmap_cn.img is order-identical to zmap.img (China variant is a no-op for ordering); smap.img = 147 entries with 106 layer-name->component-code bindings (e.g. cap = CpHdH1H2H3H4H5H6HsHfHbAfAyAsAe, mailArmOverHair = MaGw, handOverHair = Bd) encoding equipment-part participation/hide rules as data; combined with C-043 (EXE consumption) and C-097/C-099 (world-order mechanism) both the internal part order and the cross-object order are static",
     "CLOSED-STATIC", "A", "EV-86", "Base.wz",
     "Base.wz:zmap.img;zmap_cn.img;smap.img;StandardPDD.img",
     "wz-python (repo-local task-023 tool, EMS region, version 79) property walk; deterministic dump committed",
     "a zmap/zmap_cn ordering difference or an EXE consumer contradicting the smap bindings",
     "(completes the G09 data side)", "T086-STATIC-GAP-CLOSURE-REPORT.md;forensics/T086-G09-ZMAP-SMAP.txt"],
    ["C-101", "Camera",
     "G10 static advance (t086): slot15 (0x53471A) call-site census COMPLETE — 28 call [reg+0x3C] disp8 sites, 0 disp32-form, 0 SIB-form, 0 direct E8 callers (33 vtable slots only); receiver provenance of all 28 belongs to life/UI/COM/string-layer families, none provably the scene family (T084 bounded negative now enumeration-complete); NEW: slot12 0x53465B has exactly one direct E8 caller 0x5658CA inside window-method 0x5658BF (per-tick + 0x28-count periodic logic) — first static frame-loop entry point; 0x953AF4 (per-draw) is a 4-way arg dispatcher to 0x9563E7/0x956411/0x9564EE/0x956AC3 (fieldctx/UI queries), not a camera producer; STRUCTURAL conclusion: slot15 consumes the camera rect as caller-supplied ARGS vs persistent scene+0x1D0/+0x1D4 world bounds, and the only persistent camera fields are the load-time VR fold bounds (C-026) — the per-frame camera value is caller-transient by construction; producer identity remains runtime-bound",
     "PARTIAL-STATIC", "B", "EV-87", "unpack079",
     "28 sites (see EV-87);0x5658CA;0x5658BF;0x953AF4-0x953B3A;0x53471A dword census",
     "encoding-complete call census + full windows; 0x53465B/0x5346EF/0x5348E8/0x533EA4 E8-caller census",
     "a scene-family receiver provable at any of the 28 sites, or a camera-rect write into a persistent scene field",
     "(none)", "T086-STATIC-GAP-CLOSURE-REPORT.md;forensics/T086-G10-SLOT15-CALLER-WINDOWS.txt"],
]

NEW_EVID = [
    ["EV-82", "research/result/stage-readiness/forensics/T086-EV82-NODE-CLASS-INSERT-COMPARATOR.txt",
     "5a62eb9da593a1fbcaf98b48eb47d01d6b0125f1909d61e70405a41379c084e0",
     "0x504041A0;0x50405846;0x50406233;0x504062AA;0x504067D7;0x50406AB4;0x5042E520;0x50436540;0x50409ECD;0x50409EF4;0x50403A42;0x5040390D;0x5042E3D0 slots0-5",
     "instruction",
     "full disassembly windows of the node ctor / QI / slot45 / insert / comparator chain",
     "node ctor vtable stack + QI intmap 6DC8C7CE + slot45 keyed-insert forward + comparator body + payload table methods (source of C-096/C-097/C-098)",
     "C-096;C-097;C-098", "research/scripts/t086_ev82_generator.py (sha-pinned, PE model 0x50400000)"],
    ["EV-83", "research/result/stage-readiness/forensics/T086-G17-OPCODE-PROVENANCE.csv",
     "8091001db900e483342a3cf146cf56223e6cac727f93a114ce7b482fad750c08",
     "n/a (442-row join)", "csv",
     "442 rows x {direction,opcode_hex,name,jar_property,value_source,notes_field,task055_check}",
     "per-opcode value-source classification: 355 SERVER-PROPERTIES / 11 FF / 76 DEFAULT-FFFE / 0 conflicts",
     "C-095", "research/scripts/t086_wp0_opcode_provenance.py"],
    ["EV-84", "research/result/stage-readiness/forensics/T086-G17-CLIENT-DISPATCH-0xA10CE3.txt",
     "10702934763a173bef6b27f56b0952077193b0a80fa25da0440da5d73f0c7e0a",
     "0xA10CE3-0xA111A1; table 0xA111A1 (97 cases, values 0x20..0x80)", "instruction",
     "switch head + 97 stub callees + task44 join table",
     "static opcode->handler switch; 92/92 agreement with task44 runtime map (rva+0x400000)",
     "C-095", "research/scripts/t086_client_dispatch_proof.py"],
    ["EV-85", "research/result/stage-readiness/forensics/T086-G08-KEY-SITES-DISASM.txt",
     "6b2278b43bc3a1e9a49d995063439a48bc692dce43ad6e49fd65c18bfcf6cab2",
     "34 lea sites + imul sites (0x9363D9/0x93E7F2/0x50ED77/0x5181E6/0x559F07...)", "instruction",
     "per-site +-0x40 disassembly windows of the key lea/imul family",
     "avatar/mob/npc/drop/obj key formula windows; constants as lea disp32 (-2^31+299xx family)",
     "C-099", "research/scripts/t086_wp2_avatar_census.py + t086_wp2b_key_sites.py"],
    ["EV-86", "research/result/stage-readiness/forensics/T086-G09-ZMAP-SMAP.txt",
     "2c0b37161b5ed2855f2de632f5e4fec4687335060a4308b5426bc1c3ca545ff1",
     "Base.wz:zmap.img(149)/zmap_cn.img(149)/smap.img(147)/StandardPDD.img(115)", "data",
     "full ordered layer name list + smap component bindings",
     "zmap 149 == C-043 EXE model; zmap_cn identical; smap 106 component bindings",
     "C-100", "research/scripts/t086_wp3_zmap_dump.py (wz-python task-023 tool)"],
    ["EV-87", "research/result/stage-readiness/forensics/T086-G10-SLOT15-CALLER-WINDOWS.txt",
     "676076b41ec63e8a89659c27aa7ac88e7dc3f25508cac58391c18c4b335ee2d9",
     "28 call [reg+0x3C] sites + 0x5658CA window + 0x953AF4 body", "instruction+census",
     "28 full receiver windows + census context",
     "slot15 caller census complete (no scene-family receiver); slot12 direct caller found; per-draw dispatcher not a camera producer",
     "C-101", "research/scripts/t086_wp4_camera.py + t086_wp4b_caller_windows.py"],
]

GAP_UPDATES = {
    "G01": {
        "status": "CLOSED-STATIC",
        "verified_scope": "key formulas A (C-001/002); channels A (C-017); 22 candidate zero-insert census (C-012, refuted blanket reading retained); slot45 carries precomputed key as arg2 (C-075); t086: FINAL ORDERING RECEIVER RECOVERED — slot45 body 0x50409ECD forwards the key into the per-node ordered container [node+0x2C] (insert 0x50409EF4, tree search 0x5040390D, rebalance insert 0x50405476/0x5040C35E) with comparator 0x50403A42 (C-097); equal-key policy = secondary slot0-key compare",
        "unresolved_scope": "(none static; runtime corroboration of the tree walk order is optional)",
        "blocker": "(none)",
        "next_action": "(none; ordering strategy implementable from C-001/002/097/099)",
    },
    "G07": {
        "status": "CLOSED-STATIC",
        "verified_scope": "excluded from all vtable slot45s (EV-15); stack-package callees fully read, zero comparator logic (C-085); t086: the comparator is a Gr2D FREE FUNCTION 0x50403A42 invoked inside the keyed insert 0x50409EF4 (not a vtable slot) — body fully read: payload slot4-chain climb + slot0-key compare with sign result and equal-key tie-break (C-097/EV-82)",
        "unresolved_scope": "(none static)",
        "blocker": "(none)",
        "next_action": "(none)",
    },
    "G08": {
        "status": "CLOSED-STATIC",
        "verified_scope": "t086 C-099/EV-85: CMS079 formula machine-code recovered — key = 10*(layer*3000 - zM) - 2^31 + 29990 + (flag!=0?7:2) with layer/zM at [user+0xF28]-0xC field +0x130/+0x134, sites 0x9363D9/0x93E7F2; full type-base family -2^31+{29983..29999} enumerated at 34 lea sites (avatar 29990 / mob 29991+state cluster / NPC 29995 / drop 29999 / variant 29992 / 29996); all feed the C-097 keyed insert; v83 hypothesis structurally isomorphic, constants NOT copied",
        "unresolved_scope": "(none static)",
        "blocker": "(none)",
        "next_action": "(none; avatar-vs-obj ordering implementable exactly)",
    },
    "G09": {
        "status": "CLOSED-STATIC",
        "verified_scope": "static model complete (zmap 149 layers, C-043); t086: (a) cross-object ordering mechanism CLOSED — avatars/mobs/NPCs/drops insert into the SAME ordered container with the SAME comparator 0x50403A42 and the shared -2^31+299xx key space (C-097/C-099); (b) data anchors verified in the shipped Base.wz — zmap.img 149 == EXE model, zmap_cn order-identical, smap.img 106 layer->component bindings (C-100/EV-86); internal part order (zmap) and world order (key space) established separately per task",
        "unresolved_scope": "(none static; rendered-output corroboration is optional and non-blocking)",
        "blocker": "(none)",
        "next_action": "(none)",
    },
    "G10": {
        "status": "OPEN-RUNTIME",
        "verified_scope": "VR fold A (C-026); scene-manager skeleton (C-084); t086 (C-101/EV-87): slot15 caller census encoding-complete — 28 disp8 sites + 0 disp32 + 0 SIB + 0 direct E8, receivers all life/UI/COM families (bounded negative now enumeration-complete); slot12 0x53465B has exactly one direct E8 caller 0x5658CA (window method 0x5658BF — first static frame-loop entry); 0x953AF4 = 4-way arg dispatcher (not a camera producer); STRUCTURAL: slot15 consumes the camera rect as caller ARGS — the per-frame camera value is caller-transient, persistent scene fields are only the load-time VR bounds",
        "unresolved_scope": "per-frame camera-rect producer identity (which of the 28 sites, or a runtime-constructed call); follow/deadzone/world-to-screen parameters",
        "blocker": "producer receiver identity is runtime data (static census exhausted: all call encodings enumerated, none scene-provable)",
        "next_action": "in-map [0xBDF54C] family dump + slot15 caller capture (expected: caller args constructed from decrypted user position, clamped to scene+0xF0..0xFC)",
        "implementation_impact": "camera strategy pluggable; bounds implementable now; transient-rect contract documented for the rebuild",
    },
    "G17": {
        "status": "PARTIAL-STATIC",
        "verified_scope": "opcode semantics corpus A (C-046); t086 (C-095/EV-83/EV-84): all 442 values fully attributed — 355 jar-properties direct + 11 explicit 0xFF + 76 ExternalCodeTableGetter default 0xFFFE, ZERO corpus-vs-jar conflicts; jar properties identical to public ms079 (366/366) and conflict with Afauria on 15 names; NEW client-instruction tier: switch 0xA10CE3 statically binds 92 S2C opcodes (0x20..0x80) to handler bodies = task44 runtime map 92/92; prior wire observations (task048: 17/18 values incl. WARP_TO_MAP=0x81) match properties",
        "unresolved_scope": "original-production-server authority for the subset never observed on the wire, outside the 0x20..0x80 client dispatch, and contested across public 079 servers (15 conflicts, 6 client-adjudicated -> 9 remaining)",
        "blocker": "original server assignment unprovable from any on-disk static input; further static search cannot create original-server evidence",
        "next_action": "(optional) passive interop observation of the 9 contested names; otherwise record jar value with client/wire precedence",
        "implementation_impact": "protocol implementation may bind numeric values now (semantic names + jar values, client-dispatch tier as tiebreaker); no longer blocked",
    },
    "G22": {
        "status": "CLOSED-STATIC",
        "verified_scope": "ambiguity proven (EV-09/10/15); t086 RESOLVED (C-098/EV-82): 0x2E2C4/0x2E2CC are purecall-padded abstract stub tables (installed on small subobjects by 0x50402A30/0x50402874); the real 6DC8C7CE-class primary vtable = 0x5042E3F0 (76 slots, adjoins intmap 0x2E520), ctor 0x504067D7; slot45 of the real primary = 0x50409ECD (keyed insert, C-097)",
        "unresolved_scope": "(none)",
        "blocker": "(none)",
        "next_action": "(none)",
    },
    "G24": {
        "status": "CLOSED-STATIC",
        "verified_scope": "t084.1 (C-086/C-087): production slot25 = 0x5040418C; t086 (C-096/C-097/EV-82): the slot25-created node class FULLY identified — ctor 0x504067D7, vtable stack {0x5042E3F0 primary(76), 0x5042E3EC, 0x5042E3E8, 0x5042E3D0}, QI intmap 0x2E520 entry0 IID 6DC8C7CE dw=0; the [eax+0xB4] slot45 receiver = that node, body 0x50409ECD = keyed ordered-tree insert (C-097); slot56 = 0x50409DBA ARGB setter; the t082 bp-0x666F77 capture downgrades to confirming the already-statically-proven identity (predicted [EBP-0x10] vtable = 0x5042E3F0)",
        "unresolved_scope": "(none static; PCOM engine-class binding E576EA33 -> class-1-inner vs class-2-primary remains a two-candidate runtime prediction per C-087 — class-invariant for every downstream conclusion)",
        "blocker": "(none)",
        "next_action": "(optional runtime corroboration via the G24 capture; no longer required for node-class/slot45 semantics)",
        "implementation_impact": "render-node interop implementable now (keyed insert contract + key formulas)",
    },
    "G33": {
        "status": "CLOSED-STATIC",
        "verified_scope": "WZ-order sample observed only (EV-28); t086 (C-097): equal-key policy = comparator 0x50403A42 tie-break comparing payload slot0 keys (deterministic secondary order); product stable-sort remains a safe superset",
        "unresolved_scope": "(none static)",
        "blocker": "(none)",
        "next_action": "(none)",
    },
}


def main() -> int:
    rows = list(csv.reader(CLAIMS.open(newline="", encoding="utf-8")))
    header, body = rows[0], rows[1:]
    assert len(header) == 12, header
    have = {r[0] for r in body}
    for c in NEW_CLAIMS:
        assert len(c) == 12, c[0]
        if c[0] not in have:
            body.append(c)
    with CLAIMS.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([header] + body)

    rows = list(csv.reader(EVID.open(newline="", encoding="utf-8")))
    header, body = rows[0], rows[1:]
    assert len(header) == 9, header
    have = {r[0] for r in body}
    for e in NEW_EVID:
        assert len(e) == 9, e[0]
        if e[0] not in have:
            body.append(e)
    with EVID.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([header] + body)

    rows = list(csv.reader(GAPS.open(newline="", encoding="utf-8")))
    header, body = rows[0], rows[1:]
    idx = {r[0]: i for i, r in enumerate(body)}
    for gid, upd in GAP_UPDATES.items():
        if gid not in idx:
            raise SystemExit(f"gap {gid} missing")
        row = body[idx[gid]]
        for key, val in upd.items():
            row[header.index(key)] = val
    with GAPS.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([header] + body)
    print("ledger update done (claims+evidence+gaps)")


if __name__ == "__main__":
    main()
