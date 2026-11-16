"""T090 WP0: canonical record errata (three confirmed problems, no algorithm reopening).

WP0-A  C-109/C-115 focus-source conflict: correct the CURRENT-EFFECTIVE claim text of
       C-109 to the byte-proven `[[arg3]+0x14]` Set path (independently re-verified
       this round by t090_wp0a_focus_args.py / t090_wp0a_callers_anchored.py:
       0x769B51 ret 4; 0x93CB27 ret 0xC = (this, record, N, arg3); both 0x93CD77
       fetches read ecx=[ebp+0x10]=arg3). The t088 `[[this+0xF28]+0x14]` reading is
       demoted to historical inference (kept as history, marked superseded), the 10
       E8 callers / Set address / branch gates / bounded notes are preserved.
       Syncs EV-94 annotation, P0-P4 matrix residual wording, readiness report
       note, and the three T088 historical documents with inline erratum notes
       (T089 WP0-B precedent).
WP0-B  OpenMS match-matrix statistics: the T089 main report says 26 rows / 22
       executed / 4 NOT-RUN; the real CSV has 24 rows = 16 MATCH-class + 2 REFUTED
       + 2 INCONCLUSIVE + 1 internal RESOLVED + 3 NOT-RUN; excluding the 2 internal
       research rows (EV-20 refutation, namespace RESOLVED): 22 external candidates,
       19 executed, 3 not executed. Fix the report to the recounted numbers.
WP0-C  Gap-closure audit: fill reviewer_opinion from the real archived Phase-2/3/4
       reviewer record (T089-REVIEWER-INDEPENDENT.md), fix G40 start status to the
       authoritative PARTIAL-STATIC, replace `n/a` end statuses with authoritative
       statuses, verify G35 remains CLOSED-STATIC and no gap migrates.
       Also reconcile matrix reviewer_ruling cells that the Phase-2 summary table
       explicitly confirmed (traceable to the archive); NOT-RUN rows stay n/a.

Idempotent; refuses to run twice (marker scan). Read-only on binaries.
"""
import csv
import io
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
SR = REPO / "research/result/stage-readiness"
FORENSICS = SR / "forensics"

T090_TAG = "[t090 WP0 erratum]"

# ---------------------------------------------------------------- helpers


def read_text(p):
    return p.read_text(encoding="utf-8")


def write_text(p, s):
    p.write_text(s, encoding="utf-8", newline="")


def read_csv_rows(p):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.reader(f))


def write_csv_rows(p, rows):
    with open(p, "w", encoding="utf-8", newline="") as f:
        csv.writer(f, lineterminator="\n").writerows(rows)


def replace_once(text, old, new, what):
    if old not in text:
        raise SystemExit(f"FAIL: cannot find {what} target text")
    if text.count(old) != 1:
        raise SystemExit(f"FAIL: {what} target not unique ({text.count(old)} hits)")
    return text.replace(old, new)


