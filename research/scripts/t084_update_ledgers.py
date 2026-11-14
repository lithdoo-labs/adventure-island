#!/usr/bin/env python3
"""T084 ledger updates: append C-078..C-085 + EV-64..EV-73, rewrite the touched
gap rows (G07/G10/G38/G40/G41/G24/G27) and the C-068 correction marker row.

Surgical line surgery (untouched rows keep their bytes); new rows are written
through csv.writer with QUOTE_MINIMAL so they parse under csv.reader.
"""
import csv
import io
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOT = os.path.join(REPO, "research", "source-of-truth")
FOrensics = "research/result/stage-readiness/forensics/"


def to_line(fields):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    w.writerow(fields)
    return buf.getvalue().rstrip("\n")


NEW_CLAIMS = [
    ["C-078", "Movement",
     "movement ctx fork = record-id SIGN at physics-family vtable slot13 0x9BCA6F (uniform [vt+0x34] in all 8 per-state tables; imm32 sites 0xB0C4CC/694/794/8A4/9A4/AA4/BA4/CCAC): slot13 commits rounded X/Y (re-encrypt via 0x6131F4) and consumes the M+0x19C record walker 0x6B8A18 whose word id selects the context - id>0 -> 0x517DA8 foothold-by-id lookup (this+0x90 hashmap: hash id % 997 buckets; node {next+4,key+8,value+0xC}); id<0 -> 0x9BCC9A rope-by-index ([field+0xA8] stride-0x1C table; index>=1; count at [table-4]); ids are DERIVED in record setter 0x6B87D1 as [fh+0x48] (positive) or neg(word) (rope); ctx install copies fh+0x1C/+0x20 or rope+0x18 into M+0x130/M+0x134 (labels per C-080); 0x517DA8 contains no rope path (t082 walk-side fork candidate REFUTED)",
     "CLOSED-STATIC", "A", "EV-64;EV-65", "unpack079",
     "0x9BCA6F-0x9BCC97;0x9BCC9A-0x9BCCC1;0x6B87D1-0x6B8876;0x517DA8-0x517E2B;0x51847B-0x5184CD",
     "full bodies by capstone this round; sign test at 0x9BCBAE (jg/jge pair); 0x9BCC9A index bound + imul 0x1C; 0x6B87D1 neg di at 0x6B87F5; slot13 dword census 8/8 tables",
     "a rope reaching 0x517DA8 or a foothold reaching 0x9BCC9A (no such edge exists)",
     "(none)",
     "T084-LADDER-ROPE-FORK-ANALYSIS.md"],
    ["C-079", "Rope",
     "rope loader write-side (field-load 0xA4D303): 0x409FFD count -> 0xA51577(field+0xA8, count+1) table (1-based, stride 0x1C, count header at -4); fill loop 0xA4F091-0xA4F2EE writes {rec+0x0=1-based index(=FSDB id), rec+0x4=l (prop 0x832, boolean-normalized neg/sbb/neg), rec+0x8=uf (prop 0x833, boolean-normalized), rec+0xC=x (prop 0x331 = the same x-int id as tile PUT EV-34), rec+0x10=y1 (0x830), rec+0x14=y2 (0x831), rec+0x18=page (0x627)}; l (rope+4) has NO static consumer: complete reader census = 0xA4FC6F + six grab sites 0x9D4473/0x9D45C3/0x9D4739/0x9D7D4F/0x9D7E9F/0x9D8015 + climb 0x9D80EC-0x9D8217 + slot13 0x9BCA6F + wrapper 0x9CBE4F inline lookup - none reads +4; ladder/rope type split does NOT branch on l in this image",
     "CLOSED-STATIC", "A", "EV-66;EV-68", "unpack079+fsdb",
     "0xA4EFCE-0xA4F2F4;0xA51577-0xA515D6",
     "loop body windows; property-id cross-consistency 0x830/0x831=(y1,y2) shared with the foothold loop; FSDB rope records carry exactly the 7 mapped fields (EV-63)",
     "any reader of rope+4 (none found in the enumerated complete consumer set)",
     "(none)",
     "T084-LADDER-ROPE-FORK-ANALYSIS.md;T084-FOOTHOLD-LOADER-WRITE-PATH.md"],
    ["C-080", "Movement",
     "foothold loader write-side (CORRECTION record for C-068 labels): writer 0xA4F4B6 (ret 0x28; 10 args) maps {id->+0x48 (node-name int), x1->+0xC, y1->+0x10, x2->+0x14, y2->+0x18, layer->+0x1C (outer node-name int), platform->+0x20 (mid node-name int), piece->+0x28 (refcounted), links {0x6C1,0x6C2}->+0x4C/+0x50 (per-member prev/next order DERIVED)}; vtable 0xAFE3F0->0xB0DDA4; derived fields by 0xA4F54A: len=+0x40=sqrt(dx^2+dy^2), unit dir=+0x30/+0x38 - C-068 DERIVED labels now write-side PROVEN; C-068 label corrected t084: +0x1C/+0x20 = layer/platform (was 'x2/y2 hint source'); x2/y2 live at +0x14/+0x18; consequently [M+0x130]/[M+0x134] = standing (layer,platform) and the t082 rope-record hint tension is resolved statically (rope ctx installs (page,0))",
     "CLOSED-STATIC", "A", "EV-67;EV-64", "unpack079+fsdb",
     "0xA4F4B6-0xA4F547;0xA4F54A-0xA4F5A2;0xA4E974-0xA4EA04;0xA4E1BA-0xA4E1D5;0xA4E2E3-0xA4E2FE;0xA4E413-0xA4E42D;0xA513F6-0xA514BB",
     "writer body + call site + both inserts (hashmap 0xA513F6, spatial collection 0xA4FFCD) + node-name int parses (0xA70518); dx/dy derivation proves the +0x14/+0x18 geometry pair; FSDB layer/platform/id/x1/y1/x2/y2/prev/next match",
     "a WZ foothold field mapped to a different offset by any other writer",
     "(none - corrects labels of C-068, chain kept in C-068 row)",
     "T084-FOOTHOLD-LOADER-WRITE-PATH.md;T084-LADDER-ROPE-FORK-ANALYSIS.md"],
    ["C-081", "Movement",
     "seat stand-up chain: 0x965A09 = user vtable slot14 (0xB0BD28+0x38; ret 4; arg=flag) - writes encrypted seat state 0 via 0x6131B9(0,user+0x2944) (C-057 value-0 side), resets chair RNG pair user+0x2E90-family, computes stance code from held chair item id (0x965A8F map: 0x2DED00-FF->1; 0x2DEE15/0x2DEE1B->2; 0x2DEE19->3; 0x2DEE16->4; 0x2DEE2D->5) into user+0xF04 (label DERIVED), and when flag==0 notifies the move object via 0x53E95D(M=[user+0xF28]-0xC, 0xB) (record kind 0xB into the M+0x19C container); sole direct caller 0x9500A3 = user full-reset (flag=1, notify suppressed); 0x6A0ADF REFUTED as the stand-up function - it is a generic encrypted-pair integrity decryptor (0xB12650 assert family, 55 E8 callers)",
     "CLOSED-STATIC", "A", "EV-69", "unpack079",
     "0x965A09-0x965A8C;0x965A8F-0x965AD7;0x6A0ADF-0x6A0B2C;0xB0BD28-0xB0BD67;0x950095-0x9500A8",
     "full bodies this round; slot14 dword in user vtable; stance-code meaning of +0xF04 is offset-semantic DERIVED (consumer cross-read pending)",
     "a second direct caller of 0x965A09 with flag=0 (none - dispatch is vtable slot14)",
     "(none - supersedes the t082 '0x6A0ADF stand-up' pointer recorded in matrix P3-15)",
     "T084-STANDUP-STATE-CHAIN.md"],
    ["C-082", "Gr2D",
     "static Gr2D slot25 (+0x64) candidate set fully enumerated (2 candidates) and BOTH fail the production-path out constraint of C-053: (1) 0x5042D140 table slot25 0x50403FBE = trivial setter, never writes out (unchanged); (2) NEW: 0x5042D204-cluster OUTER slot25 = 0x50404E85 = out-writing boolean getter (*arg2 = [this+0x78]!=0, E_POINTER guard, ret 8; companion setter 0x50404EA7) - a boolean out would fault the 0x666FAC call [[out]+8] Release path; therefore the runtime [0xBE2788] slot25 must be a put-with-object-out absent from both static tables; the T082 bp-0x666F77 single-dword dump now discriminates 3 named candidates",
     "CLOSED-STATIC", "A", "EV-72", "gr2d",
     "0x5042D204-0x5042D274;0x50404E85-0x50404EA6;0x50404EA7-0x50404EC8",
     "dword dumps of the 3 cluster tables + both bodies; [0xBE2788] write census = initializer only (no re-registration)",
     "a third static Gr2D vtable with a slot25 satisfying put-with-object-out",
     "(none)",
     "T084-GR2D-SLOT25-ANALYSIS.md"],
    ["C-083", "Portal",
     "map-transition handler 0x97EBC9 (ret 8; sole direct caller 0x533FF1 inside handler-family vtable slot0 0x533EA4, primary vtable 0xB01414 of the 33-table family 0xB01308..0xB02730): allocates a 0x3048 field object (pool 0xBE1DE0), fully loads the new map via 0x94FDB4 (creates field #1 [0xBDD498] incl. footholds/ropes/physics/VR re-fold), attaches via 0x980A8C(handler+4,field,0), THEN writes the arrival position via 0x9507F0 (C-055) - so the new map bounds/VR exist before the arrival write and the [M+0x138..0x144] clamps use the NEW field; opcode 0x81 byte-binding to this handler does NOT exist statically: the only sub eax,0x81 dispatch (0x77E6F3, channel context 0x81/0x82/0x83) proves opcode numbers are context-dependent (per-handler-object registration), keeping the C-066 open clause",
     "CLOSED-STATIC", "A", "EV-70;EV-73", "unpack079",
     "0x97EBC9-0x97EC5B;0x533EA4-0x533F3F;0x77E6F3-0x77E72C;0xB01414-0xB014C4",
     "full handler body + caller census (1 E8 site) + family dword dump + collision dispatch body",
     "another direct caller of 0x97EBC9 or a static imm 0x81 binding to 0x533EA4 (none)",
     "(none - the 0x81 registration remainder stays in C-066)",
     "T084-OPCODE-0081-REGISTRATION.md;T084-CAMERA-CALLGRAPH.md"],
    ["C-084", "Camera",
     "scene-manager skeleton (per-frame follow write still absent - G10 unchanged): the map-scene manager is a handler-base class with slots shared by 33 vtables 0xB01308..0xB02730 (primary 0xB01414): slot0=0x533EA4 field-enter, slot2=0x666186 WZ load (fixed order: scene+0x34 field#2 create via 0x4B6A47+0xA4DDDB -> tiles 0x666749 -> objs 0x6670C7 -> backs 0x669203 -> automove 0x66BC81 -> VR fold 0x66E59E (=camera BOUNDS init) -> life), slot3=0x5348E8 scene init, slot12=0x53465B per-tick (0xA106C3 fieldctx messages -> 0x9533EA user tick), slot14=0x5346EF per-draw (0x953AF4), slot15=0x53471A cull CONSUMES the camera rect as args against scene+0x1D0/+0x1D4 world bounds; viewport size = [0xBE2788] slots 11/12 via getters 0x66B4F6/0x66B51D (no EXE-side setter calls exist); no per-frame writer of scene+0xF0..0xFC after the VR fold exists (C-028 negative re-confirmed); cross-map: bounds/VR re-fold BEFORE arrival write (with C-083)",
     "PARTIAL-STATIC", "B", "EV-73;EV-70", "unpack079",
     "0x5348E8-0x534990;0x666186-0x666312;0x53465B-0x534717;0x534743-0x534850;0x66B4F6-0x66B543",
     "slot map by dword dump + call-order windows; camera-rect ARG semantics of slot15 proven only by its comparison use (producer unidentified); frame-loop caller unidentified (vtable-only edges) - hence B",
     "an EXE-side per-frame camera write found later (would upgrade C-028/G10)",
     "(none)",
     "T084-CAMERA-CALLGRAPH.md"],
    ["C-085", "Map/Sort",
     "stack-package callee bodies fully read - NEGATIVE comparator result: 0x43286E = null-assert ctor (ret 4; E_POINTER guard only); 0x44484B and 0x429411 = byte-identical attach-with-AddRef smart-pointer helpers ([this]=*[arg]; conditional vt+1 AddRef); 0x43E3A6 = property-PUT wrapper building two VARIANTs (VT_ERROR-missing 0xBE7330 init) and calling the universal 0x427EB3 (terminates in runtime slot25, same endpoint as the tile path) with VARIANT cleanup; none contains comparison/ordering/insertion logic - the EXE-side territory of the G07 comparator hypothesis is exhausted; final ordering receiver remains the runtime slot25 endpoint (G24/G27 dependency)",
     "CLOSED-STATIC", "A", "EV-71", "unpack079",
     "0x43286E-0x432888;0x44484B-0x444863;0x429411-0x429429;0x43E3A6-0x43E46B",
     "full bodies this round; 0x429411 usage at map-load 0x6662C8/0x6662D7 confirms C-074 stack-slot model",
     "any comparison instruction inside the four bodies (none)",
     "(none)",
     "T084-STACK-PACKAGE-REMAINING.md"],
]

