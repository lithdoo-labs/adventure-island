#!/usr/bin/env python3
"""T084 gap-row updates (surgical rewrite of G07/G10/G24/G27/G38/G40/G41)."""
import csv
import io
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOT = os.path.join(REPO, "research", "source-of-truth")


def to_line(fields):
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n", quoting=csv.QUOTE_MINIMAL).writerow(fields)
    return buf.getvalue().rstrip("\n")


# gap_id -> new field values (full rows; cols: gap_id,module,question,status,
# verified_scope,unresolved_scope,blocker,next_action,implementation_impact,claim_refs)
UPDATES = {
    "G07": [
        "G07", "Map/Sort",
        "DLL comparator body",
        "PARTIAL-STATIC",
        "excluded from all vtable slot45 (EV-15); t084: ALL FOUR named stack-package callees fully read - 0x43286E null-assert ctor, 0x44484B/0x429411 identical attach+AddRef helpers, 0x43E3A6 property-PUT wrapper over 0x427EB3 - zero comparison/ordering/insertion logic in any of them (C-085/EV-71); the EXE-side territory of the comparator hypothesis is exhausted",
        "final ordering receiver = the runtime slot25 endpoint (put-with-object-out per C-075; shared dependency with G24/G27 runtime dump)",
        "static reading exhausted for the named callees",
        "same single runtime dump as G24/G27 (bp 0x666F77) resolves the endpoint; no further static action",
        "equal-key policy unknown; do not freeze comparator",
        "C-012;C-019;C-085",
    ],
    "G10": [
        "G10", "Camera",
        "camera follow/deadzone parameters",
        "OPEN-RUNTIME",
        "VR fold A (C-026); t084: scene-manager skeleton recovered - handler-base 33-vtable family, slot2 WZ load order (tiles->objs->backs->automove->VR fold->life), slot12 per-tick (0xA106C3/0x9533EA), slot14 per-draw (0x953AF4), slot15 cull consumes camera-rect args vs scene+0x1D0/+0x1D4, viewport = [0xBE2788] slots 11/12 getters (C-084/EV-73); cross-map bounds/VR re-fold BEFORE arrival write (C-083)",
        "per-frame camera-rect producer (slot15 caller), follow/deadzone/world-to-screen write, frame-loop owner",
        "follow writes not found statically (re-confirmed: no post-load writer of scene+0xF0..0xFC exists)",
        "in-map [0xBDF54C] family dump + slot15 caller capture",
        "camera strategy must be pluggable; bounds implementable now",
        "C-026;C-028;C-084",
    ],
    "G24": [
        "G24", "Map/Sort",
        "[eax+0xB4] final semantics",
        "OPEN-RUNTIME",
        "call exists; HRESULT check; 22-candidate exclusion (EV-16/18); C-053 dump-target sharpening; t082: Gr2D 0x5042D204 vtable-group structure verified with ctor binding + slot+0x58 getter (C-077); t084: static slot25 candidate set FULLY enumerated - 0x50403FBE (trivial setter, no out) and 0x50404E85 (boolean out-getter, [this+0x78]) BOTH fail the production-path out constraint; runtime binding must be a put-with-object-out absent from static tables (C-082/EV-72)",
        "concrete target class of the [0xBE2788] object (which vtable group the live object uses)",
        "runtime dump required",
        "execute the minimal capture spec (T082-R13 §4: bp @0x666F77 + 0x427EB3 entry/exit) - now discriminates 3 named candidates",
        "render-node interop pending",
        "C-013;C-014;C-053;C-077;C-082",
    ],
    "G27": [
        "G27", "PCOM",
        "0x427EB3 out-param static contradiction",
        "PARTIAL-STATIC",
        "t080 (C-053): arg1 IS the out pointer; *out = post-slot25 arg8-slot dword; t082: [ebp-0x20] lifecycle resolved (C-074); slot45 key-carrying call (C-075); t084: both static slot25 candidates rejected for the production path (trivial setter never writes out; boolean getter writes 0/1 which faults the 0x666FAC Release read) (C-082)",
        "which value slot25 writes at runtime (object pointer required by production-path consistency); shared with G24 runtime dump",
        "runtime dump",
        "same minimal capture as G24",
        "OUT semantics implementable with runtime confirmation",
        "C-014;C-053;C-074;C-075;C-082",
    ],
    "G38": [
        "G38", "Map/Portal",
        "precise same-map and cross-map arrival position and state transfer",
        "PARTIAL-STATIC",
        "t080: same-map chain end-to-end (C-054) + cross-map record/write chain (C-055); t082: A same-map rebind = clear-ctx+notify, rebuild in physics loop 0x9BE703 (C-061); B cross-map arg-table corrected, a7=0 no immediate rebind, projection snap algorithm 0x9BC89F/0x9BC992 (C-062/C-063), map-bounds source 0x9BC602 (C-064); C 0x953FA5=appearance reset, movement reset = fresh move object (C-065); D 0xCF dispatch instruction-bound (C-066); t084: 0x97EBC9 handler body closed - new-map load (0x94FDB4) -> attach (0x980A8C) -> arrival write (0x9507F0), sole caller 0x533FF1 in handler slot0; opcode 0x81 has NO static byte binding (context-dependent registration proven by the 0x77E6F3 channel-0x81 collision) (C-083)",
        "camera refresh timing (G10 dependency, not started); 0x81->handler runtime registration data; full first-tick ctx-rebuild function body (0x9BE703 partially windowed)",
        "camera chain unread; handler-class registration statically invisible (collision-proven context binding)",
        "disassemble 0x9BE703 full body; runtime registration capture for the 0x81 table; camera chain (G10 dependency)",
        "portal arrival position/state/snap now implementable; camera order pending",
        "C-054;C-055;C-061;C-062;C-063;C-064;C-065;C-066;C-083",
    ],
    "G40": [
        "G40", "Movement",
        "full target-map movement subbranches and special decrypt field ownership",
        "PARTIAL-STATIC",
        "T1 ground-step + 19-field Physics (EV-23/26); t080 head + halfWidth caller-param (C-058); t082: 0x9BF1FA full chain (C-067); foothold layout + [M+0x110] single-ctx (C-068; labels t084-corrected by C-080); 0x9BF9D3 = map-bounds clamp; two-vtable-family structure (C-076); t084: fh loader write-side DIRECTLY PROVEN (0xA4F4B6 writer + 0xA4F54A derived len/unit-dir + 0xA513F6/0xA4FFCD dual inserts; layer/platform at +0x1C/+0x20) (C-080/EV-67); slot13 commit/ctx fork (C-078)",
        "slot3 variants 0x9C5B8A/0x9CCAA8 full body diff; shoe +0x198 defaults and four DEC slots; walk/swim/land full sequencing",
        "none - static work continues on the variants",
        "diff slot3 variants 0x9C5B8A/0x9CCAA8; shoe +0x198 defaults",
        "slope-walk/transition/snap implementable now",
        "C-029;C-034;C-058;C-063;C-067;C-068;C-076;C-078;C-080",
    ],
    "G41": [
        "G41", "Movement",
        "rope grab/climb and seat sit/stand full state machine in target maps",
        "PARTIAL-STATIC",
        "t080: climb 3.0 const + seat writes (C-056/C-057); t082: 0xA4FC6F hit semantics + rope layout (C-069); grab key adjudication (C-071); 0x9BFB52 SetStandingContext (C-070); endpoint label correction (C-072); halfWidth audit final (C-073); t084: type fork LOCATED = record-id sign at slot13 0x9BCA6F (positive->0x517DA8 foothold, negative->0x9BCC9A rope-by-index) with complete reader census - l (rope+4) has NO static consumer (C-078/C-079); rope loader write-side mapped (C-079); [M+0x130/0x134] = (layer,platform)/(page,0) - hint tension resolved STATICALLY, the runtime dump for it is no longer required (C-080); seat stand-up chain = 0x965A09 user vt slot14 with 0x53E95D(M,0xB) notify; 0x6A0ADF refuted as decrypt helper (C-081)",
        "up+down simultaneous input layer; slot14 (0x965A09) caller enumeration (state-driven stand-up triggers); general runtime corroboration optional",
        "none blocking for implementation",
        "enumerate [user-vt+0x38] flag=0 call sites; minimal runtime corroboration optional next stage",
        "rope grab/climb/leave + sit/stand implementable; fork is a data convention (id sign), not a code branch",
        "C-029;C-056;C-057;C-069;C-070;C-071;C-072;C-073;C-078;C-079;C-080;C-081",
    ],
}


def main():
    p = os.path.join(SOT, "gaps.csv")
    lines = open(p, encoding="utf-8").read().splitlines()
    out = []
    for ln in lines:
        gid = ln.split(",", 1)[0]
        if gid in UPDATES:
            out.append(to_line(UPDATES[gid]))
        else:
            out.append(ln)
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    import csv as _csv
    rows = list(_csv.reader(open(p, encoding="utf-8")))
    print("gaps rows:", len(rows), "cols:", sorted(set(len(r) for r in rows)))


if __name__ == "__main__":
    main()
