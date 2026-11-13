# R13 RTTI / 虚表取证复核（R31-B）

日期: 2026-11-13。独立复核 Round-2/3 的类身份与 slot45 结论。

## Claim B-1：RTTI Complete Object Locator 存在性

**结论（等级 A）**：候选虚表 **均不携带 COL**——所有 vftable[-1] 位置无有效 COL 指针：

```
vt 0x5042E2C4: [-4] = 0x3E800000（噪声）
vt 0x5042E2CC: [-4] = 0x50402A51（前表尾项，代码指针）
vt 0x5042E380: [-4] = 0x5042A610（purecall 桩）
vt 0x5042D140: [-4] = 0
vt 0x5042F2CC: [-4] = 0x3BCD17B6（噪声）
（其余候选同，全无）
```

类型描述符注册表（Gr2D）：`.?AV_com_error@@`@0x363F8 · **`.?AVCWzGr2DLayer@@`@0x36500** · **`.?AVCWzRawCanvas@@`@0x36520** · `.?AVtype_info@@`@0x39AF0。
**两个 CWz TD 的 COL 交叉引用 = 零**（VA 与 RVA 两种解释均扫）。

**裁定**：
- "RTTI 验证类身份"（Round-2 标注）**降级为 C**——`.?AVCWzRawCanvas@@` 字符串与 IID 0x50436540 同在 .data 尾部属**邻近推断**，无 COL→vftable 链证明。
- 有效部分（维持 B）：intmap@0x2E520 首项 IID=6DC8C7CE（结构证据）；虚表与 intmap 的邻接（见 B-2）。

## Claim B-2：虚表起点 0x2E2C4 vs 0x2E2CC（Round-3 未消歧）

两种读法都与 intmap@0x2E520 精确衔接（151×4 与 149×4 均成立，差 2 槽）：

| 读法 | slot0/1/2 | slot45 (+0xB4) | 支持 |
|---|---|---|---|
| A: 起点 0x2E2C4（151 槽）| 0x2B84(QI 型,997c) / 0x2A51(引用计数型) / 0x2AA3 | **0x2A610 = purecall**（本轮 r31d 最大游程扫描所得起点）| 最大 .text 指针游程 + COM 槽位惯例（QI/AddRef 在 0/1）|
| B: 起点 0x2E2CC（149 槽）| 0x2AA3 / 0x2AA7 / 0x2ACC | **0x4FB1 = 删除型析构**（Round-3 实测）| Round-3 邻接算术（两种算术都成立）|

**裁定（C 级）**：读法 A 结构证据更强（扫描起点 + COM 惯例）。两读法**共同结论**：该虚表族 slot45 ∈ {purecall, dtor}，**均非插入**——此共同结论对 0x666F7D"插入"解释的否定是稳健的（不依赖起点选择）。

## Claim B-3：slot45@0x4FB1 = 删除型析构（读法 B 下）

复核（等级 A，指令重放）：
```
50404FB1 push esi; mov esi,ecx
50404FB4 mov [esi],0x5042E380      ; vtable 换基
50404FBA call 0x5040C8AB            ; 基类析构
50404FBF test byte [esp+8],1        ; flags
50404FC6 push esi; mov ecx,0x5043A088; call 0x50401700  ; 条件 operator delete
50404FD1 ret 4
```
维持（该函数确为 deleting dtor）；但**其槽位编号 45 仅在读法 B 下成立**（读法 A 下它位于槽 43）。

## Claim B-4：0x2BAB（任务点名）

实测 = 又一删除型析构变体（vtable 换基 **0x5042E36C** + 条件 delete，@0x50402BAB）。属同族析构矩阵（0x2E2C4 族的槽位族），无独立容器语义。

## 0x2E380 与 0x2E520 的角色（更正记录）

- 0x2E380 本身是独立虚表起点（102 槽，r31d 扫描）——Round-3 仅将其描述为"析构换基目标"，不完整。
- intmap@0x2E520 的 5 项 IID 链（6DC8C7CE>F28BD1ED>4CFB57C7>01110BC6>IUnknown）维持结构证据（B）；但其与具体虚表的绑定因 B-2 歧义而**不唯一**。
