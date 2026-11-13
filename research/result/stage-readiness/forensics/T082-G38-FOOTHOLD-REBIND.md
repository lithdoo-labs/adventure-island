# T082 — G38 Portal 到达后的 Foothold 重绑、状态重置及执行顺序

**Round**: t082 (2026-11-14). **Lead agent derivation** (adversarial review pending section 7).
**Source**: `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` (re-verified this round).
**Mapping**: linear, `fileOffset = VA − 0x400000`.

This report supersedes the t080 G38 record's §3 (foothold re-attach ordering) and §2 rebind-chain reading; all corrections are flagged `CORRECTION` and carry new instruction windows.

## 0. 对象模型统一（本轮新基础，所有后续推导的前提）

- `P = [user+0xF28]`（ATL 包装对象；vtable at `P+0`；`0x95533D` 调用 `call [[P−0xC]→vt? …]` 的实际形式见 1.1）。
- **`M = P − 0xC`**（移动状态对象；由 `0x9C1124 lea esi,[ebx−0xC]` 显式建立，`0x9C1130 mov [ebp+8], esi` 把 0x9C1113 的 arg1 槽覆写为 M）。
- 加密 double 槽对（密文 8B + cookie/key 4B，间隔 0x10）：`M+0x20`(X) `M+0x38`(Y) `M+0x50`(vx) `M+0x68`(vy)；副槽 `M+0x80/0x98/0xB0/0xC8`。
- 解密 `0x548806(slotPtr, keyDword)`；加密写 `0x6131F4(slotPtr, double)→cookie`。
- `[M+0x110]` = **当前 Foothold 指针**（单个 fh；本轮多函数交叉证实，见 §3）。
- `[M+0x124]/[M+0x12C]` = rope 对象槽 + cookie；`[M+0x130]/[M+0x134]` = hint X/Y；`[M+0x114]`、`[M+0x118]`、`[M+0x148]`、`[M+0x14]/[M+0x150]/[M+0x154]`、`[M+0x158]/[M+0x178]`（积分标志，0x9D80EC 读取）、`[M+0x19C]`（移动帧编码组件）。
- Foothold 对象 F 布局（EXE 侧，多函数交叉 + FSDB 字段对照，见 §3.4）：`+0xC/+0x10` = n1,n2(锚端 int)；`+0x1C/+0x20` = x2,y2(int)（hint 源）；`+0x30/+0x38` = m1,m2(方向分量 double，对抗审：单位方向候选)；`+0x40` = len(段长 double)；`+0x48` = word id；`+0x4C/+0x50` = prev/next 链接。
- `0xA70F94` = `__ftol`（fnstcw/fistp qword 模式，0xA70F94–0xA70FBA）。

## 1. G38-A 同图传送后的 Foothold 重绑

### 1.1 调用链再核（0x9552F0 apply → slot16）

```
0x955324  push edi                       ; callee-save（结尾 0x955399 pop edi）
0x955325  edi = [esi+0xF28]              ; P
0x95532B  edx = edi−0xC
0x95532E  neg edi; sbb edi,edi; and edi,edx   ; edi = P≠0 ? P−0xC : 0  = M
0x955334  edx = [edi+0xC] = [P]          ; vtable（存在 P+0）
0x955337  push eax(Y); 0x95533B push ecx(X); 0x95533C push edi(+0xC = P)
0x95533D  call [edx+0x40]                ; stdcall(P, X, Y)，ret 0xC
```
（窗口 0x9552F0–0x95539C，与 t080 一致；this 归属经 0x9C1113 头部修正为 P，slot16 目标 0x9C1113 属 8 个 sibling vtable 的 t080 结论不变。）

### 1.2 0x9C1113 尾部通知的真实 this（CORRECTION of t080 §1.4 尾注）

