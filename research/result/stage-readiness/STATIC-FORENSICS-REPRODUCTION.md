# STATIC-FORENSICS-REPRODUCTION — t080 轮取证复现指南

## 原始输入（必须先核哈希）

| 文件 | SHA-256 |
|---|---|
| `.work/task-036/game-image-unpacked.bin` | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` |
| `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` |

PowerShell: `Get-FileHash -Algorithm SHA256 <path>`；Python: `hashlib.sha256(open(p,'rb').read()).hexdigest()`。

## VA↔文件偏移（务必按此规则，勿按 PE 节表）

- **EXE 解包映像 = 线性内存转储**：对任意 VA，`fileOffset = VA − 0x400000`。此规则经锚点验证而非假设：EV-04 IID 字节 @0xBA0570、EV-22 虚表 dword @0xB0CB70、EV-01 指令 @0x666F5D 在线性映射下与权威证据逐字节一致；而 PE 节表的原始大小不覆盖这些数据 VA（节表映射必然失败）。验证脚本锚点对见 `forensics/G36-G37-TILING-0x66A8D5.md` 头部。
- **Gr2D_DX8.dll = 常规 PE**：ImageBase `0x50400000`，用节表做 RVA→文件偏移（注意 `d < s.SizeOfRawData` 应比较节内差值而非 RVA 本身）。

## 工具

Python 3.14 + capstone 5.0.7 + pefile（环境已具备）。主 Agent 与 Reviewer 各自维护独立 harness（会话临时目录），核心动作等价：

```python
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
data = open(r'.work/task-036/game-image-unpacked.bin','rb').read()  # 先核 sha256
md = Cs(CS_ARCH_X86, CS_MODE_32)
def dump(va, n):
    for i in md.disasm(data[va-0x400000:va-0x400000+n], va):
        print(f'{i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}')
```

注意：SEH 函数以 `mov eax, imm; call 0xA6FC7C`（`__EH_prolog`）开头——**不要**把 imm 当指令解码；从 `call` 之后开始线性反汇编。对齐错误的窗口先回退找函数边界（下一个 `mov eax, imm; call 0xA6FC7C` 或 `push ebp; mov ebp,esp`）。

## 逐记录复现窗口（本轮全部新证据的地址清单）

| 记录 | 关键窗口 |
|---|---|
| G36/G37 | 0x66A8D5–0x66B4A4（全函数）；0x66A3CE–0x66A40E；0x66A7B4–0x66A80B；0x667E7E–0x667EB1；helpers 0x66B4A5/0x66B4F6/0x66B51D/0x43FD38/0x43FD62/0x43FD8C/0x426F74/0x4100A1/0x4100C8/0x43B92C/0x548460/0x6713DF/0x415CEB/0x414A7E/0x427DE0/0x671234；数据 0xBE7330 |
| G39 | 0x66A136–0x66A26E；0x43715C–0x4371E0；0x66A567–0x66A692；0x66B544–0x66BC80（全函数，五属性） |
| G38 | 0x963CE1–0x963D6D；0x96423F–0x964269；0x9552F0–0x955399；0x9C1113–0x9C11F8；0xB0C3E8..0xB0CC08（8 虚表 dword）；0x9507F0–0x95096D；0x9BC622–0x9BC740；0x95B8B0–0x95B8E7；0x97EBC9/0x97EC37；0x9D34FA；0x4B6DCA/0x4B6DD0 |
| G40/G41 | 0x9D80EC–0x9D8210；数据 0xB00D68（double=3.0）；0x9658CC–0x9659DA；0x965860–0x9658C2；0xA4F6F1–0xA4F770；0x9BF160–0x9BF1FA 头；0x9C4B00–0x9C4B78；0x9BCD6C；0x94B9C2；0x9BFD4C |
| R13/G27 | 0x427EB3–0x427F0D；0x666E8C–0x666ED5；0x666F5D–0x667003；Gr2D RVA 0x2D140–0x2D1A4（40 槽虚表+intmap） |

全像 E8/E9 调用点扫描：对目标 VA 解 `rel32`，命中 `va+5+rel==target`（主 Agent 与 Reviewer 两个独立实现结果一致）。

## FSDB 样本审计复现（t080 实跑）

- 目录含 `[]` 字面量：Python 需 `glob.escape` 或 `os.listdir`；PowerShell 需 `-LiteralPath`。
- `content/[FSDB]adventure/[group]map.Back`：387 条 JSONL（type 0/1/2/3/4 = 109/155/36/9/78；全部 cx==0 或 cy==0；无 type5/6/7；无 rate==0 的 type4）。
- `content/[FSDB]adventure/[group]map.Obj`：1817 条，flow 分布 {absent:1762, 1:55}，flow=1 的 cx/cy 缺省、rx∈'−15'..'15'。

## 复现门槛说明

字符串池（`0x7A48D0` 家族）在运行时由 `[0xB07654]` 惰性构建——**id→名称不可从本静态镜像解码**；本轮所有 id（0x331/0x332/0x545/0x546/0x547/0x548/0x549/0x54A/0x54F..0x553/0x1581/0xBF0/0x155D/0x1550/0x1551）以"读点+历史佐证名"登记，名称非字节级证据（除与 WZ 属性一一对应已由双加载器同 id 交叉证实者）。
