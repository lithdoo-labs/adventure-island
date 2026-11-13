# T082 — G40 Foothold 完整换段与坡面行走（0x9BF1FA 全函数）

**Round**: t082 (2026-11-14). **Lead agent derivation** (adversarial review pending).
**Source**: EXE `d4a67597…31718`（re-verified）；linear VA mapping。

## 1. 0x9BF1FA 完整控制流（0x9BF1FA–0x9BF6E9，含出口；对抗审合并 Reviewer 完整阅读）

调用约定：thiscall(this=ecx=M)，2 栈参数（**arg1 = 源线状态 2 槽基**（{+0 t, +0x18 speed} 加密对，非纯速度——对抗审修正），arg2 = 剩余预算 int*）。
**身份**：M 虚表 **slot3(+0xC)**（7/8 状态表；变体 0x9C5B8A@0xB0C760、0x9CCAA8@0xB0C970）。
调用者（全像 E8 仅 2 个）：**0x9C5F53**（walk tick：预检查 [ctx+0x38]·f>0 与 vt+0x18 结果 vs move+0x134，然后 `0x9C4B78 → 0x9C62A8 → 0x9BF1FA`）、0x9CCC8D（同型）。

```
entry:
  edge = 0x9BF9D3(M, arg1, *arg2)   # ★语义更正（对抗审）：地图水平边界钳制+部分步长
                                    # worldX = round(t)·m1 + x1 与 [M+0x138/0x140] 比较；
                                    # 越界 → t 钳到 (bound−x1)/m1、speed=0；
                                    # 返回消费量 = int(比例×预算) clamp [0, 预算]
                                    # （t080/主 Agent 初稿的 "edge finder" 标签作废）
  srcT = decrypt(arg1)

  Backward（srcT ≤ 0 < line.t）: # L_left（0x9BF253）
    prev = [curfh+0x4C]                ; curfh=[M+0x110]
    cand = [prev+0x50]                 ; prev 的另一侧连接
    if cand==0 or cand==curfh → L_default   # 自环守卫 0x9BF26F
    if cand.m1 > 0 (非垂直):
       t = 0 写入 (M+0xE0)              # 0x9BF287 fldz
       0x9BC992(this=M+0x20, M+0xE0, cand)      # 坐标吸附到 cand 锚端
       vcall [M.vt+0x14](M, cand, 0, 0)          # 0x9BFB52 设段
       ret 1
    else (垂直段):
       清 t(M+0xE0)=0、切向速度(M+0xF8)=0；ret（不换段、不吸附）

  Forward（srcT ≥ len, line.t < len）: # L_right(0x9BF2DC)
    next = [curfh+0x50]
    cand = [next+0x4C]                 # next 的另一侧连接
    if cand==0 or cand==curfh → L_default   # 自环守卫 0x9BF331
    if cand.m1 > 0:
       t = cand.len([cand+0x40]) 写入  # 0x9BF343
       0x9BC992(this=M+0x20, M+0xE0, cand)      # 吸附到 cand 远端
       vcall [M.vt+0x14](M, cand, 0, 0)
       ret 1
    else: 清 t/切向；ret

  L_default(0x9BF371): # 段内（含前面各失败出口汇入）
    if t < 0 或 t > curfh.len → L_over(0x9BF3D0)
    0x9BC992(this=M+0x20, M+0xE0, curfh)        # ★每 tick 坡面重投影（高程重算）
    *arg2 -= edge
    vcall [M.vt+0x18](M, edge)                 # slot6 moved-along 通知
    ret 0

  L_over(0x9BF3D0): # 跨越插值（一帧跨段）
    线状态快照入栈；方向标志 [ebp-4]
    r = t/(t−speed)（backward）或 (len−t)/(speed−t)（forward）
    consumed = int(edge × r)；*arg2 -= consumed
    新速度 = src_speed + (line_speed − src_speed)·r（线性插值 + 符号一致性钳制 0x9BF5F3–0x9BF639）
    邻居有效 → t=端点值、0x9BC992(M+0x20, M+0xE0, cand)、vt+0x14(M, cand, 0, consumed)、ret 1
    邻居为 0（0x9BF654 无邻接掉落路径）:
       t = 方向端点（backward→0 / forward→len）、速度插值
       0x9BC992(M+0x20, M+0xE0, [M+0x110])     # 在当前 ctx 上重投影
       vcall [M.vt+0x14](M, NULL, 0, consumed)  # ★ctx 清空 = 掉落信号
       ret 1                                    # 函数内无状态切换/掉落虚调用
```

## 2. 关键结论

0. **M 对象虚表结构（新，DIRECT-DATA）**：`call [edx+0x14]`/`[eax+0x18]` 的宿主是 M 自己的 vtable（挂 [M+0]，区别于 P 的 8+1 张表挂 [M+0xC]）。M 有 7 张状态表（0xB0C498/0xB0C660/0xB0C760/0xB0C870/0xB0C970/0xB0CA70/0xB0CC78）：
   - **slot3(+0xC) = 0x9BF1FA**（4 表直接，3 表替换为 0x9C5B8A/0x9CCAA8 等状态特化）
   - **slot5(+0x14) = 0x9BFB52（7 表全部统一——设段安装器跨状态一致）**
   - slot1(+0x4) = 0x9BC622（4 表）或状态 wrapper 0x9C3DD1/0x9C9983/0x9CBE4F/0x9CFCB4（3 表；0x9BC622 的 4 个 E8 直调 0x9C3DEC/0x9C999E/0x9CBE6C/0x9CFCD3 正是这些 wrapper 的内联转发，互证闭合）
   - slot16(+0x40) = 0x9BC4F5（E_FAIL，7 表全部）——**M 侧不接受同图传送**（slot16 的传送入口在 P 表）。