```
0x9C1119  ebx = [ebp+8]          ; P
0x9C111C  [P+0x104] = 0          ; = [M+0x110] ← 清当前 foothold 指针！
0x9C1124  esi = ebx − 0xC        ; M
0x9C1130  [ebp+8] = esi          ; arg1 槽 ← M（供尾部使用）
...
0x9C11E2  cmp [ebx+0xC], 0       ; [P+0xC]=[M+0x18] ≠ 0 才通知
0x9C11EB  ecx = [ebp+8]          ; = M（覆写后）
0x9C11EE  push 3
0x9C11F0  call 0x53E95D          ; 0x53E95D(M, 3)
```

**新事实（DIRECT-INSTRUCTION）**：
1. `0x9C111C`：同图传送写坐标函数的**头部即清零 [M+0x110]（当前 Foothold）**——同图传送后角色立即变为"无段"状态。
2. 通知条件是 `[M+0x18]≠0`（t080 记作 "[inner+0xC]"，偏移口径差 0xC，语义不变：P 存在/启用时非 0）。
3. `0x53E95D` 的 this 是 **M**（t080 未定）。

### 1.3 0x53E95D = 通用移动通知器（不是重绑）

完整函数 0x53E95D–0x53EA07（`ret 4`）：

```
edi = this(M); ebx = [M+0x148]; esi = M+0x20
d1 = decrypt(M+0x68, key M+0x78)   → [ebp-8]     ; vy
d2 = decrypt(M+0x50, key M+0x60)   → [ebp-0x10]  ; vx
d3 = decrypt(M+0x38, key M+0x48)   → [ebp-0x18]  ; Y
d4 = decrypt(M+0x20, key M+0x30)   → [ebp-0x20]  ; X
rope = 0x4B6ABE(M+0x124, M+0x12C)                ; rope 对象（0x9D80EC 同槽）
vy_i = __ftol(d1); vx_i = __ftol(d2); y_i = __ftol(d3); x_i = __ftol(d4)
0x6B87D1(this=M+0x19C, arg1=通知码3, [M+0x110], [M+0x118], rope, x_i, y_i, vx_i, vy_i)
```

- `0x6B87D1` 属 `M+0x19C` 组件（移动帧编码器家族；兄弟方法 `0x6B8701` 被 0x9BC622 尾部调用，将 int 化 X/Y/vx/vy 经 `0x4F7780/0x416E36` 位打包进结构）。
- **27 个直接 E8 调用者**（0x53DA26…0xA1867F，全像扫描）——0x9C11F0 只是其一。0x53E95D 是各移动状态变化后的通用"位置/速度快照发布"函数。
- **结论：同图传送链 0x95533D→0x9C1113 自身不含 Foothold 查询与重绑**；它 (a) 清 [M+0x110]，(b) 写坐标，(c) 发布通知。

### 1.4 同图重绑的实际执行者：下一移动 tick

- `0x9C5F53`（walk-state tick 内）：预检查（[ctx+0x38]·f>0、vt+0x18 结果 vs move+0x134 身份比较——hint 从不喂查询坐标，对抗审确认）→ `0x9C4B78(M, dir, 0)`（tick 状态处理）→ `0x9C62A8(M)` → **`0x9BF1FA(M, src, &budget)`**（E8 直接调用，全像仅 2 个调用者：0x9C5F53、0x9CCC8D）。
- **空间查询的真正宿主是 0x9BE703（M 虚表 slot4 物理主循环）**：0x9BE853–0x9BE888 经 0x5114AA 扫掠盒查询候选；hint（move+0x130/+0x134）的消费者 0x9BE913 只做**候选 [+0x20] vs move+0x134 的身份比较**（对抗审全量反证搜索：无任何查询参数来源于 hint）。
- 0x9BF1FA 默认路径（t 在 [0,len] 内）调用 `0x9BC992(this=M+0x20, M+0xE0, [M+0x110])` **把坐标从 t 重投影到当前段坡面**；[M+0x110] 已被 0x9C111C 清 0 时，ctx 重建由 0x9BE703 的查询循环完成（0x9BF1FA 自身无碰撞查询）。
- **G38-A 裁决：VERIFIED（机制级）**——同图传送 = "清段 + 写坐标 + 发通知"，重绑延迟到下一物理 tick：0x9BE703 扫掠盒查询重建 ctx（用取整 X/Y，无 −10），此后 0x9BF1FA 家族恢复行走处理；不是在传送调用栈内同步完成。

