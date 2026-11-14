#!/usr/bin/env python3
"""T084 requirement-matrix row updates (P1-09, P1-10, P3-03, P3-13, P3-14,
P3-15, P4-04, P4-06, P4-07)."""
import csv
import io
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MATRIX = os.path.join(REPO, "research", "result", "stage-readiness",
                      "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv")
# columns: requirement_id,phase,behavior,required_original_fact,original_exactness,
# claim_ids,evidence_ids,evidence_grade_and_type,13map_actual_coverage,
# single_sample_risk,conflicting_reports,gap_ids,unproven,impact,
# implementation_feasibility,blocks_acceptance,can_static_continue_or_runtime,
# product_alternative_authorization,readiness,minimum_next_work


def to_line(fields):
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n", quoting=csv.QUOTE_MINIMAL).writerow(fields)
    return buf.getvalue().rstrip("\n")


def patch(row, **kw):
    idx = {"requirement_id": 0, "claim_ids": 5, "evidence_ids": 6,
           "evidence_grade_and_type": 7, "gap_ids": 11, "unproven": 12,
           "can_static_continue_or_runtime": 16, "readiness": 18,
           "minimum_next_work": 19, "conflicting_reports": 10}
    for k, v in kw.items():
        if k.startswith("+"):
            col = k[1:]
            row[idx[col]] = (row[idx[col]] + ";" + v) if row[idx[col]] not in ("", "—") else v
        else:
            row[idx[k]] = v
    return row