1. **[M+0x110] = 单个当前 Foothold 指针**（非容器）：`0x9BF253 ecx=[ebx+0x110]` 后直接 `eax=[ecx+0x4C]`、`[eax+0x30]`（几何）、`[eax+0x50]`（邻接）——把 [M+0x110] 当容器的读法（t080 G40 §6 备注口径）不成立；+0x4C/+0x50 直接是 fh 的 prev/next 槽。0x9BFB52 §3（G41 报告）独立证实。
2. **邻接判据（DIRECT）**：换段候选 = 对侧连接的反向链接 ≠ 当前段（`cand = [prev/next 的另一侧]; cand ≠ curfh`）。FSDB 的 `prev/next` 字段正是该链接的源数据（13 图全量存在）。
3. **默认路径 = 每 tick 坡面重投影**：站立/行走时 0x9BF1FA 每帧把 (X,Y) 从 t 重导出（0x9BC992，高程重算），并扣减 edge、经 slot+0x18 消费。**"吸附到坡面"由本函数常态执行，不是一次性事件**。
4. **垂直段（m1≤0）不换段**：只清 t 与切向速度——角色到达垂直段邻接时停止横向转移（对应"墙"语义）。13 图垂直/近垂直段大量存在（如 230020200 有 248 条 v-dominant 段）→ 分支真实可触发。
5. **横向速度不截断**（对抗审确认）：段上速度经线性插值+符号钳制，世界分量由 0x9BC992 参数化重导出（slot3/4 = b·m1/b·m2）——无独立的截断写。
6. **换段后是否重调碰撞查询**：否——0x9BF1FA 内无任何碰撞查询（纯参数化行走，对抗审反证：寻找 lateral-velocity 截断与查询调用均为空）；碰撞查询只发生在 0x9BE703 物理循环（0x9BE853–0x9BE888 扫掠盒 0x5114AA 与 0xA4F6F1）。
7. **状态一致性**：每个出口都重加密 (t,speed) 对 + 恰好一次 0x9BC992 重投影 + 恰好一个通知（换段/清空 = vt+0x14，段内 = vt+0x18）；ret 0=段内、ret 1=换段/钳制。**无邻接段掉落 = vt+0x14(M,NULL)（ctx 清空信号，掉落由状态层接管）**。

## 3. 0x9BF9D3（对抗审语义更正）

`0x9BF9D3(this=M, arg1=src, *budget)`：**地图水平边界钳制 + 部分步长**——worldX = round(t)·m1 + x1 与 [M+0x138]/[M+0x140] 比较；越界时 t 钳到 (bound−x1)/m1、speed 清零；返回消费量 = int(比例×预算) clamp [0,预算]。（主 Agent 初稿的 "edge finder" 与 t080 标签作废；0x9BFA26 读 [edi+0x138] 的窗口与该语义吻合。）

## 4. FSDB 13 图覆盖

- prev/next 邻接：13 图全量 fh 记录均带 `prev/next` 字段（ID 语义，加载后为指针）——换段规则可逐图验证。
- 坡面吸附：slope/h 段（如 222000000 311 条、230000000 191 条）。
- 垂直分支：v-dominant 段存在（65/248/119…条）。
- 退化段（dx=dy=0）：**13 图 0 条 → NOT PRESENT IN TARGET 13 MAPS**（代码分支存在与否待 fh loader 侧确认；当前窗口未见专门分支）。

## 5. 裁决表

| 子行为 | 裁决 | 等级 |
|---|---|---|
| 换段主链（双向邻接判据 [N+0x30]>0 + 自环守卫、t 端点写、吸附、设段 vcall） | VERIFIED | DIRECT-INSTRUCTION |
| 每 tick 坡面重投影（默认路径，高程重算） | VERIFIED | DIRECT-INSTRUCTION |
| 垂直段不换段、只清 t/切向 | VERIFIED | DIRECT-INSTRUCTION |
| 跨越插值（比例 r、consumed 预算核算、速度线性插值+符号钳制） | VERIFIED | DIRECT-INSTRUCTION |
| 无邻接掉落路径（vt+0x14(M,NULL)、ret 1、函数内无状态切换） | VERIFIED | DIRECT-INSTRUCTION |
| 横向速度不截断（世界分量参数化重导出） | VERIFIED | DIRECT-INSTRUCTION |
| fh+0x4C/+0x50 = prev/next（单 fh 语义） | VERIFIED（修正 t080 的容器口径） | DIRECT-INSTRUCTION |
| 0x9BF9D3 = 地图边界钳制+部分步长（更正 t080 "edge finder" 标签） | VERIFIED | DIRECT-INSTRUCTION |
| fh+0x40 = len（段长度参数） | DERIVED（对抗审：单位方向 +0x30/+0x38、len clamp 上限；loader 写入侧未直读） | DERIVED |
| 0x9BF160 叉积方向判断（t080） | 不变 | DIRECT-INSTRUCTION |

## 6. Residual

1. fh loader 写入侧（WZ→对象字段映射的直证；当前布局由多函数读侧交叉 + FSDB 字段对照支撑）。
2. slot3 变体 0x9C5B8A/0x9CCAA8 的差异体。
