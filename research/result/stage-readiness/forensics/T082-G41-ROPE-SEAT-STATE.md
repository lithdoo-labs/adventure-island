# T082 — G41 抓绳、离绳与座位状态机（0xA4FC6F / 0x9BFB52 / 0x9D80EC 端点修正 / 0xA4F6F1 审计）

**Round**: t082 (2026-11-14). **Lead agent derivation** (adversarial review pending).
**Source**: EXE `d4a67597…31718`（re-verified）；linear VA mapping。

## 1. 抓绳判定 0xA4FC6F（完整函数体，新）

`0xA4FC6F(this=[0xBDD498](field ctx), x1, y1, x2, y2)`，ret 0x10，4 int 参数：

```
归一化：xmin/xmax ← arg1/arg3；ymin ← min(arg2,arg4)；ymax ← max
xmin −= 10; xmax += 10                      # x 两侧扩 ±10（仅 x！）
edi=1(索引); esi=0x1C(步长28)
loop:
  base = [this+0xA8]                        # 绳数组基址；count 在 [base−4]
  base==0 或 索引越界 → return 0
  entry = base + 28×idx
  r.x    = [entry+0xC]
  命中 ⇔  xmin−10 ≤ r.x ≤ xmax+10
        ∧ ymax ≤ [entry+0x14]               # rope.bottom
        ∧ [entry+0x10] ≤ ymin               # rope.top
  命中 → return entry；否则 idx++
```

**绳 entry 布局（stride 0x1C）**：`+0x8` 旗标（=FSDB `uf`，见 §4）、`+0xC` x、`+0x10` topY、`+0x14` bottomY。

**结论（DIRECT-INSTRUCTION）**：
1. 命中矩形**不是**固定 x±10/y±30——x 方向是"查询框两侧 +10"，y 方向要求**整个查询框落入绳的 [top,bottom] 跨度内**（无 y 扩展）。
2. 抓绳范围由调用者的查询框决定（角色框），§2 给出 6 个真实调用点。

## 2. 0xA4FC6F 调用者审计（6 个直接 E8，全像）+ 键位判定（对抗审合并 Reviewer 完整阅读）

公共模式：`decrypt(加密主槽) → ±0.5/±0.499999999(0xB00D60) 舍入 → __ftol`（round-half-away 惯用法），`this=[0xBDD498]`：

| 调用点 | 所属 | 验证器 |
|---|---|---|
| 0x9D7D4F/0x9D7E9F/0x9D8015 | **0x9D7ADA = M 虚表 0xB0CC78 的 slot10(+0x28) 每-tick 状态函数（绳抓函数）** | 0x9D8218 |
| 0x9D4473/0x9D45C3/0x9D4739 | 0x9D44xx 状态族（同构） | 0x9D4975 |

**抓绳完整判定（Reviewer 窗口 + 主 Agent 调用点互证，DIRECT-INSTRUCTION）：**
1. 当前绳句柄（0x4B6ABE(move+0x124, move+0x12C)）必须为 **0**（未附绳）；
2. verticalKey [move+0x154] 符号选分支；状态验证器 ≠0；
3. **DOWN（key<0）**：查询 `0xA4FC6F(X, Y, X, Y−20)` → 盒 [X±10]×[Y−20, Y]；命中 → 双速度清零（fldz→move+0x68 后 move+0x50）、**X ← [rec+0xC]**、**Y ← min(Y, [rec+0x14])**、`vt+0x14(move, rec, 0, 0)`；
4. **UP（key>0）**：查询 `0xA4FC6F(X, Y, X, Y+10)`；额外门 `[rec+0x10] ≤ Y+10`（绳顶在可达范围内 @0x9D8088 jg 拒绝）；命中 → 双速度清零、X ← [rec+0xC]、**Y ← [rec+0x10]（顶）**、`vt+0x14(move, rec, 0, 0)`；
5. 上/下互斥（key 符号，down-then-up 顺序单 tick 内判定）；
6. **Foothold 不被清除而是被替换**：`vt+0x14` 把绳记录装入 [M+0x110]（经 0x9BFB52 加密句柄入 [M+0x124]）。

- **抓绳后写入**：如上（双速度清零 + X/Y 吸附到绳）；climb 状态每 tick `y+=3·k`（t080 已证）直接改 M+0x38。
- rope/ladder 类型区分：查询与抓绳路径**未发现类型旗标检查**（Reviewer 反证搜索为空）——ladder/rope 的分叉可能在走侧 0x517DA8 vs 0x9BCC9A 选择处，**OPEN**。