## 2. G38-B 跨图 Foothold 重绑

### 2.1 0x9BC622 参数表（CORRECTION of t080 §2 的参数错位）

`0x9BC622(this=ecx=M, arg1..arg7)`，7 个栈参数。0x9507F0 场景（0x950958–0x95096D）：

| slot | 值 | 语义 |
|---|---|---|
| arg1 | 1 | 模式码 → `[M+0x18]` |
| arg2 | X（已 clamp） | fild → 加密写 M+0x20 |
| arg3 | Y−10 | fild → 加密写 M+0x38 |
| arg4 | 0 | fild → M+0x50 (vx=0) |
| arg5 | 0 | fild → M+0x68 (vy=0) |
| arg6 | `[user+0x3C0]` | 0/1 标志（`test 0xFFFFFFFE` @0x9BC737）|
| arg7 | **0** | **Foothold/几何源指针；=0 时跳过 hint+重绑** |

- t080 把 arg6（`[user+0x3C0]`）当成了 hint/重绑源——**参数错位**。真实几何源是 **arg7（[ebp+0x20]）**：`0x9BC6C1 mov edi,[ebp+0x20]`，`0x9BC6FB/0x9BC704 [M+0x130]/[M+0x134] ← [edi+0x1C]/[edi+0x20]`，`0x9BC715 0x9BC89F(this=M+0xE0, M+0x20, edi)`，`0x9BC724 0x9BC992(this=M+0x20, M+0xE0, edi)`。
- `[user+0x3C0]` 的写入者证实其 0/1 性质：`0x98CFF2 movzx eax,al; mov [ebx+0x3C0],eax`（packet byte）；`0x98D077 mov [ebx+0x3C0],eax`（eax=[M+0x148]=arg6 回写，同值）。
- **跨图调用（0x95096D）传 arg7=0** → `0x9BC6ED cmp [M+0x110],0; je 0x9BC72B` → **跳过 hint 复制与 0x9BC89F/0x9BC992，hint 清零**（0x9BC72B 写 0）。
- [M+0x110] 的设置条件（同函数）：`ecx=[M+0x14]`（由 `0x9BC602(M, user+4)` 设置）vcall slot0 返回 **≠7** 时 `[M+0x110]=edi(arg7)`；==7 时跳过（保留新 move 对象初始值 0）。

### 2.2 跨图重绑的真实路径

1. `0x9D359D` 创建**全新 move 对象**（旧对象整体废弃——这是移动状态的真正"复位"）；`0x971BC8(user+0xF28, &obj)` 挂接。
2. `0x9BC602(M, user+4)`：`[M+0x14]=user+4`；复制 `[0xBDD498]+0x24` 的 16 字节 → `M+0x138..0x144`（**地图边界 clamp 值的来源**，DIRECT-INSTRUCTION）。
3. `0x9BC622(M, 1, X, Y−10, 0, 0, flag, 0)`：写坐标+清速度；**不做立即重绑**。
4. 首 tick：[M+0x110]=0 → 碰撞查询族（0xA4F6F1 等）→ 找到 fh → `0x9BFB52(M, fh, rope?, ?)` 设段（见 T082-G41 报告 §3）。
5. arg7≠0 的调用者（E8 直调：0x9C3DEC[经 0x9C3DD1 wrapper = vtable slot1 转发]、0x9C999E、0x9CBE6C、0x9CFCD3）走立即 hint+吸附重绑。

**G38-B 裁决：VERIFIED（含修正）**——跨图创建新 move 对象、无立即重绑、首 tick 碰撞建段；"跨图 hint 复制+立即重绑" 仅适用于 arg7≠0 的（非 0x9507F0）调用路径。

