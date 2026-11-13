# R13 PE/IAT 取证复核（R31-A）

日期: 2026-11-13。审计轮 Round 3.1。方法：IMAGE_IMPORT_DESCRIPTOR 规范遍历（非启发式）。

## Claim A-1：0x5042D0A0 的身份

**结论（等级 A）**：`0x5042D0A0` = **MSVCRT.dll 导入描述符的 FirstThunk（IAT）数组第 25 项**，绑定名字 `_purecall`（hint 0x192）。

证据链：
```
Binary: Gr2D_DX8.dll（.work/task-001/extracted/冒险岛online/）
ImageBase: 0x50400000（PE32, machine 0x14C, 6 sections）
DataDirectory[1] ImportTable: RVA 0x33E28 size 0x78
DataDirectory[12] IAT:        RVA 0x78 size 0x3C000（覆盖 0x2D0A0 ✓）
DelayImport[13]: 无
描述符[3] MSVCRT.dll: OFT=0x33EDC, FT(IAT base)=0x2D03C
  IAT[25] = 0x2D03C + 25*4 = 0x2D0A0 → 名字项 RVA 0x34064 = {hint 0x192, "_purecall"}
  （hint 与文件值 0x34064 解出的 0x0192 完全一致）
邻域：0x2D090=_CxxThrowException, 0x2D094=memset, 0x2D0A4=__CxxFrameHandler,
     0x2D0A8=wcscmp, 0x2D0AC=_finite；OLEAUT32(序号导入)从 0x2D0B4 起
0x2A610 原始字节: ff 25 a0 d0 42 50 = jmp dword ptr [0x5042D0A0]（导入跳转桩）
```

## Round-3 结论复核裁定

| Round-3 结论 | 裁定 |
|---|---|
| [0x5042D0A0] = __imp__purecall | **维持（A）** |
| 论证"无 .reloc 覆盖 ⇒ 表不被改写" | **推翻（论证错误）**：PE 加载器经 FirstThunk 解析**直接覆写 IAT 项**，与 .reloc 无关。正确论证 = 该地址位于 MSVCRT 描述符 FT 数组内，文件值为标准未绑定 IAT 形态（指向按名项）。运行时 [0x5042D0A0] = &msvcrt!_purecall |
| "运行时补丁表占位符"（Round-2） | 维持推翻，但 Round-2 的表述偏差另记：它不是补丁表，是**未绑定 IAT** |

## 附带新发现（等级 A）

**Gr2D_DX8.dll 静态导入 WINMM.dll**（描述符[2]，IAT 0x2D0D8 起，全部序号导入）：
```
0x2D0B4 = ordinal#202   0x2D0B8 = ordinal#200
0x2D0BC = ordinal#11    0x2D0C0 = ordinal#10
```
WINMM 序号 #202/#200/#11/#10 对应 waveOut 函数族（winmm 按序号导出 waveOutOpen≈11/waveOutClose≈10/waveOutWrite≈202/waveOutUnprepareHeader≈200，版本相关，具体映射待 winmm 导出表核对）。
**意义**：此前"音频经哈希动态导入"结论需修正——**Gr2D 本身静态导入 waveOut 族**；音频播放路径证据从 C 级升 A 级。
