# Audio Round 4 取证（AUDIO-ROUND4-FORENSICS）

日期: 2026-11-13。

## 导入机制区分（本轮核心澄清）

| 机制 | 证据 | 状态 |
|---|---|---|
| **IAT 静态导入（Gr2D）** | 描述符[2] WINMM.dll，IAT 0x2D0D8+，全部**序号导入** #202/#200/#11/#10 | **A 级（R31-A 新发现）** |
| 哈希导入表 | exe 0xBA6434 {DLL 名指针， API 哈希×15}，加载器在壳桩内 | A（第九轮）|
| 动态 GetProcAddress | 无直接证据（哈希表替代）| — |
| 自定义函数表 | [0xafeXXX] 运行时表 = 哈希解析结果 | A |

## WINMM 序号映射

Gr2D 静态导入 4 个序号：#202/#200/#11/#10。WINMM.dll（Win2K/XP 时代）按序号导出：
- **假说（C）**：#202=waveOutWrite、#200=waveOutUnprepareHeader、#11=waveOutOpen、#10=waveOutClose
- 需同时代 winmm.dll 导出表核对（ME-2 维持 OPEN-STATIC——**纯静态可做**，无运行时依赖）

## 音频管线终态

```
Sound.wz: Sound/field.img/<map>/<event> 命名（A 级，R18）
服务器触发: environmentChange{name, 4=音效/6=音乐}（A 级，R21）
客户端: WINMM waveOut 族（IAT 静态，序号×4）（A 级，本轮）
```
**全管线 A 级三段闭合。** 残留：序号→函数名精确映射（ME-2）。
