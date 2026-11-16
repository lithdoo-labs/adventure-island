"""T091: apply reviewer phase-2 corrections D1/D2/D3 + recommendations to the
deliverables (report, provenance MD, CSVs) and C-120 (D3 + boundary notes)."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# ---- D1: caller-identity CSV wording ----
p = REPO / "research/result/stage-readiness/forensics/T091-ARG3-CALLER-IDENTITY.csv"
t = p.read_text(encoding="utf-8")
if "IVector2D view" in t:
    t = t.replace(
        "'IVector2D view",
        "W-member method 0x5C0327 is a DIRECTLY-CALLED member method of W (no vtable slot; "
        "exclusive direct caller 0x5C0430 with ecx=ebx=W; W vtable 0xB0BC40 slot+8 holds a bare "
        "ret-4 stub 0x5C0324, not a thunk - reviewer D1); 0x93CD77 reads [W+0x14] = P's "
        "IVector2D view",
    )
t = t.replace(
    "0x5C02CB is W vtable slot+4 family; both Set-capable callers deliver the SAME object identity W",
    "0x5C02CB is a DIRECTLY-CALLED member method of W (exclusive direct caller 0x5C0429 with "
    "ecx=ebx=W; W vtable 0xB0BC40 slot+4 = 0x5C02A9 is a ret-0x10 predicate stub, not a dispatch "
    "to 0x5C02CB - reviewer D1); both Set-capable callers deliver the SAME object identity W",
)
p.write_text(t, encoding="utf-8")
print("D1: caller CSV fixed")

# ---- D2: member-writers CSV rows ----
p = REPO / "research/result/stage-readiness/forensics/T091-ARG3-MEMBER14-WRITERS.csv"
t = p.read_text(encoding="utf-8")
t = t.replace(
    "arg6 = P itself (push esi=P at 0x5BFEFB)",
    "arg6 = the 0xA4F6F1([0xBDD498],X,Y,0,0x7FFFFFFF,1) map-space query result "
    "(esi=eax at 0x5BFEE3; pushed at 0x5BFEFB - reviewer D2 correction; NOT P)",
)
t = t.replace(
    "[owner+0x1C]/[owner+0x20] (owner=P at ctor: reads [P+0x1C]=0 delegate and [P+0x20] slot dword)",
    "[owner+0x1C]/[owner+0x20] where owner = the 0xA4F6F1 result object "
    "(0xB00D88-vtable map-space object - reviewer D2 correction)",
)
t = t.replace(
    '"W ctor arg6 = 0 (0x948E34-0x948E35 push ebx x2)"',
    '"W ctor arg6 = 0 (0x948E34-0x948E35 push ebx x2; = 0x9BC622 stack arg4)"',
)
t = t.replace(
    '"W ctor arg7 = 0"',
    '"W ctor arg7 = 0 (= 0x9BC622 stack arg5)"',
)
p.write_text(t, encoding="utf-8")
print("D2: writers CSV fixed")

# ---- D1 in the main report ----
p = REPO / "research/result/stage-readiness/T091-G10-FOCUS-PROVENANCE-REPORT.md"
t = p.read_text(encoding="utf-8")
t = t.replace(
    "W-方法 `0x5C0327`（W vtable slot+8 的 0x5C0324 thunk 后体）",
    "W-成员方法 `0x5C0327`（W 的直接调用成员方法——全镜像独占直接调用者 `0x5C0430`（ecx=ebx=W）；"
    "W vtable 0xB0BC40 slot+8 处是空 `ret 4` 桩 0x5C0324，非 thunk〔reviewer D1 修正〕）",
)
t = t.replace(
    "分支 → 0x5C02CB/0x5C0327（W 的两个虚方法）",
    "分支 → 0x5C02CB/0x5C0327（W 的两个直接调用成员方法，非 vtable 派发〔reviewer D1〕）",
)
t = t.replace(
    "二者是同一实例的两条相邻分支", "二者是同一实例的两条相邻分支",
)
# D2 in the report object graph
t = t.replace(
    "0x9BC622(P,1,X±1,Y−20,0,0,P): 加密槽",
    "0x9BC622(P,1,X±1,Y−20,0,0,3,owner=0xA4F6F1 结果): 加密槽",
)
p.write_text(t, encoding="utf-8")
print("D1/D2: main report fixed")

# ---- D3 + recommendations in C-120 ----
p = REPO / "research/source-of-truth/claims.csv"
with open(p, encoding="utf-8", newline="") as f:
    rdr = csv.reader(f)
    fields = next(rdr)
    rows = list(csv.DictReader(f, fieldnames=fields))
for r in rows:
    if r["claim_id"] == "C-120":
        c = r["claim"]
        c = c.replace(
            "a smart-ptr wrapper X whose +4 = W)",
            "a smart-ptr wrapper X that the consumer derefs at +4 as the receiver — the {+0=state,+4=W} "
            "wrapper idiom is byte-proven at 0x94ACB7/0x94AA93/0x94ACCC, but the writer of [Eye+0x68] "
            "(the installer of that X) is the bounded residual R-T091-4, so the X-to-W edge is "
            "convention-backed inference rather than a byte-located write [reviewer phase-2 D3 qualifier])",
        )
        # recommendation 2: runtime tag-membership boundary
        c = c.replace(
            "RESIDUALS (honest): ",
            "BOUNDARY: the record-tag membership ({0x4F5C6A,0xD7511E} vs unknown) is runtime data — the Set is "
            "gated on it statically, not guaranteed; the [P+0x1C] never-installed census is band-scoped "
            "(0x9BC000-0x9C3000) with the standard same-offset-different-class caveat. RESIDUALS (honest): ",
        )
        r["claim"] = c
        print("D3 + rec: C-120 qualified")
with open(p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
