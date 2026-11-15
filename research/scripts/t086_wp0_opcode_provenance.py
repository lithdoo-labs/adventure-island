#!/usr/bin/env python3
"""T086 WP0 — G17 opcode numeric-value provenance audit (pure static).

Joins the repo protocol corpus against the server079.jar bundled
recvops/sendops.properties and the ExternalCodeTableGetter default rule, and
classifies every protocol-opcodes.csv row by its actual numeric-value source.

Inputs (read-only):
  research/result/protocol-opcodes.csv          (442 rows, authoritative corpus)
  research/result/task055-c2s-opcodes.csv       (148 rows)
  research/result/task055-s2c-opcodes.csv       (217 rows)
  <jar>/recvops.properties, sendops.properties  (extracted beforehand; this
        script also reads them straight from the zip when zipfile works)

Outputs:
  research/result/stage-readiness/forensics/T086-G17-OPCODE-PROVENANCE.csv
  stdout summary numbers used by the report.

Value-source classes:
  SERVER-PROPERTIES    numeric value equals the jar property value
  SERVER-PROPERTIES-FF property explicitly sets 0xFF (disabled placeholder)
  DEFAULT-FFFE         enum name absent from properties; ExternalCodeTableGetter
                       default (short)-2 = 0xFFFE (placeholder, never wire-real)
  PROPERTIES-CONFLICT  corpus value differs from the jar property
  NO-PROPERTY          name absent from properties AND corpus value is neither
                       0xFFFE nor any property value (manual/other source)
"""
import csv
import io
import os
import re
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
JAR = REPO / ".work/task-063/server079.jar"
CORPUS = REPO / "research/result/protocol-opcodes.csv"
C2S = REPO / "research/result/task055-c2s-opcodes.csv"
S2C = REPO / "research/result/task055-s2c-opcodes.csv"
OUT = REPO / "research/result/stage-readiness/forensics/T086-G17-OPCODE-PROVENANCE.csv"

PROP_RE = re.compile(r"^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$")


def parse_props(text: str):
    out = {}
    for line in text.splitlines():
        m = PROP_RE.match(line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def prop_to_int(v: str, props=None, depth=0):
    """Resolve a property value per ExternalCodeTableGetter.getValue:
    either a plain literal ('0x..' or decimal) or 'BASENAME offset' where the
    base is another enum's *property value* resolved recursively."""
    v = v.strip()
    args = v.split(" ")
    if len(args) == 2 and props is not None and depth < 8:
        base = prop_to_int(props.get(args[0], "0"), props, depth + 1)
        off = prop_to_int(args[1], None)
        return (base + off) & 0xFFFF
    if args[0].lower().startswith("0x"):
        return int(args[0], 16)
    return int(args[0])


def load_jar_props():
    with zipfile.ZipFile(JAR) as z:
        recv = parse_props(z.read("recvops.properties").decode("utf-8", "replace"))
        send = parse_props(z.read("sendops.properties").decode("utf-8", "replace"))
    return recv, send


def read_csv_rows(p: Path):
    with p.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    recv_props, send_props = load_jar_props()
    corpus = read_csv_rows(CORPUS)

    # task055 side files: cross-check value consistency with the corpus
    c2s = {r["name"]: int(r["opcode"]) for r in read_csv_rows(C2S)}
    s2c = {r["name"]: int(r["opcode"]) for r in read_csv_rows(S2C)}
    task055 = {"recv": c2s, "send": s2c}

    out_rows = []
    counts = {
        "corpus_total": len(corpus),
        "recv_rows": 0,
        "send_rows": 0,
        "SERVER-PROPERTIES": 0,
        "SERVER-PROPERTIES-FF": 0,
        "DEFAULT-FFFE": 0,
        "PROPERTIES-CONFLICT": 0,
        "NO-PROPERTY": 0,
        "task055_value_agrees": 0,
        "task055_missing": 0,
    }
    conflicts, ff_rows, fffe_rows = [], [], []
    for r in corpus:
        direction = r["direction"]
        name = r["name"]
        dec = int(r["opcode_dec"])
        props = recv_props if direction == "recv" else send_props
        counts["recv_rows" if direction == "recv" else "send_rows"] += 1
        pv = props.get(name)
        if pv is not None:
            pnum = prop_to_int(pv, props)
            if pnum == 0xFF:
                src = "SERVER-PROPERTIES-FF"
                ff_rows.append(f"{direction} {name}")
            elif pnum == dec:
                src = "SERVER-PROPERTIES"
            else:
                src = "PROPERTIES-CONFLICT"
                conflicts.append((direction, name, dec, pv))
        else:
            if dec in (0xFFFE, -2):
                src = "DEFAULT-FFFE"
                fffe_rows.append(f"{direction} {name}")
            else:
                src = "NO-PROPERTY"
        # task055 agreement
        t = task055.get(direction, {}).get(name)
        if t is None:
            t055 = "absent"
            counts["task055_missing"] += 1
        elif t == dec:
            t055 = "agree"
            counts["task055_value_agrees"] += 1
        else:
            t055 = f"differs({t})"
        counts[src] = counts.get(src, 0) + 1
        out_rows.append({
            "direction": direction,
            "opcode_hex": r["opcode_hex"],
            "opcode_dec": r["opcode_dec"],
            "name": name,
            "jar_property": pv if pv is not None else "",
            "value_source": src,
            "notes_field": r.get("notes", ""),
            "task055_check": t055,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)

    print("jar recvops.properties entries:", len(recv_props))
    print("jar sendops.properties entries:", len(send_props))
    print("task055 c2s rows:", len(c2s), " s2c rows:", len(s2c))
    print("corpus rows:", counts)
    print("conflicts:", conflicts)
    print("explicit-0xFF rows:", len(ff_rows))
    print("DEFAULT-FFFE rows:", len(fffe_rows))
    print("wrote", OUT)

    # Optional public-079-server cross-check (files fetched to %TEMP%/opencode/t086
    # for the T086 round; URLs recorded in the report — not committed to the repo).
    pub_dir = Path(os.environ.get("TEMP", "")) / "opencode/t086"
    pub_sets = {
        "ms079_recv": "recv", "ms079_send": "send",
        "afauria_recv": "recv", "afauria_send": "send",
    }
    for stem, direction in pub_sets.items():
        p = pub_dir / f"{stem}.properties"
        if not p.exists():
            print(f"public-server diff skipped ({stem} not fetched)")
            continue
        pub = parse_props(p.read_text(encoding="utf-8", errors="replace"))
        jar = recv_props if direction == "recv" else send_props
        common = set(jar) & set(pub)
        agree = sum(1 for n in common if prop_to_int(jar[n], jar) & 0xFFFF == prop_to_int(pub[n], pub) & 0xFFFF)
        con = [(n, jar[n], pub[n]) for n in sorted(common)
               if prop_to_int(jar[n], jar) & 0xFFFF != prop_to_int(pub[n], pub) & 0xFFFF]
        print(f"[{stem}] jar={len(jar)} pub={len(pub)} common={len(common)} "
              f"agree={agree} conflict={len(con)} jar-only={len(set(jar)-set(pub))} "
              f"pub-only={len(set(pub)-set(jar))}")
        for n, a, b in con[:25]:
            print("   CONFLICT", n, "jar=", a, "pub=", b)
    return 0


if __name__ == "__main__":
    sys.exit(main())
