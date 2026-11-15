#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t089_update_matrix.py — update P0-P4 matrix rows + readiness report blocks for T089.

Surgical row edits for requirements whose gap set/claims changed:
  P0-05 (G37), P0-06 (G35;G36), P0-07 (G36;G39), P0-10 (G38;G39)
and the readiness report's headline statistics (CLOSED 25->26 etc.) plus
the T089 summary block.
"""
import csv
import io
import os
import re
import sys

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MATRIX = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv')
REPORT = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'P0-P4-READINESS-REPORT.md')


def main() -> int:
    with open(MATRIX, 'r', encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    fields = list(rows[0].keys())

    def upd(rid, **kw):
        for r in rows:
            if r['requirement_id'] == rid:
                r.update(kw)
                return
        raise SystemExit(f'requirement {rid} not found')

    upd('P0-05',
        claim_ids='C-002;C-017;C-049;C-052;C-112;C-113',
        evidence_ids='EV-02;EV-19;EV-33;EV-100;EV-101',
        evidence_grade_and_type='A+DATA；t080 flow 布局 + t089 共享动画引擎（delay/a0/a1 名、0x5040ABE6 布局、repeat 三分、模式 0x20/0x10）；per-frame 绘制体仍未证',
        unproven='flow 动态绘制 draw 体（运行时目标）；rx 在 flow 对象上的消费者',
        can_static_continue_or_runtime='STATIC 已到共享引擎边界；RUNTIME 仅余 draw 体定位',
        minimum_next_work='t089 后：flow 子对象动画时序已随 G39 引擎闭合；仅剩 draw 体（运行时）')
    upd('P0-06',
        claim_ids='C-024;C-048;C-049;C-050;C-051;C-110;C-111',
        evidence_ids='EV-20;EV-33;EV-98;EV-99;EV-103',
        evidence_grade_and_type='A；t080 0x66A8D5 约定 + t089 G35 键公式闭合（EV-98）与视差引擎 DLL 级闭合（EV-99/EV-103，+0x90/+0x98 体在 Shape2D 静态可读）',
        unproven='首帧绝对偏移（attach 基线依赖）；view slot +0x2C/+0x30 取值单位',
        can_static_continue_or_runtime='STATIC 已闭合引擎层；RUNTIME 仅余基线值/单位采样（可选佐证）',
        minimum_next_work='t089 后：键公式+视差+滚动机制已静态闭合；剩余=首帧绝对 offset（基线依赖）与 view 单位（可运行时佐证）')
    upd('P0-07',
        claim_ids='C-024;C-059;C-112;C-113',
        evidence_ids='EV-20;EV-40;EV-100;EV-101',
        evidence_grade_and_type='A；五属性 + t089 时序核心闭合（delay 默认 120/累加 delay*scale/1000/模式门/全局 tick）',
        unproven='每帧显式 delay 值（WZ 侧）；animationScale 默认值',
        can_static_continue_or_runtime='STATIC EXE+DLL 已穷尽；剩余为 WZ 资源值级',
        minimum_next_work='t089 后：时序语义已闭合；仅剩 WZ 帧延迟值提取（资源侧）')
    upd('P0-10',
        claim_ids='C-113',
        evidence_ids='EV-101;EV-103',
        evidence_grade_and_type='A+DATA；t089 portal 家族 id 静态解密（pv/Start/Continue/Exit）+ FSDB 帧数 8/4+7+3 与默认 120ms 规则',
        unproven='每帧显式 delay（WZ 侧）；pt10 image 变体资源核对',
        can_static_continue_or_runtime='STATIC id/帧数已核；资源引用检查 ENGINEERING',
        minimum_next_work='t089 后：portal 结构与时钟已静态闭合；剩余=WZ delay 值与 pt10 image 引用')

    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\r\n')
    w.writeheader()
    w.writerows(rows)
    with open(MATRIX, 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())
    print('matrix updated')

    # ---- readiness report headline stats ----
    txt = open(REPORT, 'r', encoding='utf-8', newline='').read()
    txt = txt.replace('CLOSED-STATIC 25', 'CLOSED-STATIC 26')
    txt = txt.replace('PARTIAL-STATIC 9', 'PARTIAL-STATIC 8')
    txt = txt.replace('| CLOSED-STATIC | 25 |', '| CLOSED-STATIC | 26 |')
    txt = txt.replace('| PARTIAL-STATIC | 9 |', '| PARTIAL-STATIC | 8 |')
    txt = txt.replace('静态闭合率 25/40', '静态闭合率 26/40')
    txt = txt.replace('62.5%', '65.0%')
    open(REPORT, 'w', encoding='utf-8', newline='').write(txt)
    print('readiness report stats updated')
    return 0


if __name__ == '__main__':
    sys.exit(main())