### 2.3 0x9BC89F / 0x9BC992：坡面参数化与吸附写回（完整函数体，新）

`0x9BC89F(this=T, E=加密槽宿主基址, F=线对象)`（ret 8）：
```
若 (long)F.m1 > 0.5（0xAFEC20）:  t = (decrypt(E+0) − F.n1) / F.m1      # 主轴=水平
否则:                              t = (decrypt(E+0x18) − F.n2) / F.m2  # 主轴=垂直
加密写 T+0（key T+0x10）
tang = decrypt(E+0x30)(v1)×F.m1 + decrypt(E+0x48)(v2)×F.m2             # 速度与段方向点积
加密写 T+0x18（key T+0x28）
clamp: t = t < 0.0(0xAFECC0) ? 0.0 : (t > F.len ? F.len : t)；重加密写 T+0
```
`0x9BC992(this=T', T=M+0xE0, F)`（ret 8）：
```
X' = F.n1 + decrypt(T+0)×F.m1   → 加密写 T'+0x00（X 主槽, key T'+0x10）
Y' = F.n2 + decrypt(T+0)×F.m2   → 加密写 T'+0x18（Y 主槽, key T'+0x28）
v1' = decrypt(T+0x18)×F.m1      → 加密写 T'+0x30
v2' = decrypt(T+0x18)×F.m2      → 加密写 T'+0x48
```
其中 T=M+0xE0 是"段参数 t + 切向速度"加密对；T'=M+0x20 是 X/Y/v1/v2 主槽组；F.m1/F.m2 为段方向分量（对抗审：**单位方向**候选，F.len 为段长——loader 写入侧未直读，DERIVED）。

**吸附算法（DERIVED-FROM-INSTRUCTION，分支 DIRECT）**：`t = clamp((X−n1)/m1, 0, len)`（垂直主轴 `(Y−n2)/m2`），`X=n1+t·m1, Y=n2+t·m2`，速度投影 `v' = (v·m̂)·m̂`。查询用 X 还是 Y−10 的答案：**既不是 Y−10 也不重查**——用写入后的加密 X（水平主轴）/加密 Y（垂直主轴）直接参数化；Y−10 仅是写入值（t080 已证，对抗审进一步确认 −10 只存在于传送/抓绳调用方）。

### 2.4 无候选 Foothold / 水图 / 空中出生

- 跨图路径 arg7=0 时无任何候选查询——**静态上不存在"找不到 fh 的失败分支"于 0x9BC622 内**；落地由后续 tick 的碰撞族处理（G40 报告）。
- 水图（FSDB swim=1 的 8 图）：进入游泳状态的门在 Info/移动状态机（C-034 域），本轮无新指令证据；`NOT FURTHER RESOLVED THIS ROUND`。
- 空中出生：M+0x50/0x68 清零 + [M+0x110]=0 → 首帧即下落态（G40 报告 §1 越界分支）。

## 3. G38-C 状态复位（0x953FA5 身份裁定）

- `0x953FA5`（user 方法，SEH，大函数 0x953FA5–0x9546xx）操作的是 **[user+0x293C] 外观/动画对象**（大量 `0x6A05FF/0x6A0545` 加密 setter：写 1.0 到 anim+0x18/+0x30/+0x90±，`fild×0xAFECD0` 等）与 **fieldctx[0xBD9028]+0x2110 字符串/资源槽**（0x416DE8/0x426F51/0x429BFE/0x429944 查询）。**它是外观/动画层复位，不是移动状态复位**。
- 移动状态复位的真实机制 = 跨图时 **0x9D359D 新建 move 对象**（vx/vy/rope/foothold/stance 全新初值）；同图传送时仅 `0x9C111C [M+0x110]=0` + 四速度槽 fldz 清零（t080 已证 setter 序列）。
- rope/ladder、sit、prone、stance 字段的逐项清零写入**不发生在 0x953FA5**（其窗口内无 M 侧写）。sit 状态域 user+0x2944 系（t080 已证）由 0x9658CC 独立处理。
- **裁决：VERIFIED（负结论+真实机制）**——0x953FA5 ≠ 移动复位器；"新建对象"与"清段+清速度"分别覆盖跨图/同图。

