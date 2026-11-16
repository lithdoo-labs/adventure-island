"""T090 matrix update: refresh the G10/G36/G37/G39-referencing rows with the
new claims/evidence (C-116..C-119, EV-104..EV-107). Idempotent."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MX = REPO / "research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv"

rows = list(csv.DictReader(open(MX, encoding="utf-8")))
if "C-116" in open(MX, encoding="utf-8").read():
    print("already applied")
    raise SystemExit

for r in rows:
    gaps = r["gap_ids"]
    # P2-05/P2-06/P4-07 (camera rows)
    if r["requirement_id"] in ("P2-05", "P2-06", "P4-07"):
        if "C-109" in r["claim_ids"] and "C-116" not in r["claim_ids"]:
            r["claim_ids"] += ";C-116;C-119"
        if "EV-102" in r["evidence_ids"] and "EV-106" not in r["evidence_ids"]:
            r["evidence_ids"] += ";EV-106;EV-107"
        if r["requirement_id"] == "P2-05":
            r["evidence_grade_and_type"] += (
                "；t090（C-116/EV-106）：滤波消费链闭合——滤波提交在共享相机上创建动画 wrapper，"
                "X/Y getter 经 wrapper 解析器（内联泵引擎、返回滤波坐标 w+0x70/+0x74），立即 Set 变为"
                "增量存储（0x51407A34）保持滤波位移；scene-cull slot15 与 world→screen 在武装状态下"
                "结构性地消费滤波坐标；EXE +0xA4 查询普查=0；C-119：10 调用者精化（8 个 arg3=0，"
                "2 个可传对象）")
            r["unproven"] += (
                "；t090 收窄：[[arg3]+0x14] 写入者普查与 arg3↔[user+0xF28] 关系（F28 直接写者仅 "
                "ctor-zero）；E2/E3 泵相位与 wrapper 持续性（静态不可判定部分需产品契约）")
        if r["requirement_id"] == "P2-06":
            r["evidence_grade_and_type"] += (
                "；t090（C-116）：28 像素死区滤波的输出被证明进入相机 getter 消费路径（wrapper "
                "解析器内联泵引擎）——deadzone/平滑的原始机制完整闭环")
    # G36/G39/G37 rows: P0-05/06/07/10/11/12/P1-xx — patch those that cite the
    # G36/G39/G37 residuals we advanced
    if "G36" in gaps and "C-118" not in (r["claim_ids"] + r["evidence_ids"]):
        r["claim_ids"] += ";C-118"
        r["evidence_ids"] += ";EV-106"
        r["evidence_grade_and_type"] += "；t090（C-118/EV-106）：+0x9C (0x514086B3) 完整解码=矩形范围成员附加；t090（T090-G36-13MAP-LAYOUT.csv）：13 图 387 条 back 记录原始 WZ 布局表+C-051 跨度+C-111 视差比"
        r["unproven"] += "；t090 边界：首帧绝对屏幕偏移静态不可证（attach 基线为运行时快照——WP2-B 文档）"
    if "G39" in gaps and "C-117" not in (r["claim_ids"] + r["evidence_ids"]):
        r["claim_ids"] += ";C-117"
        r["evidence_ids"] += ";EV-104;EV-105"
        r["evidence_grade_and_type"] += (
            "；t090（C-117/EV-104/EV-105）：原始 Map.wz 帧普查（4,347 帧；2,450 显式 delay；35 种"
            "值；225/329 多帧资源依赖默认）；animationScale 默认=1000；36 站点默认矩阵全表"
            "（120×18/150×2/60×2/180×3/1000×2/寄存器×9，portal 平面读取默认=0）；数值时间线模型")
        r["unproven"] += (
            "；t090 残项：portal 家族逐帧默认值未字节定位（960/480/840/360 ms 保持默认基估计）；"
            "8 个寄存器默认变量未定")
    if "G37" in gaps and "EV-104" not in r["evidence_ids"]:
        r["evidence_ids"] += ";EV-104"
        r["evidence_grade_and_type"] += "；t090：obj 层帧普查并入 G39 资源闭合（3,540 obj 帧、2,114 显式 delay；平铺器 120 默认覆盖 flow 子帧）"

with open(MX, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
print("matrix rows updated")
