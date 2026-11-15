#!/usr/bin/env python3
"""T086.1 — sync derived views: GAP-REGISTER.md rows, P0-P4 matrix notes,
P0-P4 readiness report (radix line + T086.1 block), T086 report erratum."""
import csv
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding="utf-8")
SOT = REPO / "research/source-of-truth"
RR = REPO / "research/result"

# ------------------------------------------------ 1. GAP-REGISTER.md rows
VIEW = RR / "REVERSE-ENGINEERING-GAP-REGISTER.md"
GAPS = SOT / "gaps.csv"
by_id = {r["gap_id"]: r for r in csv.DictReader(GAPS.open(newline="", encoding="utf-8"))}
TARGETS = ["G08", "G09", "G10", "G17"]
text = VIEW.open(encoding="utf-8", newline="").read()
lines = text.splitlines(keepends=True)
out, replaced = [], 0
for line in lines:
    s = line.strip()
    done = False
    if s.startswith("| G"):
        parts = [p.strip() for p in s.strip("|").split("|")]
        if parts and parts[0] in TARGETS and len(parts) >= 4:
            g = by_id[parts[0]]
            scope = g["verified_scope"]
            if len(scope) > 900:
                scope = scope[:880] + "…"
            new = f"| {parts[0]} | {parts[1]} | {parts[2]} | {g['status']} | {scope} |\n"
            out.append(new)
            replaced += 1
            done = True
    if not done:
        out.append(line)
VIEW.write_text("".join(out), encoding="utf-8", newline="")
print(f"GAP-REGISTER.md: updated {replaced}/{len(TARGETS)} rows")

# ------------------------------------------------ 2. matrix notes
MATRIX = RR / "stage-readiness" / "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv"
rows = list(csv.reader(MATRIX.open(newline="", encoding="utf-8")))
header, body = rows[0], rows[1:]
idx = {c: i for i, c in enumerate(header)}


def set_row(rid, updates):
    for r in body:
        if r[idx["requirement_id"]] == rid:
            for col, val in updates.items():
                r[idx[col]] = val
            return True
    raise SystemExit(f"matrix row {rid} missing")


