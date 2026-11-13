# REPRODUCIBILITY-REPORT（可复现性报告）

日期：2026-11-13。分支：`audit/clean-room-reverse-engineering`。

## 1. 原始素材清单（真实存在并已指纹化）

| 素材 | 路径 | 大小 (bytes) | SHA-256 |
|---|---|---|---|
| 解包 EXE 镜像 | `.work/task-036/game-image-unpacked.bin` | 10,330,112 (0x9DA000 = PE SizeOfImage) | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` |
| Gr2D_DX8.dll | `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` | 258,048 | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` |
| Canvas.dll | 同目录 | 204,800 | `1234c6294c7dd09f5b04c3a4be9c5063bf8467715f6c84243e5069886d5ea5ba` |
| NameSpace.dll | 同目录 | 143,360 | `1c94ca7e6317f46be22b03fe3f706d4907b2cc78d2b1d9364854bfe610eaa7a5` |
| Shape2D.dll | 同目录 | 86,016 | `9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b` |
| PCOM.dll | 同目录 | 114,688 | `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b` |
| MapleStory.exe（**加壳**，WinLicense 段名 tpuaozxc；用于来源核对，不用于反汇编） | 同目录 | 3,889,632 | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` |
| Map.wz（WZ 侧样本） | 同目录 | 835,954,262 | `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` |

PE 关键字段：

| 模块 | ImageBase | TimeDateStamp | SizeOfImage | 备注 |
|---|---|---|---|---|
| Gr2D_DX8.dll | 0x50400000 | （见 PE 头） | — | 6 sections；.rdata VA 0x2D000 |
| MapleStory.exe（加壳） | 0x400000 | 0x4B651820 | 0x9DA000 | 加壳态；解包镜像与 SizeOfImage 一致 |

工具：Python 3.14.4 + capstone 5.0.7（x86 32 位模式）；PE 结构自解析（struct.unpack_from）。

## 2. 无 REQUIRES_LOCAL_BINARY 项

全部关键声明的取证素材都在本仓库 `.work/` 内实际存在。`research/` 内不放二进制（正确——遵循仓库隔离）。
前任 Agent 引用的 `.work/task-063/*.py` 脚本与 `research/result/audit/*.log` 均实际在盘，可复跑。

## 3. 复现命令

以下命令在仓库根执行（PowerShell / bash 均可；需 Python3 + capstone）：

```bash
# 1. 生成权威统计与 clean-room CSV 交付物
python research/scripts/generate_cleanroom_deliverables.py

# 2. 全仓验证器（fail-closed；0 errors = PASS）
python research/scripts/validate_reverse_engineering.py

# 3. 隔离测试（20 项：1 正面 + 19 负面；只操作临时目录）
python -m unittest discover -s research/tests -v
```

独立复核指令级证据（任选）：

```python
# tile 键公式（期望 0x666F5D: imul ecx,ecx,0xbb8 ... lea edi,[eax+ecx*2-0x3fffb1ea]）
import capstone
exe = open('.work/task-036/game-image-unpacked.bin','rb').read()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
for i in md.disasm(exe[0x666F5D-0x400000:0x666F5D-0x400000+32], 0x666F5D): print(i.mnemonic, i.op_str)

# Gr2D 无 RTTI COL（期望 0x2E2C4[-4]=0x3E800000 噪声 / 0x2E2CC[-4]=0x50402A51 代码指针）
data = open('.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll','rb').read()
print(data[0x2E2C0:0x2E2D0].hex())
```

## 4. 复现约束声明

- 运行时类缺口（G08/G09/G10/G24/G27）需要进图转储，前置条件 = VM Win7 激活修复（C004F009，见 RUNTIME-REMAINING 捕获前提）。静态侧已尽力穷尽并有记录。
- gamedump2.elf / client*.tar 等大体积捕获物未在本轮使用；如需核对其时间戳与内容，另行取证。
- 本轮所有"clean-room 重取证"均实际执行（脚本存于本报告引用的临时工作区与上文命令；关键输出已摘录进 evidence.csv 的 instruction_or_data 列）。