## 3. 0x9BFB52 = set-foothold/set-rope 状态安装器（完整函数体，新；对抗审补全）

`0x9BFB52(this=M, arg1=foothold|rope记录|0, arg2=rope句柄|0, arg3)`（**M 虚表 slot5(+0x14)，7 状态表全部统一**；变体 0x9D3CCA@0xB0CB70 预处理后尾转 @0x9D3DDA）：

```
vcall [M.vt+0x18](arg3)                       # slot6 moved-along 通知先行
if arg1 ≠ 0:                                  # 设段
  hint' = ( [arg1+0x1C], [arg1+0x20] )        # = 线对象 x2/y2（FSDB 对照）
  [M+0x114] = arg1; [M+0x118] = 0
  if [M+0x120] ≠ 0: 0x5117D1(M+0x11C, 0); [M+0x120]=0
elif arg2 ≠ 0:                                # 设绳
  [M+0x118]=0; hint' = ( [arg2+0x18], 0 ); [M+0x16C]=0
else: hint' = 保持 [M+0x130]/[M+0x134]
if hint' ≠ 当前: [M+0x130]/[M+0x134] 更新; vcall [[M+0x14].vt+2](M)   # 变更通知
[M+0x110] = arg1                              # ★当前站立/绳上下文
0x9BFD85(arg2, &M+0x124) → [M+0x12C]          # 绳句柄加密对（arg2=0 即清绳）
[M+0x148] = vcall [[M+0x14].vt+4](M, [M+0x150], [M+0x154], [M+0x148])  # 状态计数推进
0x9BFC35(M)                                   # 尾通知：kind = [M+0x16C]≠0?0x11 : [M+0x118]≠0?0xF : 0
                                              #   → 0x6B8949(M+0x19C, kind, ctx, flag, rope, X, Y, v1, v2, [M+0x148])
                                              #   （0x6B87D1 的强制新建记录变体）
```

**离绳语义（DIRECT）**：`call (M,0,0,0)`（0x9D80EC exit、0x9C3E1C）= 清 foothold + 清 rope + 保持 hint + ctx=NULL；**掉落由状态层接管（0x9BCD6C→0x9BE703 恢复 0x9BD567/0x9BD58F 积分）**。0x9BF1FA 的无邻接出口同样以 vt+0x14(M,NULL) 触发（G40 报告）。绳顶/绳底越界的 y clamp（t080 已证常量）后同样经 exit 调用进入该路径。
**水图抓绳**：0xA4FC6F 无水图门（field 级绳表即查）；水图 13 图中 6 图绳数=0（FSDB），分支自然不触发。
**位置吸附**：0x9BFB52 不写坐标——吸附在调用方（抓绳 X/Y 写、0x9BC992 重投影）；离绳时**无吸附**（保留 climb 最后坐标）。

**静态张力（OPEN，Reviewer 发现）**：抓绳把 stride-0x1C 紧凑绳记录作为 arg1 传入 slot5，而 0x9BFB52 读 [arg1+0x1C]/[arg1+0x20]——落在紧凑表的**相邻条目**上。两种解释：(i) [this+0xA8] 表条目是更大分配的子记录；(ii) 抓绳时的 hint 读取读到邻条数据。**可推翻条件**：运行时在绳抓时 dump [M+0x130]/[M+0x134]。登记为 OPEN-RUNTIME 最小捕获点之一。

## 4. 0x9D80EC 端点标注修正（CORRECTION of t080 G40 §1 / C-056 标签）

主 Agent 独立窗口（0x9D817F–0x9D81F6）实证：
```
y = decrypt(move+0x38)
if [move+0x154] > 0（key>0）:
  if y > [rope+0x14] → y = [rope+0x14] + 1       # 0x9D81DC inc edi
else:
  if y < [rope+0x10]:                            # 0x9D8191 jae 跳过
    [rope+8](uf) ≠ 0 → y = [rope+0x10] − 5       # 0x9D8198 add ecx,-5
    否则 → 重解绳句柄取 [rope+0x10] 覆写 y        # 0x9D81A3
```
槽语义（0xA4FC6F 窗口条件 + FSDB y1<y2 交叉）：**rope+0x10 = y 小端（绳顶）、rope+0x14 = y 大端（绳底）**。据此 C-056 的标签应为 "top−5 / bottom+1"（数值与指令事实不变，仅槽名/方向词修正）。**等级 DERIVED**：loader 侧 y1→+0x10 的写入映射未直读（由命中窗口条件与端点行为间接支撑）。t080 文本的 "downward/upward" 方向词同样对调（key>0 与 y 大端比较）。