set_row("P2-05", {
    "unproven": ("原版跟随函数及更新者未知；t086.1：消费链与 [0xBDD838] 单例读/写/夹取结构已静态恢复"
                 "（EV-88/C-102，写漏斗仅两处且均为 UI 网格模板）；[fieldctx+0xD4] 身份与其写者待查；"
                 "现阶段设计§4.2明确产品中心跟随方案"),
    "minimum_next_work": ("STATIC 追 [fieldctx+0xD4] 写者与 [0xBDD838] 类身份（field-create 家族 census），"
                          "后备 RUNTIME 轨迹"),
})
set_row("P2-06", {
    "unproven": ("原版deadzone/平滑未知；t086.1 已证 [0xBDD838] 写路径带 [0,800]x[0,600] 硬夹取（EV-88）；"
                 "设计草案§4.2/§10已有居中跟随、VR边界夹取、小图居中、无deadzone的具体产品可编码策略，"
                 "签署和边界测试未完成"),
})
set_row("P4-07", {
    "minimum_next_work": ("冷却已闭合（C-054/EV-35）；Camera 静态结构链 t086.1 已推进（C-102/EV-88："
                          "[0xBDD838] 单例+0x9EC924/0x9EC989 包装+800x600 夹取写者，写漏斗=两处 UI 网格模板）；"
                          "剩余：[fieldctx+0xD4]（世界相机候选）身份/写者 census 或运行时捕获；跨图门输入抑制"
                          "仍为静态待核项"),
    "can_static_continue_or_runtime": ("STATIC 继续：+0xD4 写者 census 与 [0xBDD838] 创建点追踪；冷却机制已闭合；"
                                       "跨图门输入抑制为剩余静态待核项"),
})
with MATRIX.open("w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([header] + body)
print("matrix: P2-05/P2-06/P4-07 updated")

# ------------------------------------------------ 3. readiness report
REPORT = RR / "stage-readiness" / "P0-P4-READINESS-REPORT.md"
rt = REPORT.read_text(encoding="utf-8")
RADIX_OLD = "avatar 世界键公式机器码恢复：*(layer*3000−zM) − 2^31 + 29990 + (flag≠0?7:2)\\，类型基族 −2^31+{29983..29999} 全枚举（C-099）"
RADIX_NEW = ("avatar 世界键公式机器码恢复：*(layer*3000−zM) − 2^30 + 29990 + (flag≠0?7:2)\\，类型基族 "
             "−2^30+{29983..29999} 全枚举（C-099；t086.1 勘误：T086 原文误写 2^31，0x40000000=2^30，"
             "数值与字节编码不变）")
if RADIX_OLD in rt:
    rt = rt.replace(RADIX_OLD, RADIX_NEW)
    print("readiness report: radix line corrected")
else:
    print("readiness report: radix line pattern not found — checking variant")
    assert "− 2^31 + 29990" in rt or "-2^31" in rt or "2^30" in rt, "cannot locate radix line"

BLOCK = """

---

## T086.1 轮补充（证据一致性修复与 Camera 纯静态深挖）

以 T086 后基线 `a86e76e1` 为起点。**勘误与新增**：

1. **G08 基数勘误**：T086 将排序键基数在文字层面误写为 `−2^31`；机器码常量为 `−0x40000000 = −2^30`（0x40000000=2^30）。锚点测试 L0/G0/flag0=**-1073711832**、flag1=**-1073711827**（`forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt`，C-099/G08/G09/EV-85 同步修正；全部数值与字节编码不变）。
2. **G17 相对属性裁定**：本仓 `server079.jar` 的 `ExternalCodeTableGetter.getValue` 字节码**支持**两字段相对赋值（基=枚举当前值，=def(-2) 时递归解析 properties）；`SHOW_ITEM_GAIN_INCHAT`（send 声明序 38，0xD0）先于 `DOJO_WARP_UP`（39）→ **DOJO_WARP_UP=0x00D1 可静态推导**，T086 reviewer 的"损坏行"判断撤回（C-095/EV-83 注记修正）。同时发现 0xA10CE3 开关的任务44命名空间与 recvops 对齐（61/62）而非 sendops（0/62），35 个已处理 id 在 sendops 中不存在 → T086 对 5 个 send 侧冲突名的"客户端裁定"撤回，15 项公开服分歧全部回到 UNRESOLVED-VERSION-AUTHORITY（报告级标签）。
3. **EV-82～EV-87 哈希跨平台规范化**：T086 生成器在 Windows 默认文本模式下写出 CRLF，台账绑定了 CRLF 字节；本仓 blob 为 LF。T086.1 采用**规范字节哈希**（文本 LF 规范化 / 二进制原始字节，等同 git blob 内容），六行重基线（旧→新全量记录见 `forensics/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv`），Validator 17a 改用同一规范（`research/scripts/evidence_canonical.py`）；全量审计 87 行，其余 81 行无需变化（58 二进制 + 19 LF 文本 + 3 离盘 + 1 复合）。
4. **G10 结构链推进（C-102/EV-88，G10 → PARTIAL-STATIC）**：slot15 参数消费链（0x53471A→0x953B3D/0x9535F1，含用户持久字段 +0x2ED4/+0x2ED8）；`[0xBDD838]` 屏幕位置单例（+0x938/+0x93C，门 +0xC）读 0x5CABE1/写 0x5CB0E0（**硬夹取 [0,800]×[0,600]**，C-027 的 800×600 相关性升至指令级）；fieldctx 包装 0x9EC924/0x9EC989（读加/写减 `[fieldctx+0xD4]` slot4/5 偏移）；写漏斗**仅两处直接生产者**（0x4BEDE7/0x5F1C7D，均为 UI 网格模板）→ 当前证据下 `[0xBDD838]` 更像 UI/窗口放置锚而非世界跟随相机；世界相机候选 = `[fieldctx+0xD4]`（slot15 直接读取），其类与写者为下一步静态目标。C-101"持久字段仅 VR 折叠"措辞已修正。

Claim/Evidence/Gap = **102 / 88 / 41**（G10 OPEN-RUNTIME→PARTIAL-STATIC）。项目维持 **NOT STAGE-READY**。
"""
if "T086.1 轮补充" not in rt:
    rt = rt.rstrip("\n") + BLOCK + "\n"
    REPORT.write_text(rt, encoding="utf-8", newline="")
    print("readiness report: T086.1 block appended")
else:
    print("readiness report: T086.1 block already present")

# ------------------------------------------------ 4. T086 report erratum
T86 = RR / "stage-readiness" / "T086-STATIC-GAP-CLOSURE-REPORT.md"
t86 = T86.read_text(encoding="utf-8")
ERR = """

---

## 11. T086.1 勘误附录（本节由 T086.1 轮追加，原文以上未改动）

1. **§3/摘要 G08 基数**：本文所有 `−2^31` 均应为 `−2^30`（0x40000000 = 2^30 = 1073741824）。机器码、数值、键空间结论不变；锚点值 L0/G0/flag0=-1073711832、flag1=-1073711827。独立复核：`forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt`。
2. **§8 修正项 2 撤回**：`DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1` 并非损坏行 —— 本仓 jar 的 `ExternalCodeTableGetter.getValue` 字节码支持两字段相对赋值（基取枚举当前值，=def(-2) 时递归查 properties），且 SHOW_ITEM_GAIN_INCHAT（声明序 38，0xD0）先于 DOJO_WARP_UP（39），故 0x00D1 可静态推导。C-095 的注记已在 T086.1 改写。
3. **§1.2/§1.3 客户端裁定范围收窄**：0xA10CE3 开关的 task44 命名与 recvops（C2S 数值空间）对齐 61/62、与 sendops 对齐 0/62，且 35 个被处理 id 在 sendops 中不存在 —— "92 个 S2C opcode 数值获得绑定"的解释不成立；对 5 个 send 侧冲突名（ENGAGE_REQUEST/ENGAGE_RESULT/FAIRY_PEND_MSG/DATA_CRC_CHECK_FAILED/BBS_OPERATION）的客户端裁定撤回（G17 残项更新）。
4. **§5.4 措辞修正**："scene 持久字段仅载入期 VR 折叠边界"过度陈述 —— slot15 直接读取持久成员 `[fieldctx+0xD4]`（slot4/5），且存在 `[0xBDD838]` 屏幕位置单例（详见 T086.1 C-102/EV-88）；"0 直接调用者"对 0x53471A 成立，但家族备用入口 0x5348C5 有唯一直接调用者 0x9EDA8B。
5. **EV-82～EV-87 哈希**：本报告第 7 节记录的六条 Evidence SHA-256 为 CRLF 工作树字节哈希；T086.1 已按规范字节（LF 文本/原始二进制）重基线，旧→新映射见 `forensics/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv`。
"""
if "T086.1 勘误附录" not in t86:
    t86 = t86.rstrip("\n") + ERR + "\n"
    T86.write_text(t86, encoding="utf-8", newline="")
    print("T086 report: erratum appended")
else:
    print("T086 report: erratum already present")