## 4. G38-D opcode 绑定

**已闭合（新，DIRECT-INSTRUCTION）**：`0x9571BF` 是 opcode switch：
```
0x9571C5  eax = [ebp+8] − 0xCF
0x9571CA  cmp eax, 0x1D                  ; opcode ∈ [0xCF, 0xEC]
0x9571D3  jmp [eax*4 + 0x95732E]         ; 表 @0x95732E，30 项
```
**case 0（opcode 0xCF）→ 0x957201 → `call 0x9658CC`（座位写入器）**。0x9571BF 的调用链：`0x97FCC9`（`ecx=[this+8]`，双参转发）← 0x97FCBA thunk。**0xCF→0x9658CC 的客户端 dispatch 绑定从协议常量升级为指令级直证**。

**未闭合（OPEN-STATIC）**：opcode 0x81 → 0x97EBC9 的最后一环。已证链：`0x533FF1: ecx=0x548291(...) → call 0x97EBC9`；0x533FF1 所在函数 0x533EA4（SEH scope 0xA9AA4E）是 **15 个 vtable（0xB01414/0xB016B4/0xB01738/…/0xB02724 处 slot）共享的方法**，14 个 E8 调用者。**缺失环节**：这批 vtable 的对象构造/opcode 注册对静态镜像不可见（表地址无 imm 引用；注册疑经运行时表构造）。不再复制协议常量；登记缺失项为"handler-vtable→opcode 注册机制"。

## 5. G38-E Camera 更新顺序

本轮未展开任何 Camera 链指令窗口。**OPEN**（无新证据，不虚报）。

## 6. 裁决表

| 子行为 | 裁决 | 等级 |
|---|---|---|
| G38-A 同图重绑 = 清段+写坐标+通知，下一 tick 重绑 | VERIFIED（机制级） | DIRECT-INSTRUCTION |
| G38-A' [M+0x110] 头部清零 @0x9C111C | VERIFIED | DIRECT-INSTRUCTION |
| G38-A'' 0x53E95D=通用通知器(this=M)，非重绑 | VERIFIED | DIRECT-INSTRUCTION |
| G38-B 跨图 = 新 move 对象 + arg7=0 无立即重绑 + hint 清零 | VERIFIED（含对 t080 的参数错位修正） | DIRECT-INSTRUCTION |
| G38-B' 吸附算法 t=clamp((X−x1)/dx,0,tmax); X=x1+t·dx; v'=(v·d)·d | VERIFIED | DIRECT-INSTRUCTION + DERIVED |
| G38-B'' 地图边界源 [0xBDD498]+0x24 → M+0x138..0x144（0x9BC602） | VERIFIED | DIRECT-INSTRUCTION |
| G38-C 0x953FA5=外观/动画复位；移动复位=新对象机制 | VERIFIED（负结论） | DIRECT-INSTRUCTION |
| G38-D 0xCF→0x9571BF case0→0x9658CC | VERIFIED | DIRECT-INSTRUCTION |
| G38-D' 0x81→0x97EBC9 vtable→opcode 注册 | OPEN-STATIC（缺失：注册机制不可见） | — |
| G38-E Camera 顺序 | OPEN（未读） | — |

## 7. Residual

1. 0x81 dispatch 注册机制（OPEN-STATIC，下一地址：0xB01414 表宿主对象的构造器搜索 / 0x533EA4 的 14 个 E8 调用者共同上游）。
2. Camera 更新（G10 依赖，未开始）。
3. 首 tick 碰撞建段的精确函数（0x9BF1FA 越界分支 0x9BF3D0 族的部分窗口已读，见 G40 报告；完整闭合移 G40）。