EXE_HASH = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"

NEW_EVIDENCE = [
    ["EV-64", "research/result/stage-readiness/forensics/T084-EV64-SLOT13-FORK.txt",
     "8541cd3b81522f9f1df18f0b4be1c9ced31b7224fa766dee58976a73ac80bfae",
     "0x9BCA6F-0x9BCC97;0x9BCC9A-0x9BCCC1;0x9BCCC4-0x9BCCFA;0xB0C4CC",
     "instruction",
     "slot13 body: 4x 0x548806 decrypt + 0x6B8A18(M+0x19C,...) record walk; [M+0x16C]=kind==0x11; cmp word [ebp-4],0 jg/jge sign fork -> 0x517DA8(field,id) / 0x9BCC9A(field,-id); ctx installs [M+0x130/0x134] + vt+8 notify; 0x9BCC9A: cmp 1 jb -> 0; [ecx+0xA8] table; count [edx-4]; imul 0x1C; slot13 imm32 sites in all 8 physics vtables (+0x34)",
     "the foothold/rope context fork is the record-id sign, consumed at vtable slot13; rope table indexed from 1",
     "C-078", "research/scripts/t084_dump_evidence.py (sha-pinned binary " + EXE_HASH[:16] + "…, linear model)"],
    ["EV-65", "research/result/stage-readiness/forensics/T084-EV65-RECORD-ID-SIGN.txt",
     "18613c2045da606336fb1aa1cd8939ae620bf63b8eec827f6b4dfe2b1fd4330d",
     "0x6B87D1-0x6B8876;0x6B8A18-0x6B8AB6;0x6B8B4B-0x6B8B5F",
     "instruction",
     "setter: edi=[arg2+0x48] (foothold) / di=*arg4; neg di (rope) / 0; kinds 0x11/0xF bypass; getter: id word record+0xC -> out, flags byte record+0xA -> M+0x148, flags dword |= 1<<kind",
     "record ids derive their sign at install time: +[fh+0x48] positive, rope word negated",
     "C-078", "research/scripts/t084_dump_evidence.py"],
    ["EV-66", "research/result/stage-readiness/forensics/T084-EV66-ROPE-LOADER.txt",
     "8d7ae1225e1a7fdbe6db903e3a49c60db1ba8eb7e848a5425d8af42d1f01e123",
     "0xA4EFCE-0xA4F09D;0xA4F091-0xA4F2F4;0xA51577-0xA515D6",
     "instruction",
     "count via 0x409FFD; 0xA51577(field+0xA8, count+1); [ebp-0x1C] stride 0x1C; loop: [rec]=edi(1..count); props 0x832/0x833 boolean-normalized -> +4/+8; 0x331 -> +0xC; 0x830 -> +0x10; 0x831 -> +0x14; 0x627 -> +0x18",
     "rope runtime record = {id,l,uf,x,y1,y2,page} written at load (FSDB 7-field match, EV-63 census)",
     "C-079", "research/scripts/t084_dump_evidence.py"],
    ["EV-67", "research/result/stage-readiness/forensics/T084-EV67-FOOTHOLD-WRITER.txt",
     "243eb42df93e3fa8159b938943c74b95f5296e3d781a77e562b20ad4c2faa149",
     "0xA4F4B6-0xA4F542;0xA4F54A-0xA4F5A2;0xA4E974-0xA4EA04;0xA513F6-0xA514BB;0xA4E1BA;0xA4E2E3;0xA4E413",
     "instruction",
     "writer maps 10 args to fh+0xC..0x50; 0xA4F54A computes len=sqrt(dx^2+dy^2) and unit dir; call site: 0x58-alloc + 0xA513F6(field+0x90) insert + 0xA4FFCD(field+0x44) insert; node-name ints (0xA70518) = layer/platform/id",
     "foothold loader write-side direct proof; +0x1C/+0x20 = layer/platform (C-068 label corrected by C-080)",
     "C-080;C-078", "research/scripts/t084_dump_evidence.py"],
    ["EV-68", "research/result/stage-readiness/forensics/T084-EV68-FIELD-OBJECT.txt",
     "f0f8dea609fa1bc3f49bb0f5ec7a781c247b243d7e86bbc5f88a95b5f549cca9",
     "0xA4D393-0xA4D452;0xA546BF-0xA5476E;0xA4DDB1-0xA4DDCE;0x4B6ABE-0x4B6B0B;0x9D80EC-0x9D8216;0x9CC077-0x9CC0AE",
     "instruction",
     "field ctors (vt 0xB0DD98/[0xBDD498]; vt 0xB0DE10/[0xBE65F8]); +0x44 collection; +0x90 hashmap (997 buckets, vt 0xB0DD9C); +0xA8=0; 0x4B6ABE pair decrypt; climb reads rope +8/+0x10/+0x14 only; wrapper re-lookup reads [rec+0] only",
     "field-object structure + complete rope-record reader census (no +4 read anywhere)",
     "C-079;C-078", "research/scripts/t084_dump_evidence.py"],
    ["EV-69", "research/result/stage-readiness/forensics/T084-EV69-STANDUP.txt",
     "b7e60dc5d2755956414311918fdc9337e4c74b878fce1a47d8cf75b171e0e853",
     "0x6A0ADF-0x6A0B2C;0x965A09-0x965A8C;0x965A8F-0x965ADB;0xB0BD28-0xB0BD67;0x950095-0x9500A8",
     "instruction",
     "0x6A0ADF = encrypted-pair integrity decryptor (0xB12650 assert); 0x965A09 = user vt slot14 stand-up (0x6131B9(0,user+0x2944); RNG pair resets; chair-id stance map -> user+0xF04; flag==0 -> 0x53E95D(M,0xB)); caller 0x9500A3 passes flag=1",
     "stand-up chain relocated; 0x6A0ADF hypothesis refuted",
     "C-081", "research/scripts/t084_dump_evidence.py"],
    ["EV-70", "research/result/stage-readiness/forensics/T084-EV70-OPCODE-0081.txt",
     "0ef702dae09ede57b39d5bd2b9039bb4c4c7eed777107da5f1abdcb010dae242",
     "0x97EBC9-0x97EC5E;0x533EA4-0x533F3B;0x533FE0-0x533FF9;0x77E6F3-0x77E72E;0xB01414-0xB014C3;0xB01308-0xB01327",
     "instruction",
     "0x97EBC9: alloc 0x3048 -> 0x94FDB4 load -> 0x980A8C attach -> 0x9507F0 arrival write; sole caller 0x533FF1 in 0x533EA4 (slot0 of the 33-table family 0xB01308..0xB02730); 0x77E6F3 = sub eax,0x81 channel-context dispatch (collision)",
     "map-transition handler chain closed; 0x81 byte binding absent statically and context-dependent",
     "C-083;C-084", "research/scripts/t084_dump_evidence.py"],
    ["EV-71", "research/result/stage-readiness/forensics/T084-EV71-STACK-PACKAGE.txt",
     "cfecbe63f571eac75f32d6044afa72307a0c367fff2330c38ed62962923c187e",
     "0x43286E-0x432888;0x44484B-0x444865;0x429411-0x42942B;0x43E3A6-0x43E463",
     "instruction",
     "0x43286E null-assert ctor; 0x44484B/0x429411 identical attach+AddRef; 0x43E3A6 PUT wrapper over 0x427EB3 with VARIANT init/cleanup",
     "no comparator/order logic in any stack-package callee (negative result)",
     "C-085", "research/scripts/t084_dump_evidence.py"],
    ["EV-72", "research/result/stage-readiness/forensics/T084-EV72-GR2D-CLUSTER-SLOT25.txt",
     "541d637fd918bd9831760aa255cb04fe24f2f5a3c65b363e8eac25d1d810b89e",
     "0x5042D204-0x5042D274;0x5042D224-0x5042D294;0x5042D210-0x5042D280;0x50404E85-0x50404EA6;0x50404EA7-0x50404EC8",
     "data+instruction",
     "cluster vtable dwords: outer slot25=0x50404E85, inner slot25=0x5040418C, mid slot25=0x50403FBE-family; 0x50404E85 body = *out = [this+0x78]!=0 (E_POINTER guard, ret 8); 0x50404EA7 = boolean setter companion",
     "second static slot25 candidate documented; boolean-out fails the 0x666FAC Release path -> runtime binding required",
     "C-082", "research/scripts/t084_dump_evidence.py (dll_dump; PE model, ImageBase 0x50400000)"],
    ["EV-73", "research/result/stage-readiness/forensics/T084-EV73-SCENE-CAMERA.txt",
     "6ed81cb28bdce8f1498160551025286acb920f9ce76039fbd173d692493b20e0",
     "0x5348E8-0x534990;0x6662DC-0x66631B;0x53465B-0x534716;0x534743-0x534850;0x66B4F6-0x66B53E",
     "instruction",
     "scene-init sequence; map-load order incl. VR fold position; per-tick/per-draw dispatch (0xA106C3/0x9533EA/0x953AF4); cull slot15 consuming camera-rect args vs scene+0x1D0/+0x1D4; viewport getters 0x66B4F6/0x66B51D ([0xBE2788] slots 11/12)",
     "scene-manager slot structure + camera bounds/order; per-frame follow write absent from the image",
     "C-084;C-083", "research/scripts/t084_dump_evidence.py"],
]


def main():
    # claims.csv: append + rewrite C-068 row
    p = os.path.join(SOT, "claims.csv")
    lines = open(p, encoding="utf-8").read().splitlines()
    out = []
    for ln in lines:
        if ln.startswith("C-068,"):
            # append the correction marker into the claim field (field 3)
            parts = next(csv.reader([ln]))
            parts[2] = parts[2] + (
                " — t084 label correction by C-080/EV-67: +0x1C/+0x20 = layer/platform "
                "(was 'x2/y2 hint source'); x2/y2 live at +0x14/+0x18; layout otherwise "
                "write-side proven (0xA4F4B6/0xA4F54A)")
            parts[10] = parts[10] + ";T084-FOOTHOLD-LOADER-WRITE-PATH.md;T084-LADDER-ROPE-FORK-ANALYSIS.md"
            out.append(to_line(parts))
        else:
            out.append(ln)
    for row in NEW_CLAIMS:
        out.append(to_line(row))
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")

    # evidence.csv: append
    p = os.path.join(SOT, "evidence.csv")
    lines = open(p, encoding="utf-8").read().splitlines()
    for row in NEW_EVIDENCE:
        lines.append(to_line(row))
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
    print("claims/evidence updated")


if __name__ == "__main__":
    main()
