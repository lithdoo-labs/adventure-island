#!/usr/bin/env python3
"""T085: sync REVERSE-ENGINEERING-GAP-REGISTER.md rows G34/G38/G40/G41 with the
updated source-of-truth gaps.csv (the generator only refreshes the stats block)."""
import sys

PATH = "research/result/REVERSE-ENGINEERING-GAP-REGISTER.md"

REPL = {
 "| G34 | Camera | 0x5A↔0x1E 换算关系 | OPEN-STATIC | 0x1E 已证（C-030）；0x5A 关系无验证站点 |":
 "| G34 | Camera | 0x5A↔0x1E 换算关系 | CLOSED-STATIC | 0x1E 已证（C-030）；t085: H1 换算假说被两轮独立立即数普查否决——90/30 仅有两个相遇点且均非换算（T3 slot9 0x9C3D1D 覆盖返回 90；T4 slot9 0x9C9CF7 步长累加器阈值 90），其余域完全分离（C-094/EV-81） |",
 "| G38 | Map/Portal | 同图/跨图精确到达与状态转移 | PARTIAL-STATIC | t080: 同图链端到端（C-054 含 0x78/0x258 冷却、Y−10、加密落点）；跨图（C-055 含边界夹取/速度清零）；Foothold 重绑体与 opcode 注册余留 |":
 "| G38 | Map/Portal | 同图/跨图精确到达与状态转移 | CLOSED-STATIC | t080/t082/t084 链（C-054/055/061..066/083）；t085: 首帧重建闭合——0x9BE703 全函数体+首 tick 链（同图 T1 无 ctx 路径 mode=1、跨图新鲜 T7 委托 T1）、[M+0x120] 仅清零域→钉扎分支死、FSDB x1>x2=0→m1>0 落地路径覆盖全部非垂直段（C-088/C-089/EV-77/78）；Camera 时机归 G10、0x81 注册归 C-066 条款 |",
 "| G40 | Movement | 完整移动子分支与 decrypt 字段归属 | PARTIAL-STATIC | T1/EV-23/26；t080: fh 邻段 +0x4C/+0x50、0xA4F6F1 半宽为调用方参数（C-058）、dt 为调用方供给 |":
 "| G40 | Movement | 完整移动子分支与 decrypt 字段归属 | PARTIAL-STATIC | T1/EV-23/26；C-058/067/068/076/078/080；t085: 8 表槽位变体全图（slot4 变体 T3/T6、slot9 变体 T3/T4、T7 slot5/6 覆盖 C-089）、slot3 变体全差分（T3 游泳预处理器/T5 平台边界 rand%2 跳过，均委托 0x9BF1FA C-092）、[M+0x190] 步长表安装已证、[M+0x198] 鞋对象有界无置位普查（C-093）；余留=T3/T6 slot4 体、walk/swim/land 全序、鞋安装者 |",
 "| G41 | Movement | 抓绳/爬绳与座位全状态机 | PARTIAL-STATIC | t080: y+=3×键（3.0 常量）+端点夹取（C-056）；座位 user+0x2944 写链与 x±10/y±30（C-057）；抓绳体余留 |":
 "| G41 | Movement | 抓绳/爬绳与座位全状态机 | CLOSED-STATIC | t080..t084 全链（C-056/057/069..073/078/079/080/081）；t085: slot14 调用点枚举闭合——flag=0 恰两处（0x965937=opcode 0xCF STAND 子命令 RNG 门控；0x948AB4=到达/包生成 0x948AA2 RNG 门控）、SIT 子命令含座位盒 x±0xA/y±0x1E 与 0x9D35F2 座位传送、上下键轴仲裁=DOWN−UP 同按抵消为零（C-090/C-091/EV-79）；运行时佐证可选 |",
}

text = open(PATH, encoding="utf-8", newline="").read()
n = 0
for old, new in REPL.items():
    if old in text:
        text = text.replace(old, new)
        n += 1
    else:
        print(f"MISSING: {old[:60]}...", file=sys.stderr)
with open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(text)
print(f"replaced {n}/4 rows")
