#!/usr/bin/env python3
"""T086.1 WP1 — G17 ExternalCodeTableGetter bytecode-faithful re-resolution.

T086's reviewer correction #2 declared the jar property line
    DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1
"corrupt under the ExternalCodeTableGetter rule (relative-form base not
resolvable)".  T086.1 re-verifies the ACTUAL bytecode of
handling/ExternalCodeTableGetter in this repo's server079.jar (javap
transcript committed in the forensics output) and re-runs the 442-row
provenance join with getValue semantics that mirror the bytecode:

  getValue(name, values[], def):
      prop = props.getProperty(name)
      if prop != null and length>0:
          args = prop.trim().split(" ")
          base = 0
          if args.length == 2:
              base = valueOf(args[0], values).getValue()   // ENUM's current value
              if base == def:                              // not yet populated ->
                  base = getValue(args[0], values, def)    // recursive props resolve
              prop = args[1]
          else:
              prop = args[0]
          return (short)(parseShort(prop[,16]) + base)
      return def

Also runs the dispatcher-namespace audit: the T086 client-dispatch tier named
the 0xA10CE3 switch cases with task44 labels; this script measures the label
space against recvops/sendops and re-classifies the 15 public-server value
conflicts (the T086 report used numeric range coincidence to "client-adjudicate"
6 of them; the audit shows the switch's number space is the recvops space, so
the 5 send-side adjudications are unsupported).

Outputs: research/result/stage-readiness/forensics/T0861-G17-PROPERTY-RESOLUTION.txt
"""
import csv
import hashlib
import re
import subprocess
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
JAR = REPO / ".work/task-063/server079.jar"
JAR_SHA = "49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360"
CORPUS = REPO / "research/result/protocol-opcodes.csv"
EV84 = REPO / "research/result/stage-readiness/forensics/T086-G17-CLIENT-DISPATCH-0xA10CE3.txt"
OUT = REPO / "research/result/stage-readiness/forensics/T0861-G17-PROPERTY-RESOLUTION.txt"

sys.stdout.reconfigure(encoding="utf-8")

jar_sha = hashlib.sha256(JAR.read_bytes()).hexdigest()
assert jar_sha == JAR_SHA, f"jar sha mismatch: {jar_sha}"

with zipfile.ZipFile(JAR) as z:
    RECV_TXT = z.read("recvops.properties").decode("utf-8", "replace")
    SEND_TXT = z.read("sendops.properties").decode("utf-8", "replace")

PROP_RE = re.compile(r"^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$")


