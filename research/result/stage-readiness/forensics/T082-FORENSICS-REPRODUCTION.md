# T082 — 静态取证复现指南（本轮全部新证据）

## 原始输入（本轮重验哈希）

| 文件 | SHA-256 |
|---|---|
| `.work/task-036/game-image-unpacked.bin` | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` |
| `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` |

核验：`Get-FileHash -Algorithm SHA256 <path>` 或 `hashlib.sha256`。

## 映射规则（不变）

- EXE = 线性内存转储：`fileOffset = VA − 0x400000`。
- DLL = 常规 PE：ImageBase `0x50400000`，节表 RVA→偏移。

## 工具

新增参数化 CLI（本轮入库）：

```
python research/scripts/maple079_disasm_window.py \
  --binary .work/task-036/game-image-unpacked.bin \
  --sha256 d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718 \
  --image exe --va 0x53E95D --size 0x180 [--raw] [--out path]
```

DLL 侧用 `--image dll --va 0x5042D204`。脚本先核哈希再映射再反汇编（capstone 5.0.7）。

## 逐报告复现窗口

| 报告 | 关键窗口 |
|---|---|
| G38 | 0x53E95D–0x53EA0A（通知器全函数）；0x9C1113–0x9C11F8（头部 ebx/esi 与尾部）；0x9552F0–0x95539C（apply）；0x9BC602–0x9BC621；0x9BC622–0x9BC860（全函数：clamp/写槽/hint/rebind/尾部通知 0x6B8701/0x9BC825 后清 [M+0x150/0x154/0x190]）；0x9BC89F–0x9BC98F；0x9BC992–0x9BCA31；0x950900–0x950980（arg6/arg7 push 序列）；0x98CFB0–0x98D07D（[user+0x3C0] 写入者 + 0x9BC622 另一调用者）；0x953FA5–0x95419F + 调用扫描（0x6A05FF/0x6A0545 家族）；0x9571BF–0x9571D3（opcode 0xCF–0xEC switch）+ 表 0x95732E；0x97FCBA/0x97FCC9（thunk 链）；0x533EA4–0x533FF6 + vtable dword 0xB01414/0xB016B4/…/0xB02724（15 处）|
| G40 | 0x9BF1FA–0x9BF371（双向换段+默认吸附）；0x9BF371–0x9BF3CB（尾部）；0x9BF3D0–0x9BF422（越界分支，部分）；0x9BF9D3–0x9BFA1E（edge finder 头）；0x9C5F10–0x9C5F5C（调用者 walk tick）|
| G41 | 0xA4FC6F–0xA4FCF5（绳命中全函数）；调用者窗口 0x9D4440/0x9D4590/0x9D7D2C/0x9D7E78/0x9D7F60/0x9D7FEE；0x9BFB52–0x9BFC31（设段/设绳安装器）；0x9BFC35–0x9BFC7F（通知 helper 头）；0xA4F6F1 的 24 个 E8 调用点窗口（0x546803…0x9CC207，逐点前 0x28 字节）|
| R13/Gr2D | 0x666D70–0x666DF0（[ebp-0x20] 写①②）；0x666EC0–0x667000（0x427EB3 参数、slot45 调用、Release）；0x414A49 调用点 0x666F22–0x666F2D；DLL：节表、0x5042D204–0x5042D2C0（47 项）、0x50403EFC–0x50403F3F、间隙 dword 0x5042D1FC/0x5042D200 |

## 常量字节

| VA | double | 用途 |
|---|---|---|
| 0xAFECC0 | 0.0 | t 下限 / 正负判定 |
| 0xAFEC20 | 0.5 | 水平/垂直段判别阈值（(long)dx > 0.5） |
| 0xB00D60 | 0.499999999 | ftol 舍入（round-to-nearest 惯用法，配 +0.5） |
| 0xB00D68 | 3.0 | climb 步长（t080 已证，本轮复读确认） |

## 全像 E8 调用点扫描复现

对目标 VA 解 `rel32`（`va+5+rel==target`），本轮结果（主 Agent 实现；Reviewer 独立实现的交叉验证见 Review 报告）：

| target | 直接 E8 调用者数 |
|---|---|
| 0x53E95D | 27 |
| 0x9BC992 | 18 |
| 0xA4F6F1 | 24 | **[t083 note: total 24 confirmed by exhaustive re-scan; the t082 per-site classification summed to 23 (7 sites unlisted, 0x964074 misjudged undecodable, 4 "dynamic" sites carry constant 1) — corrected census 23×1 + 1×2 in `T083-A4F6F1-CALLSITE-AUDIT.txt` / EV-57]** |
| 0xA4FC6F | 6 |
| 0x9BF1FA | 2 |
| 0x9BC622 | 4（另有 ≥2 间接 [edx+4]：0x95096D、0x98D06B） |
| 0x9571BF | 1（0x97FCC9） |
| 0x97EBC9 | 1（0x533FF1） |
| 0x9507F0 | 1（0x97EC37，t080 已知，本轮未重扫该链） |

## FSDB 样本复现（13 图）

读取 `content/[FSDB]adventure/[group]map.Foothold/map.<id>.jsonl`、`map.Rope`、`map.Seat`（路径含 `[]` 字面量：Python `os.path` 直接拼接即可，glob 需 escape）。本轮清点：

- fh：222000000=376 … 230000003=130（合计 2154），全部含 `prev/next` 字段；v-dominant 段（|dy|>|dx|）最多 248（230020200）；degenerate=0（13 图全部）。**[t083 CORRECTION (F1)：本行合计 2154 为 t082 清点错误——t083 机器复核（`research/scripts/t083_fsdb_manifest.py`）13 文件全量 JSON 解析得 2283 条（376+18+240+40+184+130+45+188+355+144+172+144+247），全部含 9 字段；v-dominant/degenerate 结论不变。权威数字以 EV-63 与 `T083-FSDB-MANIFEST.txt` 为准。]**
- rope：ladder 14 / rope 2；字段 `x,y1,y2,l,uf,page,id`；样本 uf=1 存在（222000000）。
- seat：12（230000001×3、230000002×6、230000003×3）。

## Reviewer 独立复现

Reviewer 使用独立会话临时目录 `C:\Users\lithd\AppData\Local\Temp\opencode\t082-reviewer\` 的自建 harness（不复用 research/scripts 下主 Agent 脚本）。其窗口与结论见 `T082-INDEPENDENT-BLIND-REVIEW.md` / `T082-INDEPENDENT-ADVERSARIAL-REVIEW.md`。
