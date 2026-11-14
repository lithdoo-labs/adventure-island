#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t084.1 round-3 residuals: bounded phrasing in P4-07 can_static / G10 blocker /
report §6; EV-75 hash refresh after the 36-entry correction."""
import csv, io, os, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
REPO = r"C:\Users\lithd\Documents\GitHub\adventure-island"
SOT = os.path.join(REPO, 'research', 'source-of-truth')


def rewrite(path, mutator):
    rows = list(csv.reader(open(path, encoding='utf-8')))
    header, body = rows[0], rows[1:]
    body2 = mutator(header, body)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    w.writerows(body2 if body2 is not None else body)
    open(path, 'w', encoding='utf-8', newline='').write(buf.getvalue())


# regenerate EV-75 first to get its new hash
os.system('python "{}"'.format(os.path.join(REPO, 'research', 'scripts', 't0841_dump_evidence.py')))
sha75 = hashlib.sha256(open(os.path.join(
    REPO, 'research/result/stage-readiness/forensics/T0841-EV75-IID-IDENTITY-CHAIN.txt'),
    'rb').read()).hexdigest()
print('new EV-75 sha256:', sha75)


def fix_evidence(header, rows):
    for r in rows:
        if r[0] == 'EV-75':
            r[2] = sha75
    return rows


rewrite(os.path.join(SOT, 'evidence.csv'), fix_evidence)


def fix_gaps(header, rows):
    for r in rows:
        if r[0] == 'G10':
            r[6] = r[6].replace(
                "follow writes not found statically (re-confirmed: no post-load writer of scene+0xF0..0xFC exists)",
                "follow writes not found in the examined static censuses (re-confirmed t084.1: no "
                "post-load writer of scene+0xF0..0xFC found in the examined EXE-image/Gr2D-side "
                "censuses - bounded negative, not an unbounded existence claim)")
    return rows


rewrite(os.path.join(SOT, 'gaps.csv'), fix_gaps)


def fix_matrix(header, rows):
    idx = {c: i for i, c in enumerate(header)}
    for r in rows[1:]:
        if r[0] == 'P4-07':
            r[idx['can_static_continue_or_runtime']] = (
                "STATIC Camera 写点在已检查的 EXE 镜像普查中未发现（C-028/C-084 有界负结论，非全镜像断言）；"
                "冷却机制已闭合（C-054/EV-35）；跨图门输入抑制为剩余静态待核项")
    return rows


rewrite(os.path.join(REPO, 'research', 'result', 'stage-readiness',
                     'P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv'), fix_matrix)
print('round-3 CSV fixes done')

# report §6 + §2.4 fixes
p = os.path.join(REPO, 'research', 'result', 'stage-readiness',
                 'T084-1-SLOT25-SCOPE-RECONCILIATION.md')
src = open(p, encoding='utf-8').read()
src = src.replace(
    "Camera 写点 EXE 静态范围已穷尽（C-028/C-084 负结论）→ 下一步 G10 运行时捕获",
    "Camera 写点在已检查的 EXE 镜像普查中未发现（C-028/C-084 有界负结论）→ 下一步 G10 运行时捕获")
src = src.replace(
    "EXE 镜像静态范围已穷尽（C-028/C-084 负结论，t084.1 复核维持）；Gr2D 侧相机矩形仅作为 slot15 **消费者**参数进入（C-084），不存在 Gr2D 侧 scene 字段生产者可搜",
    "已检查的 EXE 镜像普查中未发现相机写点（C-028/C-084 有界负结论，t084.1 复核维持，非全镜像断言）；已检查的 Gr2D 路径中相机矩形仅作为 slot15 **消费者**参数进入（C-084），未发现 Gr2D 侧 scene 字段生产者")
src = src.replace(
    "**39-entry** 长表：QI `0x50401522`…slot3=`0x504030D3`…slot25=`0x5040418C`@`0x5042D288`）、`[obj+0x14]=0x5042D210`（**5-entry** thunk 表：QI/AddRef/Release 以 `sub [esp+4],4` 调整后跳 inner 三件套，再 slot3=`0x50404860`、slot4=`0x50404CB2`）、`[obj+0x18]=owner`；`[obj+4]=0`。**3+5+39=47** 个连续代码 dword（`0x5042D204..0x5042D2BC`），NULL 终止于 `0x5042D2C0`",
    "**36-entry** 长表 `0x5042D224..0x5042D2B3`：QI `0x50401522`…slot3=`0x504030D3`…slot25=`0x5040418C`@`0x5042D288`）、`[obj+0x14]=0x5042D210`（**5-entry** thunk 表：QI/AddRef/Release 以 `sub [esp+4],4` 调整后跳 inner 三件套，再 slot3=`0x50404860`、slot4=`0x50404CB2`）、`[obj+0x18]=owner`；`[obj+4]=0`；另有 **3-entry 拆卸表** `0x5042D2B4`（析构 `0x504018CD` 执行 `mov [esi],0x5042D2B4`）。**3+5+36+3=47** 个连续代码 dword（`0x5042D204..0x5042D2BC`），NULL 终止于 `0x5042D2C0`")
open(p, 'w', encoding='utf-8', newline='').write(src)
print('report round-3 fixes done')
