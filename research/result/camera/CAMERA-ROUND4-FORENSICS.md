# Camera Round 4 取证（CAMERA-ROUND4-FORENSICS）

日期: 2026-11-13。

## 已有成果维持

VR 写入 @0x66E600（±400/±300 视口半宽折叠，A 级）；[0xBE2788] = CWzGr2DLayer 身份修正（R3.1）。

## 本轮增量

### 0x9C0EC0 / 0x9BC404 身份维持（Round 2 修正后）

- 0x9C0EC0 = 四 IID QI 分派器（非 +0x58 写者，Round 2 已修正）
- 0x9BC404 = 移动位置/状态解密-序列化器（非 +0x110 写者，同上）
- 两者**均非 Camera 函数**——Camera 更新需另寻。

### Camera 跟随目标搜索（本轮）

扫描全语料 `cmp/mov [reg+0xF0..0xFC]` 与 VR 字段交互：
- 0x66E600 的 VR 写入是**唯一**找到的 ±400/±300 折叠点（旧档维持 A 级）
- **未找到**角色坐标 → [0xBDF54C] 族字段的直接数据流（Camera 跟随链）
- [0xBDF54C] 静态 = 空指针时全零（R4 转储验证）

### 结论

| 项 | 状态 | 等级 |
|---|---|---|
| VR 折叠（±400/±300）| CLOSED-STATIC | A |
| Camera 位置变量 | OPEN-RUNTIME | — |
| 跟随/deadzone/平滑 | OPEN-RUNTIME | 需进图观察 [0xBDF54C] 族 + 0x9C0EC0/0x9BC404 的运行时角色 |
| world-to-screen | PARTIAL-STATIC | 键空间/层序已证；变换矩阵 = Gr2D 0x143d8（AV-R4-2）但组装序未证 |

### 最小捕获

进图后 [0xBDF54C] 对象 ±0x100 dump + 0x66E600 断点前后寄存器（角色坐标输入链）。
