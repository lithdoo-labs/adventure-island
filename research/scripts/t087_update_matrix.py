#!/usr/bin/env python3
"""T087 matrix updates: P2-01, P2-05, P2-06 camera rows."""
import csv

path = r"research\result\stage-readiness\P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))
hdr = rows[0]

UPD = {
    "P2-01": {
        "claim_ids": "C-028;C-103",
        "evidence_ids": "EV-21;EV-89;EV-90",
        "evidence_grade_and_type": ("A（t087 指令级：world→screen = world − camera 已静态恢复；camera=[fieldctx+0xD4]=共享 "
                                     "Shape2D#Vector2D，初值(-400,-300)；屏↔世界转换器 0x9EC924/0x9EC989；EV-89/EV-90）"),
        "unproven": ("原版 world-to-screen 已静态恢复（screen=world−camera；相机初值 (-400,-300)=世界原点居中；"
                     "camera:=point−(400,300) 写入公式及 7 个写入点）；剩余未知仅相机跟随节奏/deadzone（见 P2-05/P2-06）"),
        "readiness": "ORIGINAL-STATIC-PROVEN",
        "minimum_next_work": "（已静态闭合变换层）相机跟随节奏分析见 P2-05/P2-06",
    },
    "P2-05": {
        "claim_ids": "C-028;C-102;C-103;C-104",
        "evidence_ids": "EV-21;EV-88;EV-89;EV-90;EV-91",
        "evidence_grade_and_type": ("A（t087：相机对象身份=Shape2D#Vector2D、安装链、写入公式 camera:=point−(400,300)、"
                                    "7 写入点普查（含两个 field 世界坐标写入者 0x9E6D18/0x9F1ADF）；[0xBDD838]=输入/光标"
                                    "管理器（其位置为屏幕空间光标，且光标移动亦写相机）；EV-89/90/91）"),
        "unproven": ("原版谁写相机已静态定案（0x5CA91A 公式+7 写入点）；仍未知：两个 field 写入者的触发节奏/"
                     "门控（deadzone 若存在只能在其上游）；[scene+0x1CC] 内部对象安装者"),
        "can_static_continue_or_runtime": ("STATIC 追 0x9E6CA4/0x9F1ADF 父函数的调用链以定节奏；产品可按 T087 契约"
                                           "（§5 参数化 Camera 契约）实施"),
        "minimum_next_work": "解码 0x9E6CA4 记录循环与 0x9F1ADF 父函数的上游门控，固定触发节奏",
    },
    "P2-06": {
        "claim_ids": "C-028;C-103",
        "evidence_ids": "EV-21;EV-89;EV-90",
        "evidence_grade_and_type": ("A（t087：0x5CA91A 本体无条件居中（无 deadzone 常量）；相机初值 (-400,-300)；"
                                    "VR 界喂给 slot15 裁剪窗而非相机侧 clamp——deadzone/clamp 的负结论有界于已解码函数）"),
        "unproven": ("原版 deadzone/平滑：未在相机写入路径本体发现阈值/平滑常量（负结论有界于 0x5CA91A/0x5CB0E0/"
                     "0x5CB573 及其直接调用者）；若存在，只能藏在两个 field 写入者的上游门控；小地图边界相机 clamp 未证明"),
        "minimum_next_work": "STATIC 追 field 写入者上游（同 P2-05）；产品按 T087 §5 契约选择 deadzone 策略并标注产品替代",
    },
}

for r in rows[1:]:
    if r[0] in UPD:
        for k, v in UPD[r[0]].items():
            idx = hdr.index(k)
            r[idx] = v

with open(path, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(hdr)
    w.writerows(rows[1:])
print("matrix updated")