## 5. 0xA4F6F1 竖线碰撞调用点审计（24 个直接 E8）

`0xA4F6F1(this=[0xBDD498], x, yTop, out, yBottom, halfWidth)`（5 参）。22 个可解码窗口的参数分布：

| halfWidth | 调用点 | 场景分类 |
|---|---|---|
| 1 | 0x546803, 0x54709b, 0x5bfeda | 地图/背景侧（yBottom=0x7FFFFFFF 无限深） |
| 1 | 0x953236, 0x964074, 0x9640e7, 0x9641b9, 0x977f52, 0x97a32e, 0x9cc207 | 移动/传送/角色（yBottom=0x7FFFFFFF 或 +0x50；yTop 常见 −5） |
| 1 | 0x963d72（t080 已证 portal 触发） | Portal |
| 2 | 0x9c6b68 | 移动族（唯一 push 2） |
| 寄存器（可变） | 0x9364d4（edi） | 角色侧（yTop=−0x14/−20） |
| 窗口错位 | 0x5ce496, 0x963d72 前窗 | 待补 |

**R12 终裁（取代"全局统一身体半宽"的任何表述）**：halfWidth 是**逐调用点参数**：主流=1（含 Portal），存在 2 与寄存器传值；地图背景侧与角色移动侧共用该函数但传不同常量。P3-06 实现应按调用语境取值，不存在单一全局身体半宽。

## 6. 座位取消链（预算内未展开）

0x6A0ADF/0x9658CC 起身链本轮未读新窗口（t080 已有座位写链）。0xCF dispatch 绑定已闭合（G38 报告 §4）。**Residual**。

## 7. FSDB 13 图样本

- 绳：ladder 14 条（230000001/2/3、230020200、230030100）、rope 2 条（222000000/1）；水图 6/8 无绳。
- `uf` 旗标：样本 rope(222000000) `uf=1` —— 对应 [rope+0x8]≠0 → 绳顶 −5 分支**真实可触发**。
- 绳顶/绳底：y1/y2 数据全量存在。
- 座位：12 个（230000001×3、230000002×6、230000003×3）。
- 上/下键同时按：输入层语义，本轮无指令证据——OPEN。

## 8. 裁决表

| 子行为 | 裁决 | 等级 |
|---|---|---|
| 0xA4FC6F 命中语义（x 跨度±10、y 框内含） | VERIFIED | DIRECT-INSTRUCTION |
| 绳 entry 布局 +0x8/0xC/0x10/0x14（uf/x/y1/y2） | VERIFIED | DIRECT-INSTRUCTION + FSDB DIRECT-DATA |
| 抓绳键位判定（DOWN 盒 [X±10]×[Y−20,Y] / UP 盒 [X±10]×[Y,Y+10] + 顶可达门 + 互斥） | VERIFIED | DIRECT-INSTRUCTION |
| 抓绳写入（双速度清零、X←rope.x、Y←顶/min、ctx 替换为绳记录） | VERIFIED | DIRECT-INSTRUCTION |
| 0x9BFB52 设段/设绳/清除三路径与字段写入清单（slot5、7 表统一） | VERIFIED | DIRECT-INSTRUCTION |
| 离绳 = (M,0,0,0) 清段清绳、无吸附、状态层接管重力 | VERIFIED | DIRECT-INSTRUCTION |
| rope 端点槽名/方向修正（top−5/bottom+1） | VERIFIED（数值）/ DERIVED（槽名，loader 侧未直读） | DIRECT + DERIVED |
| halfWidth 逐调用点审计（17×1、1×2、4×动态、1×不可解码） | VERIFIED | DIRECT-INSTRUCTION |
| 紧凑绳记录 vs slot5 hint 读取张力 | OPEN-RUNTIME（dump [M+0x130/0x134] @绳抓） | — |
| rope/ladder 类型区分旗标 | OPEN（未在查询/抓绳路径发现） | — |
| 座位起身链 0x6A0ADF/0x9658CC 新取证 | 未开始（预算） | — |

## 9. Residual

1. ladder/rope 分叉的确切位置（走侧 0x517DA8 vs 0x9BCC9A 选择）。
2. 0x9D44xx 族与 0x9D7ADA 的状态差异（哪个是站立抓绳、哪个是空中）。
3. 座位起身链。
