# 逆向工程最终报告（REVERSE-ENGINEERING-FINAL-REPORT）

日期: 2026-11-13。全仓清零战役总结。

> **CLEAN-ROOM 审计标记（2026-11-13，audit/clean-room-reverse-engineering）**：
> 本报告正文下方两处结论已被后续轮次推翻，且经 clean-room 独立复核确认必须撤销：
> ① "键公式…`[eax+0xB4]`=有序插入，比较器在 DLL 内"（本文件 §关键逆向突破 第 5 条）——有序插入解释已被 22 张候选虚表全分类否定（Claim C-013，SUPERSEDED）；
> ② "排序架构定论：Tile/Obj 同容器有序插入…可直接实现有序列表"（§工程影响 第 1 条）——Tile/Obj 实为不同分派通道（Claim C-017），最终容器关系未证（Gap G01），相等键稳定性未证（Claim C-018 已撤销）。
> 权威状态以 `research/source-of-truth/claims.csv` 与 `research/result/clean-room/INDEPENDENT-AUDIT-REPORT.md` 为准。本文件其余内容（IID 归属、创建链、slot45 像素解码实测、修正表）经独立复核维持。

## 执行结果

| 指标 | 数值 |
|---|---|
| 扫描文件 | 684（md+csv） |
| 标记命中 | UNKNOWN 419 / NO-DECOMP 1319 / PARTIAL 13 / 未证实 11 / BLOCKED 5 |
| 建立缺口台账 | 17 项（P0×5 / P1×8 / P2×2 / P3×2） |
| P0 闭合 | **5/5**（含本轮 R13 终局） |
| 静态未解决（RUNTIME-REQUIRED） | 8 项（全部附最小验证方案） |
| 结构性长尾定性 | 2 类（ATL 样板 + 像素管线族，均有结构证明） |

## 关键逆向突破（本轮新增）

### R13 静态闭合（最高优先级任务）
1. **[0xBE2788] = Gr2D_DX8 接口**——IID `{E576EA33-4F08D465-8DE7B1AA-D9E63EF7}`（常量@0xBA0570）在 5 个 DLL 中唯一存在于 Gr2D_DX8.dll（file+0x35120 = VA 0x50435120）
2. **创建器 0xa0449b**：工厂表 [0xBE1FB0] + `REGDB_E_CLASSNOTREG(0x800401F0)` = COM 标准创建（铁证）
3. **初始化器 0xa00e5E**（盲区）：`[0xBDD494]+0x14 → 字符串表单例(0x7a48d0) → GetById(0x819)(0x40634c) → CoCreate(IID@0xBA0570) → [0xBE2788]`
4. **Gr2D 内部**：ATL 接口映射项 `{IID_ptr,0,1}` @0x2d1e0（主接口 dwOffset=0）+ QI 错误报告对（0x8bf0/0x8c17）
5. **排序键与调用分离**：键在 EXE 计算（tile=z+10(layer·3000−zM)−1073721834 / obj=layer·30000+z−1073739824，A 级维持）。~~`[eax+0xB4]`=有序插入，比较器在 DLL 内~~ **已撤销（Claim C-013）**：22 张候选虚表 slot45 全分类零插入语义；该调用的具体语义依 [ebp-0x10] 变体对象运行时类（Gap G24/R-09）

### slot45 实测修正
Gr2D@0x2f2cc m45（0x5041B84D）反汇编 = **字节→RGBA 解码循环**（像素引擎），非比较器。

## 重要修正

| 旧结论 | 修正 | 依据 |
|---|---|---|
| [0xBE2788]=Shape2D#Vector2D（MAP-CAMERA L51） | **错误** → Gr2D 接口 | 真 IID 唯一归属 Gr2D；Shape2D 是名字类 |
| 0x666F7D cmp=比较器（SEC16 R13 节） | **误读** → HRESULT 检查 | jge=SUCCEEDED 标准 COM 模式 + 后续 VARIANT 清理/Release 链 |
| "33 图元绘制分派"（GR2D 132 槽，13 轮前） | 已修正为像素格式管线（第 13 轮） | 掩码级证据 |

## 工程影响

1. **排序架构（修正）**：Tile/Obj 键空间同族（层差 30000，A 级），但两者走**不同分派通道**（Tile=层虚表调用，Obj=栈封装 cdecl，Claim C-017 A 级）；最终容器与比较器语义未证（Gap G01/G07 OPEN-STATIC），相等键稳定性未证（Claim C-018 已撤销）。loom-realm 可实现键公式与独立注册，**不得**宣称"原版=同容器有序插入"或"稳定排序已验证"
2. **Background 独立键空间**（index×1000）——独立绘制批次正确
3. **接口调用层**：Gr2D 主接口（IID E576EA33）承担渲染列表 + 像素操作 + 背景平铺——Render ABI 的 DLL 边界以此为准
4. 待运行时确认项不影响架构（仅精确虚表/参数级细节）

## 验证结果

- 缺口标记扫描：684 文件 ✓
- IID 字节唯一性：5 DLL + exe 全扫 ✓（唯一 Gr2D）
- 25 处 0xBA0570 引用上下文反汇编 ✓（全部错误报告模式）
- slot45 反汇编（60 指令）✓
- 旧报告修正落盘（MAP-CAMERA L51 + SEC16 R13 行）✓

## 交付物

| 文件 | 内容 |
|---|---|
| REVERSE-ENGINEERING-GAP-REGISTER.md | 17 项缺口台账 |
| MAP-R13-STATIC-CLOSURE.md | R13 全链闭合（含证据级标注） |
| REVERSE-ENGINEERING-RUNTIME-REMAINING.md | 8 项运行时残留 + 最小验证 |
| MAP-CAMERA-REVERSE.md（修订） | Vector2D 误判修正 |
| SEC16-FORENSICS.md（修订） | R13 行更新 + 闭合注记 |
| 本报告 | 总结 |