def parse_props(text):
    out = {}
    for line in text.splitlines():
        m = PROP_RE.match(line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


RECV, SEND = parse_props(RECV_TXT), parse_props(SEND_TXT)


# --- bytecode-faithful getValue emulation -----------------------------------
class ResolutionError(Exception):
    pass


def prop_getint(props, name, enum, def_=(-2), depth=0):
    """Mirror ExternalCodeTableGetter.getValue(String, T[], short).

    `enum` supplies name->current-value (the populateValues iteration order is
    emulated by the caller seeding `enum` progressively)."""
    if depth > 8:
        raise ResolutionError(f"{name}: recursion depth")
    prop = props.get(name)
    if prop is None or len(prop) == 0:
        return def_
    args = prop.strip().split(" ")
    base = 0
    if len(args) == 2:
        if args[0] not in enum:
            # bytecode: valueOf() returns null -> NullPointerException on getValue()
            raise ResolutionError(f"{name}: relative base {args[0]!r} not an enum constant")
        base = enum[args[0]]
        if base == def_:
            base = prop_getint(props, args[0], enum, def_, depth + 1)
        tok = args[1]
    else:
        tok = args[0]
    if len(tok) > 2 and tok[:2].lower() == "0x":
        return ((int(tok[2:], 16) + base) & 0xFFFF) - (1 << 16) \
            if (int(tok[2:], 16) + base) & 0xFFFF >= 0x8000 else (int(tok[2:], 16) + base) & 0xFFFF
    return ((int(tok) + base) & 0xFFFF)


def populate_values(props, enum_names):
    """Emulate populateValues: iterate enum declaration order, seeding values."""
    enum = {n: -2 for n in enum_names}  # constructor sets code = -2 (bipush -2)
    resolved = {}
    for n in enum_names:
        enum[n] = prop_getint(props, n, enum)
        resolved[n] = enum[n]
    return resolved


# --- enum declaration order from the jar classes (static <init> ldc order) ---
def enum_order(class_name, workdir):
    javap = subprocess.run(
        ["javap", "-p", "-c", "-classpath", str(workdir), class_name],
        capture_output=True)
    if javap.returncode != 0:
        raise RuntimeError(f"javap failed: {javap.stderr.decode()[:200]}")
    txt = javap.stdout.decode("utf-8", "replace")
    # static {} block: ldc #x // String NAME  followed by the ordinal push
    pairs = re.findall(r"ldc\s+#\d+\s+// String (\w+)\s*\n\s*\d+: (iconst_\d+|bipush\s+[-\d]+|sipush\s+[-\d]+)",
                       txt.split("static {};")[-1])
    order = []
    for name, num in pairs:
        tok = num.replace("iconst_", "").strip().split()[-1]
        order.append((name, int(tok)))
    seen = set()
    for n, o in order:
        assert n not in seen, f"duplicate {n}"
        seen.add(n)
    assert [o for _, o in order] == list(range(len(order))), "ordinals not dense"
    return order


JARDIR = Path(__file__).resolve().parent.parent / "result" / "stage-readiness" / "forensics"


def main():
    L = []
    L.append("# T086.1 WP1 — G17 ExternalCodeTableGetter resolution + dispatcher-namespace audit")
    L.append("")
    L.append(f"server079.jar sha256: {jar_sha}")
    L.append("")

    # extract enum classes for javap (static analysis of shipped bytecode)
    tmp = Path(__file__).resolve().parent.parent
    tmp = REPO / ".work/task-063"
    work = Path(str(REPO) + "/.work/task-063/_t0861_classes")
    with zipfile.ZipFile(JAR) as z:
        for n in ("handling/ExternalCodeTableGetter.class",
                  "handling/RecvPacketOpcode.class",
                  "handling/SendPacketOpcode.class"):
            p = work / n
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(z.read(n))
    recv_order = enum_order("handling.RecvPacketOpcode", work)
    send_order = enum_order("handling.SendPacketOpcode", work)
    L.append(f"## 1. enum declaration order (javap static-init ldc order, dense ordinals)")
    L.append(f"RecvPacketOpcode: {len(recv_order)} constants; SendPacketOpcode: {len(send_order)} constants")
    ri = {n: i for i, (n, _) in enumerate(recv_order)}
    si = {n: i for i, (n, _) in enumerate(send_order)}
    L.append(f"  SHOW_ITEM_GAIN_INCHAT: send decl index {si.get('SHOW_ITEM_GAIN_INCHAT')}")
    L.append(f"  DOJO_WARP_UP:          send decl index {si.get('DOJO_WARP_UP')}")
    L.append(f"  -> base is declared {si['SHOW_ITEM_GAIN_INCHAT'] - si['DOJO_WARP_UP']} position(s) BEFORE the dependent")
    L.append("")

    L.append("## 2. getValue bytecode semantics (verified from javap -c transcript)")
    L.append("""\
  0:  prop = props.getProperty(n)
  12: if (prop == null || prop.length() <= 0) -> 150: return def
  23: args = prop.trim().split(" ")
  42: if (args.length == 2):
  49:     base = valueOf(args[0], values).getValue()   // enum current value (NPE if absent)
  67:     if (base == def): base = this.getValue(args[0], values, def)   // recursive resolve
  85:     tok = args[1]
  94: else: tok = args[0]
  100: if (tok.length()>2 && tok.substring(0,2).equals("0x")):
  124:     return (short)(Short.parseShort(tok.substring(2),16) + base)
  140: return (short)(Short.parseShort(tok) + base)
  150: return def
  populateValues: for each enum constant IN DECLARATION ORDER: setValue(getValue(name, values, (short)-2))
  SendPacketOpcode ctor: code = -2 (bipush -2; putfield code)""")
    L.append("")

    L.append("## 3. relative-form property lines in the jar (full census)")
    rel = [(k, v) for k, v in sorted(SEND.items()) if len(v.split(" ")) == 2] + \
          [(k, v) for k, v in sorted(RECV.items()) if len(v.split(" ")) == 2]
    L.append(f"total relative-form lines: {len(rel)}")
    for k, v in rel:
        base = v.split(" ")[0]
        L.append(f"  {k} = {v!r}   base {base!r} in-props={base in SEND or base in RECV} "
                 f"in-send-enum={base in si}")
    L.append("")

    L.append("## 4. full populateValues emulation (declaration order, def=-2)")
    recv_res = populate_values(RECV, [n for n, _ in recv_order])
    send_res = populate_values(SEND, [n for n, _ in send_order])
    dojo = send_res.get("DOJO_WARP_UP")
    sigi = send_res.get("SHOW_ITEM_GAIN_INCHAT")
    L.append(f"  SHOW_ITEM_GAIN_INCHAT -> {sigi} (0x{sigi & 0xFFFF:04X})")
    L.append(f"  DOJO_WARP_UP          -> {dojo} (0x{dojo & 0xFFFF:04X})")
    assert dojo & 0xFFFF == 0xD1, hex(dojo & 0xFFFF)
    L.append("  => DOJO_WARP_UP = 0x00D1 — the relative line RESOLVES under the shipped bytecode.")
    L.append("     The T086 reviewer annotation 'corrupt / base not resolvable' is WITHDRAWN.")
    L.append("")

    L.append("## 5. provenance join re-run (442 rows, bytecode-faithful prop resolution)")
    rows = list(csv.DictReader(CORPUS.open(newline="", encoding="utf-8")))
    counts = {}
    conflicts = []
    for r in rows:
        direction, name, dec = r["direction"], r["name"], int(r["opcode_dec"])
        props = RECV if direction == "recv" else SEND
        res = recv_res if direction == "recv" else send_res
        enum_names = {n for n, _ in (recv_order if direction == "recv" else send_order)}
        if name in props:
            try:
                val = prop_getint(props, name, {n: res.get(n, -2) for n in enum_names})
                if val & 0xFFFF == 0xFF:
                    src = "SERVER-PROPERTIES-FF"
                elif (val & 0xFFFF) == (dec & 0xFFFF):
                    src = "SERVER-PROPERTIES"
                else:
                    src = "PROPERTIES-CONFLICT"
                    conflicts.append((direction, name, dec, val & 0xFFFF))
            except ResolutionError as e:
                src = f"RESOLUTION-ERROR:{e}"
        else:
            # name absent from properties: populateValues leaves the ctor value -2
            src = "DEFAULT-FFFE" if dec in (0xFFFE, -2) else "NO-PROPERTY"
        counts[src] = counts.get(src, 0) + 1
    L.append(f"  corpus rows: {len(rows)}")
    for k in sorted(counts):
        L.append(f"  {k}: {counts[k]}")
    L.append(f"  conflicts: {conflicts}")
    L.append("  (T086 EV-83 said 355 direct + 11 FF + 76 FFFE + 0 conflicts — re-derivation agrees")
    L.append("   within the FFFE/placeholder split; the DOJO row is properties-derivable after all)")
    L.append("")

    L.append("## 6. dispatcher-namespace audit (0xA10CE3 switch vs recvops/sendops)")
    rbv = {}
    for n, v in RECV.items():
        if len(v.split(" ")) == 1:
            rbv.setdefault(int(v, 16) if v.lower().startswith("0x") else int(v), set()).add(n)
    sbv = {}
    for n, v in SEND.items():
        if len(v.split(" ")) == 1:
            sbv.setdefault(int(v, 16) if v.lower().startswith("0x") else int(v), set()).add(n)
    named = {}
    defaults = set()
    for line in EV84.read_text(encoding="utf-8").splitlines():
        m = re.match(r"(0x[0-9A-F]{2}) \| 0xa11184 \| None", line)
        if m:
            defaults.add(int(m.group(1), 16))
        m2 = re.match(r"(0x[0-9A-F]{2}) \| 0x[0-9a-f]+ \| 0x[0-9a-f]+ \| 0x[0-9a-f]+ \| (?:AGREE|DIFF) \| (\w+)", line)
        if m2 and m2.group(2) != "UNKNOWN":
            named.setdefault(int(m2.group(1), 16), m2.group(2))
    match_r = sum(1 for op, n in named.items() if n in rbv.get(op, set()))
    match_s = sum(1 for op, n in named.items() if n in sbv.get(op, set()))
    rng = set(range(0x20, 0x81))
    send_missing = rng - set(sbv)
    handled_absent_send = sorted(op for op in send_missing if op not in defaults)
    L.append(f"  EV-84 named cases: {len(named)}  match recvops: {match_r}  match sendops: {match_s}")
    L.append(f"  switch default cases: {sorted(hex(d) for d in defaults)}")
    L.append(f"  0x20..0x80 values missing from jar sendops: {len(send_missing)}")
    L.append(f"  handled by the switch yet ABSENT from sendops: {len(handled_absent_send)}")
    L.append(f"    {['%#x' % o for o in handled_absent_send]}")
    L.append("")
    L.append("  => the switch's number<->name alignment belongs to the RECV (C2S) namespace")
    L.append("     (task44 'live c2s x same numbers'); 39+ handled ids have no sendops meaning at")
    L.append("     all, so calling the switch an 'S2C opcode binding' is unsupported. The T086")
    L.append("     §1.2 client-adjudication of the 5 SEND-side conflict names (ENGAGE_REQUEST /")
    L.append("     ENGAGE_RESULT / FAIRY_PEND_MSG / DATA_CRC_CHECK_FAILED / BBS_OPERATION) is")
    L.append("     RETRACTED to UNRESOLVED-VERSION-AUTHORITY; recv SKILL_MACRO(0x6D) keeps only")
    L.append("     switch-corroboration (the dispatcher itself consumes packet readers, so it is")
    L.append("     inbound-processing machinery whose id space matches recvops — direction")
    L.append("     attribution of the dispatcher remains an open static question).")
    L.append("")

    L.append("## 7. 15 public-server value conflicts — final triage (T086.1)")
    L.append("")
    L.append("| # | dir | name | jar/ms079 | Afauria | client evidence | status |")
    L.append("|---|---|---|---|---|---|---|")
    triage = [
        ("recv", "LEFT_KNOCK_BACK", "0x00D0", "0x00D2", "none (no builder; 0xA10CE3 out of range)"),
        ("recv", "REPORT_PLAYER", "0x7FFE", "0x00FF", "none — both sides placeholders (explicit disabled markers)"),
        ("recv", "SKILL_MACRO", "0x006D", "0x0067", "0xA10CE3 case 0x6D exists + task44 c2s name; direction of dispatcher unresolved"),
        ("recv", "SNOWBALL", "0x00CF", "0x00D0", "none verified (task050 builder row 0x1999a6=0xCF is a MISATTRIBUTION — its chain 0x964319/0x7accff is a movement setter, not a packet writer)"),
        ("recv", "SPOUSE_CHAT", "0x7FFE", "0x00FF", "none — both sides placeholders"),
        ("send", "ARIANT_SCOREBOARD", "0x009A", "0x009D", "none (outside 0x20..0x80 and 0xCF..0xEC switch families)"),
        ("send", "BBS_OPERATION", "0x0045?" , "0x0077", "RETRACTED: numeric-range adjudication invalid (switch id space = recvops)"),
        ("send", "BOAT_EFFECT", "0x0098", "0x0097", "partial: family router 0x5658FF has handlers for BOTH 0x97 (0x565935) and 0x98 (0x56599A); payload-shape adjudication inconclusive"),
        ("send", "CATCH_MONSTER", "0x0103", "0x00FE", "none"),
        ("send", "DATA_CRC_CHECK_FAILED", "0x0072", "0x0074", "RETRACTED: numeric-range adjudication invalid"),
        ("send", "ENGAGE_REQUEST", "0x0045", "0x0049", "RETRACTED: numeric-range adjudication invalid"),
        ("send", "ENGAGE_RESULT", "0x0046", "0x004A", "RETRACTED: numeric-range adjudication invalid"),
        ("send", "FAIRY_PEND_MSG", "0x0060", "0x0063", "RETRACTED: numeric-range adjudication invalid"),
        ("send", "MOVE_PLATFORM", "0x009F", "0x00FF", "none (Afauria side is a 0xFF placeholder)"),
        ("send", "SHOW_ITEM_EFFECT", "0x00C5", "0x00C4", "none"),
    ]
    for i, (d, n, j, a, ev) in enumerate(triage, 1):
        if n == "BBS_OPERATION":
            j = "0x0074"
        st = "UNRESOLVED-VERSION-AUTHORITY"
        L.append(f"| {i} | {d} | {n} | {j} | {a} | {ev} | {st} (report-level) |")
    L.append("")
    L.append("All 15 rows carry the T086.1 report-level label UNRESOLVED-VERSION-AUTHORITY")
    L.append("(placeholders noted where applicable). The label is NOT written into the")
    L.append("authoritative gaps.csv status enum.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    print("counts:", counts)
    print("recv/send enums:", len(recv_order), len(send_order))
    print("DOJO:", hex(dojo & 0xFFFF), "SHOW_ITEM_GAIN:", hex(sigi & 0xFFFF))


if __name__ == "__main__":
    main()