def main():
    if T090_TAG in read_text(SOT / "claims.csv"):
        print("already applied (marker present) - nothing to do")
        return

    # ================================================================ WP0-A
    # ---- 1. claims.csv C-109: current-effective text correction
    claims_path = SOT / "claims.csv"
    rows = read_csv_rows(claims_path)
    hdr = rows[0]
    idx = {name: i for i, name in enumerate(hdr)}
    c109 = next(r for r in rows if r and r[0] == "C-109")

    old_claim = (
        'G10 FOCUS-WRITER FAMILY (t088, EV-94/EV-93): direct shared-V2D Set site 0x93CC9B inside '
        "0x93CB27(this, scriptRecord) — shared-object create chain 0x7A48D0/0x40634C/0x447891 at "
        "0x93CBBE-0x93CBDD, default variants, then Set(X(src), Y(src)) with src = [[this+0xF28]+0x14] "
        "(AddRef getter 0x93CD77; X via 0x404B07/[vt+0x20], Y via 0x404B2E/[vt+0x28]); gates: record "
        "present, [this+0x3B8]==0, payload count ([eax-4]>>1)!=0, record tag in {0x4F5C6A, 0xD7511E} "
        "(unknown tags take the 0x4B1C27(this,&arg3) fill-and-skip path); EXACTLY 10 E8 callers "
        "(0x5C0342 N=0x320; 0x93E00B/0x959493/0x959527 N=0x3E8; 0x964E16 N=0x3E8 same-map "
        "portal-trigger family; 0x9651CC/0x965567 seat region; 0x98DC43 N=0x1F4 packet-spawn family; "
        "0x990E21/0x990E91 user region) with the uniform idiom 0x769B51([0xBD8FEC], string_id, N, 0) "
        "-> record -> 0x93CB27 — an EVENT/SCRIPT-driven focus (portal/spawn camera focus candidate), "
        "NOT a per-tick updater; NO -(400,300) offset at this site (funnel bypassed); BOUNDED: src is "
        "a private position object of the avatar-container class (NOT a 0x31D alias — no +0x14 attach "
        "exists among the 80 resolve sites), and its writer census (whether src tracks the avatar draw "
        "position centred, top-left, or scripted offsets) is the remaining semantic half"
    )
    new_claim = (
        "G10 FOCUS-WRITER FAMILY (t088 proven; SOURCE WORDING CORRECTED t089/C-115, byte-verified "
        "independently t090 WP0-A): direct shared-V2D Set site 0x93CC9B inside 0x93CB27(this, record, "
        "N, arg3) (ret 0xC — THREE stack args; 0x769B51 is ret 4 = ONE arg, so the N/arg3 slots "
        "pre-pushed beneath the 0x769B51 call flow to 0x93CB27) — shared-object create chain "
        "0x7A48D0/0x40634C/0x447891 at 0x93CBBE-0x93CBDD, default variants, then Set(X(src), Y(src)) "
        "with src = [[arg3]+0x14] (BOTH fetches at 0x93CC15/0x93CC3B do mov ecx,[ebp+0x10]=arg3 then "
        "call the AddRef getter 0x93CD77 ([ecx+0x14]); X via 0x404B07/[vt+0x20], Y via 0x404B2E/"
        "[vt+0x28]) [HISTORICAL t088 INFERENCE, SUPERSEDED: 'src = [[this+0xF28]+0x14]' — that "
        "expression is byte-proven ONLY for the unknown-tag fill-and-skip path (0x4B1C27 reads "
        "[this+0xF28]) which SKIPS the Set; it must not be re-used as the Set-path source]; gates: "
        "record present, [this+0x3B8]==0, payload count ([eax-4]>>1)!=0, record tag in {0x4F5C6A, "
        "0xD7511E} (unknown tags take the 0x4B1C27(this,&arg3) fill-and-skip path); EXACTLY 10 E8 "
        "callers passing (record, N in {0x1F4,0x320,0x3E8}, arg3) — 0x5C0342 (N=0x320, arg3=esi "
        "caller object); 0x93E00B (N=0x3E8, arg3=0); 0x959493 (N=0x320, arg3=[ebp+0x20]); 0x959527 "
        "(N=0x320, arg3=0); 0x964E16 (N=0x3E8, arg3=0, pre-push idiom); 0x9651CC (N=0x3E8, arg3=0, "
        "id 0x40413D, pre-push idiom); 0x965567 (N=0x3E8, arg3=ebx=0); 0x98DC43 (N=0x1F4, arg3=0, "
        "id 0x406849, pre-push idiom; containing code calls the [0xBDD460] getter 0x43291A at "
        "0x98DC0C); 0x990E21/0x990E91 (N=0x3E8, arg3=esi) — 0x769B51([0xBD8FEC], string_id) -> "
        "record -> 0x93CB27: an EVENT/SCRIPT-driven focus (portal/spawn camera focus candidate), NOT "
        "a per-tick updater; NO -(400,300) offset at this site (funnel bypassed); BOUNDED: src is a "
        "private position object of the arg3-supplied object's class (NOT a 0x31D alias — no +0x14 "
        "attach exists among the 80 resolve sites); whether any caller's arg3 aliases [this+0xF28] "
        "(two then-unlinked dataflows per the t090 tasking; the 0x990E21/0x990E91 windows show "
        "arg3=esi whose identity is not yet byte-resolved to F28) and the +0x14 writer census "
        "(whether src tracks the avatar draw position centred, top-left, or scripted offsets) are "
        "the remaining semantic half"
    )
    assert old_claim in c109[idx["claim"]], "C-109 claim body drifted from expected text"
    c109[idx["claim"]] = c109[idx["claim"]].replace(old_claim, new_claim)
    old_fals = "a writer of [[user+0xF28]+0x14] storing values incompatible with a follow-focus interpretation"
    new_fals = (
        "a caller of 0x93CB27 passing fewer/more args, or (once the arg3/+0x14 writer census lands) "
        "a writer of [[arg3]+0x14] storing values incompatible with a follow-focus interpretation"
    )
    assert old_fals in c109[idx["falsification"]], "C-109 falsification drifted"
    c109[idx["falsification"]] = c109[idx["falsification"]].replace(old_fals, new_fals)
    old_reason = "full body + caller census instruction-level; the target-object semantics bounded (its writers not yet censused)"
    new_reason = (
        "full body + caller census instruction-level; t090 WP0-A independent re-verification "
        "(t090_wp0a_focus_args.py + t090_wp0a_callers_anchored.py: 0x769B51 ret 4, 0x93CB27 ret 0xC, "
        "10 anchored caller windows) — the target-object semantics bounded (its writers not yet censused)"
    )
    assert old_reason in c109[idx["reasoning"]], "C-109 reasoning drifted"
    c109[idx["reasoning"]] = c109[idx["reasoning"]].replace(old_reason, new_reason)
    write_csv_rows(claims_path, rows)

    # ---- 2. evidence.csv EV-94: annotate the caller-idiom refinement
    ev_path = SOT / "evidence.csv"
    ev_rows = read_csv_rows(ev_path)
    ev_hdr = {n: i for i, n in enumerate(ev_rows[0])}
    ev94 = next(r for r in ev_rows if r and r[0] == "EV-94")
    old_interp_tail = "focus writer 0x93CB27 full body + 10-caller census (N in {500,800,1000})"
    assert old_interp_tail in ev94[ev_hdr["interpretation"]], "EV-94 interpretation drifted"
    ev94[ev_hdr["interpretation"]] = ev94[ev_hdr["interpretation"]].replace(
        old_interp_tail,
        old_interp_tail
        + " [t090 WP0-A: caller idiom refined per C-115 — 0x769B51 ret 4 / 0x93CB27 ret 0xC "
        "(this, record, N, arg3); Set src = [[arg3]+0x14], re-verified t090_wp0a_*]",
    )
    write_csv_rows(ev_path, ev_rows)

    # ---- 3. P0-P4 matrix: residual census target wording (P2-05/P2-06/P4-07)
    mx_path = SR / "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv"
    mx_text = read_text(mx_path)
    mx_text = replace_once(
        mx_text,
        "焦点写入者 0x93CB27 的目标对象 [[user+0xF28]+0x14] 语义未闭合（其写入者未普查）",
        "焦点写入者 0x93CB27 的目标对象 [[arg3]+0x14] 语义未闭合（其写入者未普查；arg3 与 "
        "[user+0xF28] 的关系是两条待证数据流，t090 WP0-A 已按 C-115 同步）",
        "matrix P2-05 residual",
    )
    mx_text = mx_text.replace(
        "剩余可能栖息地=[[user+0xF28]+0x14] 写入者（未普查）与 25 个 INCONCLUSIVE 站点包含函数",
        "剩余可能栖息地=[[arg3]+0x14] 写入者（未普查；arg3 与 [user+0xF28] 关系待证）与 25 个 "
        "INCONCLUSIVE 站点包含函数",
    )
    mx_text = mx_text.replace(
        "STATIC 追 [[user+0xF28]+0x14] 写入者普查与 INCONCLUSIVE 站点解码",
        "STATIC 追 [[arg3]+0x14] 写入者普查与 INCONCLUSIVE 站点解码",
    )
    mx_text = mx_text.replace(
        "普查 [[user+0xF28]+0x14] 位置对象的写入者（关闭焦点写入者几何语义）",
        "普查 [[arg3]+0x14] 位置对象的写入者（关闭焦点写入者几何语义；含 arg3↔[user+0xF28] 关系判定）",
    )
    mx_text = mx_text.replace(
        "STATIC：普查 [[user+0xF28]+0x14] 位置对象的写入者",
        "STATIC：普查 [[arg3]+0x14] 位置对象的写入者",
    )
    mx_text = mx_text.replace(
        "STATIC 同 P2-05（[F28+0x14] 写入者普查）",
        "STATIC 同 P2-05（[[arg3]+0x14] 写入者普查）",
    )
    mx_text = mx_text.replace(
        "焦点写入者目标对象 [[user+0xF28]+0x14] 语义（是否=落点居中）未闭合",
        "焦点写入者目标对象 [[arg3]+0x14] 语义（是否=落点居中）未闭合",
    )
    mx_text = mx_text.replace(
        "STATIC：[F28+0x14] 写入者普查 + INCONCLUSIVE 站点",
        "STATIC：[[arg3]+0x14] 写入者普查 + INCONCLUSIVE 站点",
    )
    mx_text = mx_text.replace(
        "剩余：[[user+0xF28]+0x14] 写入者普查（定焦点几何语义）",
        "剩余：[[arg3]+0x14] 写入者普查（定焦点几何语义，含 arg3↔F28 关系）",
    )
    write_text(mx_path, mx_text)

    # ---- 4. Readiness report: append a t090 erratum note to the t088 blockquote
    rd_path = SR / "P0-P4-READINESS-REPORT.md"
    rd = read_text(rd_path)
    anchor = "独立 Reviewer 见 `forensics/T088-REVIEWER-INDEPENDENT.md`。阶段维持 **NOT STAGE-READY**。"
    assert anchor in rd, "readiness t088 paragraph anchor missing"
    rd = rd.replace(
        anchor,
        anchor + " **t090 WP0-A 勘误**：本段 t088 历史结论中的 `src=[[user+0xF28]+0x14]` 自 "
        "T089/C-115 起已被字节证据修正为 `[[arg3]+0x14]`（0x769B51 ret 4 / 0x93CB27 ret 0xC；"
        "[this+0xF28] 仅出现在未知标签的填充-跳过路径）；t090 已独立复核（T090-WP0A-*），"
        "详见 C-109 修正文本。其余内容不变。",
        1,
    )
    write_text(rd_path, rd)

    # ---- 5. T088 historical docs: inline erratum notes (keep original text as history)
    t088r = SR / "T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md"
    t = read_text(t088r)
    old109 = "src=[[this+0xF28]+0x14]（AddRef getter 0x93CD77；X=[vt+0x20]、Y=[vt+0x28]）。"
    assert old109 in t, "T088 report L109 anchor missing"
    t = t.replace(
        old109,
        old109 + " **[t090 WP0-A 勘误]** 该来源表述自 T089/C-115 起被字节证据修正：0x769B51 为 "
        "ret 4（单参），0x93CB27 为 ret 0xC（this, record, N, arg3），Set 路径两次取源均在 "
        "0x93CC15/0x93CC3B 以 `ecx=[ebp+0x10]`（arg3）调用 0x93CD77，故 Set 源为 "
        "`[[arg3]+0x14]`；`[[this+0xF28]+0x14]` 仅字节证明于未知标签填充-跳过路径（0x4B1C27，"
        "不执行 Set）。本行保留为历史记录。",
        1,
    )
    # WP2 table row note
    wp2_anchor = "统一 0x769B51 脚本记录惯用法，N∈{500,800,1000}）——事件/脚本驱动的跟随候选 |"
    if wp2_anchor in t:
        t = t.replace(
            wp2_anchor,
            wp2_anchor[:-1] + "（t090 WP0-A 勘误：src 已修正为 [[arg3]+0x14]，见 C-109/C-115） |",
            1,
        )
    write_text(t088r, t)

    deadzone = FORENSICS / "T088-CAMERA-CADENCE-DEADZONE.md"
    t = read_text(deadzone)
    old81 = "`src = [[this+0xF28]+0x14]` (avatar-container member, slots +0x20/+0x28)."
    assert old81 in t, "deadzone L81 anchor missing"
    t = t.replace(
        old81,
        old81 + " **[t090 WP0-A erratum]** superseded by C-115 (Set src = `[[arg3]+0x14]`; the F28 "
        "expression is byte-proven only for the fill-and-skip path that never Sets).",
        1,
    )
    write_text(deadzone, t)

    slotcsv = FORENSICS / "T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv"
    t = read_text(slotcsv)
    old_row = (
        '0x0093cbbe,0x0093cb27,0x0093cc9b,disp32,unknown,unknown,"default(VT_ERROR,missing)",'
        '[ebp + 8],CONFIRMED-CAMERA-WRITER,"focus writer 0x93CB27: Set(X([[this+0xF28]+0x14]), '
        'Y(same)) via 0x404B07/0x404B2E on the shared V2D create 0x93CBBE"'
    )
    assert old_row in t, "slot90 classification row drifted"
    t = t.replace(
        old_row,
        '0x0093cbbe,0x0093cb27,0x0093cc9b,disp32,unknown,unknown,"default(VT_ERROR,missing)",'
        '[ebp + 8],CONFIRMED-CAMERA-WRITER,"focus writer 0x93CB27: Set(X([[arg3]+0x14]), Y(same)) '
        'via 0x404B07/0x404B2E on the shared V2D create 0x93CBBE [t090 WP0-A: src corrected per '
        'C-115 — was [[this+0xF28]+0x14] in t088, byte-proven only for the fill-and-skip path]"',
        1,
    )
    write_text(slotcsv, t)

    # ================================================================ WP0-B
    t089r = SR / "T089-OPENMS-STATIC-GAP-CLOSURE-REPORT.md"
    t = read_text(t089r)
    old_stats = (
        "- 实际检查候选：**22**（矩阵 26 行中 22 行为本轮执行，4 行 NOT-RUN）。\n"
        "- **MATCH / MATCH-STRUCTURE / MATCH-COUNTS：16**（含 G35 back 常量、G36 attach+evaluator+vtable 槽、\n"
        "  G39 delay 默认/记录布局/累加/repeat 三分/portal 帧数、G10 滤波器三要素、G37 共享引擎、G36 滚动调度）。\n"
        "- **REFUTED（对 CMS079）：2**——GMS083 front 常量 B+272000（CMS079=B+271200）；\n"
        "  EV-20“仅 1 个 imul-1000 站点”（实为 61）。\n"
        "- **INCONCLUSIVE：2**——GMS083 0x00641EF1 clamp 未在本轮追踪；GMS083 portal id 空间与 CMS079 不同\n"
        "  （0x1122/0x1123 在 CMS079 为 GBK 字符串，id 不可移植，语义按 CMS079 自身 id 证明）。"
    )
    new_stats = (
        "**[t090 WP0-B 勘误——真实矩阵重新对账]** 本节 T089 版统计（“26 行 / 22 执行 / 4 NOT-RUN”）与\n"
        "T089-OPENMS-CMS079-MATCH-MATRIX.csv 的真实内容不符，已按 CSV 逐行重数修正：\n"
        "- 矩阵总计 **24 数据行**：MATCH 类 **16**（MATCH/MATCH-STRUCTURE/MATCH-COUNTS/“MATCH (shared\n"
        "  engine)”）、REFUTED 类 **2**、INCONCLUSIVE 类 **2**、内部研究项 **2**（EV-20 旧证据反证；\n"
        "  namespace 名称 RESOLVED——均非 OpenMS 外部候选）、NOT-RUN **3**（G40/G20/G16）。\n"
        "- 严格排除 2 条内部研究行后，**外部 OpenMS 候选 = 22 项：已执行 19，未执行 3**；\n"
        "  已执行项分布：16 MATCH 类、1 REFUTED（GMS083 front 常量 B+272000，CMS079=B+271200）、\n"
        "  2 INCONCLUSIVE（GMS083 0x00641EF1 clamp 未追踪；GMS083 portal id 空间不同——0x1122/0x1123\n"
        "  在 CMS079 为 GBK 字符串，语义按 CMS079 自身 id 证明）。\n"
        "- EV-20“仅 1 个 imul-1000 站点”的反证（实为 61）为内部证据勘误行，不计入外部候选执行数。\n"
        "- 真实匹配结果未作任何改动（见回归测试 test_t090_round.py 的矩阵分类汇总断言）。"
    )
    assert old_stats in t, "T089 report sec3 stats anchor missing"
    t = t.replace(old_stats, new_stats, 1)
    write_text(t089r, t)

    # ---- matrix reviewer_ruling reconciliation (archive-traceable only)
    mtrx = SR / "T089-OPENMS-CMS079-MATCH-MATRIX.csv"
    mrows = read_csv_rows(mtrx)
    mhdr = {n: i for i, n in enumerate(mrows[0])}
    # Phase-2 summary table (T089-REVIEWER-INDEPENDENT.md) explicitly CONFIRMED these
    # (gap_id, external_function_or_const) keys:
    phase2_confirmed = {
        ("G35", "0x0063CD4E back B-128000+index*1000"),
        ("G35", "0x0063CD4E front B+272000+index*1000"),
        ("G35", "background index enumeration"),
        ("G36", "Shape2D 0x5140847D parallax attach slot+0x98"),
        ("G36", "evaluator 0x514085B3 local+=trunc((now-attach)*r/100)"),
        ("G36", "vtable 0x5140C0FC slot+0x90/+0x98"),
        ("G36", "auto-scroll attach ratios (0 ry+100)/(rx+100 0)"),
        ("G39", "0x0043F768 delay default 0x78"),
        ("G39", "Gr2D 0x5040ABEF delay@+0x0C a0@+0x10 a1@+0x14"),
        ("G39", "Gr2D 0x5040B9E7 accumulates delay*scale/1000"),
        ("G39", "repeat -1/-2 one-shot nonnegative suffix"),
        ("G39", "pv loop 8f/960ms ph 4+7+3"),
        ("G10", "Shape2D 51408d23/51408e33 filter"),
        ("G10", "filter 0x1E0000 coefficient 100"),
        ("G10", "0x00437A31 attach local-user target (x y-50)"),
        ("G37", "frame delay/repeat engine shared"),
    }
    changed = 0
    for r in mrows[1:]:
        key = (r[mhdr["gap_id"]], r[mhdr["external_function_or_const"]])
        cur = r[mhdr["reviewer_ruling"]]
        if r[mhdr["verdict"]] == "NOT-RUN":
            if cur != "n/a":
                r[mhdr["reviewer_ruling"]] = "n/a"
                changed += 1
            continue
        if key in phase2_confirmed:
            if cur != "phase2-verified":
                r[mhdr["reviewer_ruling"]] = "phase2-verified"
                changed += 1
        else:
            note = "phase4-round-accept (row not individually re-derived by reviewer)"
            if cur != note:
                r[mhdr["reviewer_ruling"]] = note
                changed += 1
    write_csv_rows(mtrx, mrows)

    # ================================================================ WP0-C
    audit = SR / "T089-GAP-CLOSURE-AUDIT.csv"
    arows = read_csv_rows(audit)
    ahdr = {n: i for i, n in enumerate(arows[0])}

    phase234 = {
        "G35": "archived-ACCEPT (phase2 ACCEPT-WITH-CORRECTIONS items D3/D4/D8; phase3 verified; phase4 ACCEPT — T089-REVIEWER-INDEPENDENT.md phases 2-4)",
        "G36": "archived-ACCEPT (phase2 D15 correlative caveat accepted; phase3 verified; phase4 ACCEPT — T089-REVIEWER-INDEPENDENT.md phases 2-4)",
        "G37": "archived-ACCEPT (phase2 D14 honesty adjudication PASS; phase4 ACCEPT — T089-REVIEWER-INDEPENDENT.md phases 2-4)",
        "G39": "archived-ACCEPT (phase2 D2 blocking wording corrected 'universal 120' -> 18/36; phase3 verified; phase4 ACCEPT — T089-REVIEWER-INDEPENDENT.md phases 2-4)",
        "G10": "archived-ACCEPT (phase2 D1 blocking chain corrections landed; phase3 verified; phase4 ACCEPT — T089-REVIEWER-INDEPENDENT.md phases 2-4)",
    }
    for r in arows[1:]:
        gid = r[ahdr["gap_id"]]
        if gid in phase234:
            assert r[ahdr["reviewer_opinion"]] == "pending", f"{gid} opinion drifted"
            r[ahdr["reviewer_opinion"]] = phase234[gid]
        if gid == "G40":
            assert r[ahdr["start_status"]] == "OPEN-STATIC", "G40 start drifted"
            r[ahdr["start_status"]] = "PARTIAL-STATIC"
            r[ahdr["new_evidence_this_round"]] = "none this round (WP6 limited); [t090 WP0-C: start status corrected to the authoritative gaps.csv value PARTIAL-STATIC — the T089 cell wrote OPEN-STATIC in error]"
            r[ahdr["still_unmet"]] = (
                "T3 slot4 0x9C6028 and T6 slot4 0x9D06D4 full bodies; walk/swim/land full sequencing "
                "inside the 0x9BD757 family; shoe-object installer for M+0x198 (equipment pipeline)"
            )
            r[ahdr["end_status"]] = "PARTIAL-STATIC"
            r[ahdr["status_change_reason"]] = (
                "not targeted per dispatch policy (G35/G36/G39/G10 priority); [t090 WP0-C: end "
                "status is the authoritative PARTIAL-STATIC, the T089 'n/a' cell was not a gap status]"
            )
            r[ahdr["reviewer_opinion"]] = (
                "archived-phase4-round-ACCEPT (G40 not targeted in T089; status cells reconciled to "
                "authoritative gaps.csv — T089-REVIEWER-INDEPENDENT.md phase 4)"
            )
        if gid in ("G20", "G16"):
            assert r[ahdr["end_status"]] == "n/a", f"{gid} end drifted"
            r[ahdr["end_status"]] = "OPEN-STATIC"
            r[ahdr["status_change_reason"]] = (
                r[ahdr["status_change_reason"]]
                + "; [t090 WP0-C: end status is the authoritative OPEN-STATIC, 'n/a' was not a gap status]"
            )
            r[ahdr["reviewer_opinion"]] = (
                "archived-phase4-round-ACCEPT (not targeted in T089; status cells reconciled to "
                "authoritative gaps.csv — T089-REVIEWER-INDEPENDENT.md phase 4)"
            )
    write_csv_rows(audit, arows)

    # ---- verify no accidental migration of gap statuses vs gaps.csv
    gap_status = {}
    grows = read_csv_rows(SOT / "gaps.csv")
    ghdr = {n: i for i, n in enumerate(grows[0])}
    for r in grows[1:]:
        gap_status[r[ghdr["gap_id"]]] = r[ghdr["status"]]
    assert gap_status["G35"] == "CLOSED-STATIC", "G35 must stay CLOSED-STATIC"
    assert gap_status["G40"] == "PARTIAL-STATIC"
    for r in arows[1:]:
        gid = r[ahdr["gap_id"]]
        if r[ahdr["end_status"]] not in ("n/a",):
            assert r[ahdr["end_status"]] == gap_status[gid], (
                f"{gid} audit end {r[ahdr['end_status']]} != authoritative {gap_status[gid]}"
            )

    print("WP0 applied: C-109 corrected; EV-94 annotated; matrix/readiness/T088 docs synced;")
    print(f"           report stats fixed; audit opinions archived; matrix rulings reconciled ({changed} cells)")
    print("           gaps.csv statuses untouched (G35 still CLOSED-STATIC; G40/G20/G16 authoritative)")


if __name__ == "__main__":
    main()
