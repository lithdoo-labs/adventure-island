# 字符串驻留表与 UI 巨函数机制（本轮突破）

日期: 2026-11-12 第五轮。

## 字符串驻留表（@运行时 0x29a6fc）结构

WZ 名称驻留哈希表，每项约 0x60 字节：
```
{hash(如 0xe871a364), flags/0x10 标记, ASCII 指针(池 0x2b9xxx), UTF-16 内联副本, 长度}
```
捕获时刻（角色选择）已驻留 54 个名称 = 默认角色 WZ 节点集。

## 完整面部表情集（26 种）——新发现

```
blink, hit, smile, troubled, cry, angry, bewildered, stunned, vomit,
oops, cheers, chu, wink, pain, glitter, blaze, shine, love, despair,
hum, bowing, hot, dam, bangle, setback, wickedness
```
面部锚点：`brow`（眉）、`navel`（脐/身体中心）、`muzzle`（口）
地图渲染键：`zmap.img`、`smap.img`、`map`

## 动作名称运行时确认（补充）

`stand/0/1/2, jump, fly, hungry, rest0/1, hang, walk1/2, alert, swingO1-O3/OF`
（+ 长枪变体 swingT2PoleArm/swingP1PoleArm/swingP2PoleArm，见 RUNTIME-ADDRESS-SPACE.md）

## UI 巨函数机制（最终证实）

8 个 115-315KB 巨函数共享的"辅助函数"（Ghidra 间隙，capstone 解出）：

| 地址 | 身份 | 证据 |
|---|---|---|
| 0x40263b | **COM 智能指针解引用** | `[esi]` 空检查 → E_POINTER(0x80004003) → 异常 |
| 0x4029b7 | **VARIANT/BSTR 析构** | vt==8(VT_BSTR) → 释放 [eax-4] → 清零 |
| 0x403ac7 | **WZ 属性查询包装** | SEH + VariantInit([0xafe264]) + 虚表方法[ecx+0x14] + COM 错误包装(0xa6ef0f) |
| 0x406368 等 | 同族 VARIANT 生命周期 | — |

**结论**：巨函数 = COM/VARIANT 驱动的 **WZ 属性逐项读取的 UI 屏幕构建器**。
这就是为什么反编译中无明文字符串——全部经 VARIANT/驻留表间接访问。

## 音频系统边界确证

全语料 52,326 函数 **0 个**直接音频字符串引用（.wav/.mp3/sound/BGM）——
音频名称同样经驻留表间接访问；捕获时刻（选角）未触发音频加载。
音频系统结构需进图后捕获或 DLL 静态虚表分析（Shape2D/Gr2D 中可能有）。

## 资产
- INTERN-TABLE-STRINGS.csv（54 驻留名）
- MOTION-TABLE-RUNTIME.csv（149 槽）
- 本文档
