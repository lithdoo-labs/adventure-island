# Avatar / Occlusion Round 4（AVATAR-OCCLUSION-ROUND4）

日期: 2026-11-13。基于 63-avatar-occlusion.md 已有成果的增量，不重复已闭合项。

## 已有成果摘要（A/B 级维持）

zmap 149 层 / smap / vslot-islot 双集 / face 三锚点（brow/navel/muzzle）/
26 表情 / 站姿→槽位映射 / 部件级 zmap 排序模型。

## 本轮增量调查

### 1. this+0x38 槽位来源（OPEN-STATIC 收窄）

63-avatar §11 原始未知：avatar 对象 +0x38 预置槽位串来源。
本轮证据：0x411FE1（VARIANT{vt=0xD,obj}）同样以 **+8** 偏移装对象于 16 字节 VARIANT——avatar +0x38 若为 4 槽位 ×8 字节 VARIANT 数组，第 0 槽对象位于 +0x38+8=+0x40。
**推断（C）**：+0x38 = 4 元素 VARIANT 数组基址（stance 相关），由 stance 切换器填 vt=0xD。
下一步：读 stance 切换函数（`cmp [x+0x61]` 家族）中的 +0x38 写入。

### 2. 双绘制入口 characterStart/characterEnd

zmap.img 已证 `characterStart` 在槽位 6（0-based）。characterEnd 同表存在。
**维持已证**：zmap.img 序数组是唯一权威层序源。
**新增（B）**：Gr2D slot45 复杂体 0x143d8 = 浮点 4 分量变换体（fld/fadd/fsub ×4）——**这就是 Avatar 绘制时的部件锚点合成器**（把 origin/anchor/offset 四分量加合）。它经 vtable 0x367B8 slot45 调用。

### 3. Avatar vs Obj 跨对象排序

Round 4 P0 已证 Tile/Obj **不同通道**（MAP-R13-FINAL-ROUND4 §2）。Avatar 属第三通道（运行时注册，需进图）。
**结论（B）**：三者独立注册→绘制时合成序（zmap.img 层表 + 键空间统一设计），非同容器实时排序。

### 4. 画布锚点映射 +0x1C/+0x20/+0x28/+0x2C

Canvas slot45 复杂体 0x17517 = **Canvas 属性 put/get 对（+0x8C/+0x90）**——Canvas.dll 的层属性与 Gr2D Layer(+0xCC/+0xD0) 同构。
**推断（C）**：+0x1C/+0x20 = origin 坐标对，+0x28/+0x2C = map 锚点对——由同族 getter/setter 维护（具体偏移待 Canvas slot19-22 全读，OPEN-STATIC）。

## 证据 CSV

见 AVATAR-OCCLUSION-EVIDENCE.csv（本轮新增 5 项，其余引用旧档编号）。