UPDATES = {
    # P1-09: slot25 candidate set now enumerated (both rejected statically)
    "P1-09": dict(claim_ids="C-007;C-017;C-022;C-053;C-074;C-075;C-077;C-082",
                  evidence_ids="EV-03;EV-18;EV-19;EV-34;EV-59;EV-60;EV-72",
                  unproven="[eax+0xB4] 目标类仍需运行时（G24 dump 单值可决；两个静态 slot25 候选 0x50403FBE/0x50404E85 均不满足出参约束 t084 C-082；[ebp-0x20] 裁定与 slot45 key 参数已静态闭合，捕获规格固化于 T082-R13 §4）",
                  minimum_next_work="bp 0x666F77 dump ESI/[ESI]/[EBP-0x10]（三候选判定：trivial-setter / boolean-getter / runtime put-with-out）；静态候选集已穷尽（C-082）"),
    # P1-10: stack-package four callees read (negative)
    "P1-10": dict(claim_ids="C-003;C-014;C-019;C-053;C-074;C-075;C-085",
                  evidence_ids="EV-01;EV-15;EV-16;EV-19;EV-34;EV-59;EV-71",
                  unproven="比较器主体/等键策略仍缺（stack-package 四个 callee 已读尽且无比较逻辑 t084 C-085；最终接收者=运行时 slot25 端点，与 G24/G27 同源）",
                  minimum_next_work="STATIC 容器遍历侧（Canvas Draw 调用）可选；最终接收者随 G24 单值 dump"),
    # P3-03: fh loader write-side done
    "P3-03": dict(claim_ids="C-029;C-058;C-067;C-068;C-080",
                  evidence_ids="EV-22;EV-39;EV-53;EV-62;EV-67",
                  unproven="「未解」限界：换段/吸附主链与 fh loader 写侧均已闭合（C-067/C-068 + t084 C-080 写侧直证）；slot3 变体差异仍未解（不阻塞实现，登记 G40）",
                  minimum_next_work="STATIC 仅余 slot3 变体差异（fh loader 写侧已恢复 t084：C-080/EV-67 直证 0xA4F4B6/0xA4F54A 字段映射）；ENGINEERING 13图换段测试"),
    # P3-13: fork located + l census -> RE-READY
    "P3-13": dict(claim_ids="C-029;C-057;C-069;C-071;C-078;C-079",
                  evidence_ids="EV-22;EV-38;EV-55;EV-56;EV-64;EV-65;EV-66",
                  evidence_grade_and_type="A（0xA4FC6F 全函数 + 抓绳键位/命中框 + t084 slot13 符号分叉与绳 loader 写侧指令级，C-078/C-079）",
                  unproven="无静态残项（类型分叉=记录 id 符号约定：正=foothold 经 0x517DA8、负=rope 经 0x9BCC9A；l(rope+4) 无任何静态消费者；uf 消费已证 C-056/C-072）",
                  can_static_continue_or_runtime="STATIC 无残项；运行时 corroboration 可选",
                  minimum_next_work="无静态残项（分叉与 l/uf 消费已闭合 t084 C-078/C-079）；ENGINEERING 按 C-069/C-071/C-078 编码（绳 id 取负索引，1 基）"),
    # P3-14: hint runtime dump no longer needed
    "P3-14": dict(claim_ids="C-029;C-056;C-070;C-072;C-080",
                  evidence_ids="EV-22;EV-37;EV-54;EV-58;EV-67",
                  unproven="「未解」限界：爬绳积分/端点/离绳安装器闭合（C-056/C-070/C-072）；t084 起 [M+0x130/0x134] hint 语义已静态闭合为 (layer,platform)/(page,0)（C-080）——原登记的绳记录 hint 运行时 dump 不再需要",
                  minimum_next_work="无静态残项、无必须运行时项（hint 张力已静态消解 t084）；ENGINEERING 爬绳编码（ladder/rope 分叉另见 P3-13）"),
    # P3-15: stand-up chain relocated
    "P3-15": dict(claim_ids="C-057;C-066;C-081",
                  evidence_ids="EV-38;EV-52;EV-69",
                  unproven="座位起身链已定位=0x965A09（user vt slot14；0x53E95D(M,0xB) 通知；旗标抑制）——0x6A0ADF 已反证为解密助手（corrected t084 by C-081）；残项=slot14 flag=0 调用点枚举（状态驱动起身触发）",
                  minimum_next_work="STATIC 枚举 [user-vt+0x38] flag=0 调用点（0x6A0ADF 起身链指针已由 C-081 反证并移除；写链已证 EV-38，链体 EV-69）"),
    # P4-04: 0x81 collision note
    "P4-04": dict(unproven="opcode 0x81→处理器的静态字节绑定不存在（t084 C-083：注册为上下文相关——0x77E6F3 通道上下文 0x81/0x82/0x83 碰撞反证静态绑定；运行时注册数据可关闭）；Foothold 吸附/完整状态重置/Camera 刷新分别保留在 P4-05/06/07",
                  minimum_next_work="子行为已闭合。可选：0x81 运行时注册数据捕获（静态字节绑定已被碰撞反证）；Foothold 重绑/Camera/完整重置见 P4-05/06/07"),
    # P4-06: upper-layer enumeration done
    "P4-06": dict(claim_ids="C-054;C-055;C-061;C-062;C-063;C-064;C-065;C-083;C-084",
                  evidence_ids="EV-35;EV-36;EV-45;EV-46;EV-47;EV-48;EV-50;EV-51;EV-70;EV-73",
                  unproven="Camera 更新顺序（G10 关联，运行时）；上层枚举已完成 t084（C-084/EV-73：scene-manager 33-vtable slot 结构、slot2 加载顺序、slot12/14 每帧分发、跨图 load→attach→write 顺序）",
                  minimum_next_work="上层与场景初始化链已闭合（t084 C-084/EV-73）；残项=Camera 刷新时机（P4-07/G10 运行时 dump）"),
    # P4-07: camera-rect consumer pointer
    "P4-07": dict(minimum_next_work="STATIC 先查0x963C7D/0x954B58时间门和Camera写点;再批准产品数字（t084 增量：slot15 0x53471A 已证为相机矩形消费者，args=camX/camY，生产者未定位 C-084）"),
}


def main():
    lines = open(MATRIX, encoding="utf-8").read().splitlines()
    header = lines[0]
    out = [header]
    for ln in lines[1:]:
        row = next(csv.reader([ln]))
        rid = row[0]
        if rid in UPDATES:
            row = patch(row, **UPDATES[rid])
            out.append(to_line(row))
        else:
            out.append(ln)
    open(MATRIX, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    rows = list(csv.reader(open(MATRIX, encoding="utf-8")))
    print("matrix rows:", len(rows), "cols:", sorted(set(len(r) for r in rows)))


if __name__ == "__main__":
    main()
