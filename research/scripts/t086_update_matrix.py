#!/usr/bin/env python3
"""T086: update P0-P4 matrix rows P1-09/P1-10/P1-11/P1-12 to reflect the
t086 static closures (node class, comparator, avatar key, zmap data)."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATRIX = REPO / "research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv"

UPD = {
    "P1-09": {
        "claim_ids": "C-007;C-017;C-022;C-053;C-074;C-075;C-077;C-082;C-086;C-087;C-096;C-097",
        "evidence_ids": "EV-03;EV-18;EV-19;EV-34;EV-59;EV-60;EV-72;EV-74;EV-75;EV-76;EV-82",
        "evidence_grade_and_type": "A（t080 指令级 0x427EB3 OUT；t084.1 生产 slot25=0x5040418C C-086；t086 节点类/插入链指令级 C-096/C-097/EV-82）",
        "unproven": "「限界」[eax+0xB4] 目标类已静态闭合（t086 C-096：slot25 返回对象 = ctor 0x504067D7 节点，主 vtable 0x5042E3F0，IID 6DC8C7CE；slot45=0x50409ECD 键控插入 C-097）；唯一残项为 PCOM 引擎类绑定的运行时佐证（C-087 二选一预测，对全部下游结论类不变，不阻塞按已证子行为编码）",
        "minimum_next_work": "（可选）bp 0x666F77 dump 佐证静态已证身份（预期 [EBP-0x10] vtable=0x5042E3F0）；静态无残项（t086 C-096/C-097）",
        "readiness": "RE-READY",
    },
    "P1-10": {
        "claim_ids": "C-003;C-014;C-019;C-053;C-074;C-075;C-085;C-097",
        "evidence_ids": "EV-01;EV-15;EV-16;EV-19;EV-34;EV-59;EV-71;EV-82",
        "evidence_grade_and_type": "A（t086：比较器 0x50403A42 全体读毕——slot4 链爬升 + slot0 键比较有符号结果；等键 tie-break=次键比较 C-097/EV-82）",
        "unproven": "「限界」比较器主体/等键策略已静态闭合（t086 C-097）；残项仅树遍历运行时佐证（可选，不阻塞按已证比较器语义编码）",
        "minimum_next_work": "静态无残项（t086 C-097 闭合比较器与等键策略）；容器遍历侧（Canvas Draw）可选增强",
        "readiness": "RE-READY",
    },
    "P1-11": {
        "claim_ids": "C-018;C-019;C-097",
        "evidence_ids": "EV-15;EV-28;EV-82",
        "evidence_grade_and_type": "A（t086：等键 tie-break=比较器 0x50403A42 对双方 slot0 键的确定性次序比较，非稳定插入 C-097）",
        "unproven": "原版 tie 语义已静态闭合（确定性次键比较）；产品 stable-sort 仍为安全超集",
        "minimum_next_work": "（无静态残项；可选产品 stable 顺序保持为超集策略）",
    },
    "P1-12": {
        "claim_ids": "C-025;C-043;C-045;C-097;C-099;C-100",
        "evidence_ids": "EV-19;EV-31;EV-82;EV-85;EV-86",
        "evidence_grade_and_type": "A（t086：avatar 世界键公式机器码恢复 C-099；跨对象插入与 tile/obj 同容器同比较器 C-097；zmap/smap 数据面闭合 C-100）",
        "unproven": "（原版键已静态恢复；渲染对照仅佐证性）",
        "can_static_continue_or_runtime": "静态已闭合（C-097/C-099/C-100）；运行时渲染对照可选",
        "minimum_next_work": "（无静态残项；实现可直接采用键公式 + 比较器次序）",
        "readiness": "RE-READY",
    },
}

rows = list(csv.DictReader(MATRIX.open(newline="", encoding="utf-8")))
fields = rows[0].keys()
# drop the sentinel key trick
for r in rows:
    rid = r["requirement_id"]
    if rid in UPD:
        for k, v in UPD[rid].items():
            if v is None:
                continue
            r[k] = v
with MATRIX.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
print("matrix updated: P1-09/P1-10/P1-11/P1-12")
