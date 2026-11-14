#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t084.1 matrix update: P1-09 (slot25 resolution), P4-06/P4-07 (stale-field fixes)."""
import csv, io, os, sys
sys.stdout.reconfigure(encoding='utf-8')
REPO = r"C:\Users\lithd\Documents\GitHub\adventure-island"
PATH = os.path.join(REPO, 'research', 'result', 'stage-readiness',
                    'P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv')

rows = list(csv.reader(open(PATH, encoding='utf-8')))
header = rows[0]
idx = {c: i for i, c in enumerate(header)}

def setrow(rid, **kw):
    for r in rows[1:]:
        if r[0] == rid:
            for k, v in kw.items():
                r[idx[k]] = v
            return
    raise KeyError(rid)

# ---- P1-09: slot25 production resolution folded in ----
setrow('P1-09',
    claim_ids="C-007;C-017;C-022;C-053;C-074;C-075;C-077;C-082;C-086;C-087",
    evidence_ids="EV-03;EV-18;EV-19;EV-34;EV-59;EV-60;EV-72;EV-74;EV-75;EV-76",
    unproven=("[eax+0xB4] 目标类 = slot25 返回对象（0x42944A 取 [ebp-0x10]）仍需运行时（t084.1：生产 "
              "slot25=0x5040418C（inner vtable 0x5042D224，15 参数 ret 0x3C + VARIANT* 出参对象写，C-086）；"
              "[0xBE2788]=inner 接口指针为静态推导（PCOM PcCreateObject+QI intmap，C-087），运行时 dump "
              "现为确认命名预测而非三选一判定；出参/调用约定/[ebp-0x20] 已静态闭合）"),
    minimum_next_work=("bp 0x666F77 dump ESI/[ESI]/[EBP-0x10]（确认预测：[ESI] vtable 应为 0x5042D224 相对 "
                       "DLL 基址 0x2D224；并取 slot25 返回对象 [0] vtable 以定 slot45 目标类）；静态已闭合 "
                       "t084.1（C-086/C-087，EV-74/75/76）"),
    can_static_continue_or_runtime=("RUNTIME bp 0x666F77 单值 dump（确认静态预测，同时覆盖 G24）；"
                                    "静态残项无（t084.1 C-086/C-087）"),
)

# ---- P4-06: stale static-work field fixed ----
setrow('P4-06',
    can_static_continue_or_runtime=("STATIC 无残项（上层调用与场景初始化链已闭合 t084 C-084/EV-73，t084.1 "
                                    "复核维持）；残项=Camera 刷新时机（P4-07/G10 关联，运行时 dump；触发条件="
                                    "in-map [0xBDF54C] 族捕获与 slot15 caller 捕获，预期证据=scene+0xF0..0xFC "
                                    "每帧写入者身份与时机）"),
)

# ---- P4-07: stale minimum_next_work fixed ----
setrow('P4-07',
    minimum_next_work=("冷却已闭合（C-054/EV-35 含 0x963C7D 族时间门，t084.1 边界澄清）；Camera 写点 EXE "
                       "静态范围已穷尽（C-028/C-084 负结论）→ 下一步 G10 运行时捕获（触发：in-map "
                       "[0xBDF54C] 族 dump + slot15 caller 捕获；预期：相机矩形每帧生产者）或产品方案批准；"
                       "跨图门输入抑制仍为静态待核项；0x954B58/0x71B44D 命中框属 P4-01 残项（t084.1 归属澄清）"),
)

buf = io.StringIO()
w = csv.writer(buf, lineterminator='\n')
w.writerows(rows)
open(PATH, 'w', encoding='utf-8', newline='').write(buf.getvalue())
print("matrix updated: P1-09, P4-06, P4-07")
