#!/usr/bin/env python3
"""T085: append round notes to P0-P4-READINESS-REPORT.md and
CRITICAL-REVERSE-GAPS.md (historical notes are append-only, never rewritten)."""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

RR = "research/result/stage-readiness/P0-P4-READINESS-REPORT.md"
CG = "research/result/stage-readiness/CRITICAL-REVERSE-GAPS.md"

rr_note = """
> **t085 轮结论（首帧静态取证轮）**：以 T084.1 后基线 `16e8bd5b5` 为起点，全轮纯静态（未运行原版客户端）。**G38 关闭（CLOSED-STATIC）**——`0x9BE703` 完整函数体（0x9BE703-0x9BF13F，ret 0xC，883 指令）恢复：同图传送仅清 `[M+0x110]`，下一 tick T1 `0x9BCD6C` 无 ctx 路径（快照四加密对 → `0x9BDF18` 空中积分 → slot4 mode=1 → 扫掠盒查询 → slot5 安装/垂段无安装路径）；跨图=新鲜 T7 对象（构造清零 13 个 ctx 字段）→ T7 tick 委托同一 T1 体（落地走 T7 slot5/6 变体）；**`[M+0x120]` 全镜像仅清零无置位**（含 and/pop/SIB/rep-movs 编码普查）→ 钉扎分支族静态死；**FSDB 13 图 2283 条 foothold 中 x1>x2=0、垂直=676** → m1>0 落地路径覆盖全部非垂直段、垂直段走平台门控无安装路径，本地玩家 state 取值恒 0（getter 为 `xor eax,eax; ret` 桩）→ state==7 分支对本地玩家为死支（C-088/C-089，EV-77/78）。**G41 关闭**——user slot14 调用点全枚举（30 处 `call [reg+0x38]`）：flag=0 恰两处：`0x965937`（opcode 0xCF STAND 子命令，RNG 门 0x416DE8）与 `0x948AB4`（`0x948AA2`：由跨图到达 `0x9509D7` 与移动包生成 `0x98D0C2` 触发，RNG 门控）；SIT 子命令含座位占用盒 x±0xA/y±0x1E 与 `0x9D35F2` 座位传送；**上下键轴 = DOWN(+1)−UP(−1)，同按抵消为零 → 双向抓绳均不触发**（C-090/C-091，EV-79）。**G34 关闭**——H1 换算假说否决：90/30 仅两个相遇点且均非换算（T3 slot9 `0x9C3D1D` 覆盖返回 90；T4 slot9 `0x9C9CF7` 步长累加器阈值 90），其余域分离（C-094，EV-81）。**G40 保持 PARTIAL-STATIC（范围收窄）**——8 表槽位变体全图（slot4 变体 T3/T6、slot9 变体、T7 slot5/6 覆盖）、slot3 变体全差分（T3 游泳/T5 平台边界 rand%2，均委托 0x9BF1FA）、`[M+0x190]` 步长表安装已证、`[M+0x198]` 鞋对象有界无置位普查（C-089/C-092/C-093，EV-80）；余留=T3/T6 slot4 体、walk/swim/land 全序、鞋安装者。**P3-15 与 P4-06 升 RE-READY**（各自静态残项闭合；Camera 时机仍归 P4-07/G10）。Claim/Evidence/Gap = **94 / 81 / 41**（CLOSED-STATIC 18）。独立盲审 Reviewer（真实 Sub-Agent，独立脚本/临时目录/哈希校验，先于主 Agent 结论启动）全轮平行取证并复核，其两项新发现（`0x9C3D1D` 覆盖、`0x97FCBA` 路由 thunk）经字节级复核后并入；对抗复核与最终裁决见 `forensics/T085-REVIEWER-BLIND.md` 与 `forensics/T0851-REVIEWER-REPORT.md`。阶段总判定维持 **NOT STAGE-READY**（G10 Camera、G24 运行时身份、0x81 注册仍未闭合）。
"""

cg_note = """
- **t085 轮（首帧静态取证）**：t084 列出的「静态最大剩余」三项已全部闭合——`0x9BE703` 完整体+首帧 ctx 重建链（G38 关闭，C-088）、slot3 变体差异（T3 游泳预处理器/T5 平台边界 rand%2，C-092）、user vt slot14 调用者枚举（flag=0 恰两处全链闭合，G41 关闭，C-090/C-091）；G34 换算假说否决（C-094）。新登记的静态剩余：T3 slot4 `0x9C6028`/T6 slot4 `0x9D06D4` 函数体、`[M+0x198]` 鞋对象安装者（装备管线普查）、`0x9BD757` 行走积分族 walk/swim/land 全序（G40 范围收窄）。运行时清单不变（G10 Camera 每帧写入者、G24 slot25 对象身份、`0x81` 注册数据）。
"""

text = open(RR, encoding="utf-8", newline="").read()
if "t085 轮结论（首帧静态取证轮）" in text:
    print("readiness report: t085 note already present (skip)")
else:
    import re
    m = list(re.finditer(r"^> \*\*t084\.1 .*?(?=^\S)", text, re.M | re.S))
    if m:
        insert_at = m[-1].end()
        text = text[:insert_at] + rr_note.lstrip("\n") + "\n" + text[insert_at:]
        open(RR, "w", encoding="utf-8", newline="").write(text)
        print("readiness report: t085 note appended")
    else:
        print("readiness report: ANCHOR NOT FOUND", file=sys.stderr)
        sys.exit(1)

text = open(CG, encoding="utf-8", newline="").read()
if "t085 轮（首帧静态取证）" not in text:
    lines = text.splitlines(keepends=True)
    idx = None
    for i, ln in enumerate(lines):
        if "优先级更新（t084" in ln:
            idx = i
    if idx is None:
        print("critical gaps: ANCHOR NOT FOUND", file=sys.stderr)
        sys.exit(1)
    lines.insert(idx + 1, cg_note.lstrip("\n"))
    open(CG, "w", encoding="utf-8", newline="").write("".join(lines))
    print("critical gaps: t085 note appended")
