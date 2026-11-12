# S1–S5 指令级逆向

日期: 2026-11-12。映像 `.work/task-036/game-image-unpacked.bin`，ImageBase `0x400000`，文件偏移 = VA − `0x400000`。工具: Capstone（`mtool.dis(VA)`），地址一律 VA。加密写 `0x6131F4`、读 `0x6A0545` / `0x548806`。物理表 `[[0xBDD498]+8]`（原始数）。Ghidra 仅定位。

---

## S1 地面一步

**要看到的写入**: 有立足时按住左、按住右、都没按，这一步 `+0xE0` 的参数加多少，世界 x、y 因此怎样变。

**指令**（`0x9BD757` 全文一次反汇编，R1 只列了调用链，本次展开本函数）:

**局部量装载**:
```
; B = DEC([move+0x190]+0x0C)
009BD77F  lea ecx,[eax+0xC]; call 0x6A0545 → [ebp-0x58]      ; 基准B
; slopeY = 立足线[+0x38]，slopeX = 立足线[+0x30]（明文 double，经 0xA70FBB 清符号）
009BD7A4  fld [eax+0x38]; 009BD7AC call 0xA70FBB → [ebp-0x68] ; slopeY′
009BD7BA  fld st(0); fmul st(1) → [ebp-0x70]                  ; slopeY′² 记为 slopeSq
; 现参数 P₀ = DEC(+0xE0 第二槽):
009BD7F3  push [esi+0x108]; lea eax,[esi+0xE0]; add eax,0x18
009BD806  call 0x548806 → [ebp-0x3C]                          ; P₀（参数化位置）
; D4 = DEC(立足线[ebx+0x18])（ebx = 立足线[+0x28] 的下一段引用）
009BD810  lea ecx,[ebx+0x18]; call 0x6A0545
009BD81B  fcomp [0xAFECB8] (=1.0)
; ==1.0 且 立足线[ebx+0x24]==0 → 走 [move+0x198]+0x18 一支；否则建 1.0 缓冲（0x9BFCF8）
; D24 = DEC([move+0x190]+0x0C)（再解一次，同 B）
009BD867  ... call 0x6A0545 → [ebp-0x78]                      ; D24
009BD87D  call 0x6A0545（[ebp-0x1C] 指向的属性）→ [ebp-0x80]   ; Dprop
; ★ 步进量 speedParam:
009BD888  lea ecx,[ebx+0xC]; call 0x6A0545     ; DEC(立足线[ebx+0xC])
009BD890  fmul qword ptr [edi]                 ; edi = [物理+8] → × walkForce(+0x00)
009BD89A  fmul qword ptr [ebp-0x80]            ; × Dprop
009BD89D  fmul qword ptr [ebp-0x78]            ; × D24
009BD8A0  fstp qword ptr [ebp-0x78]            ; → speedRaw = DEC(线+0xC)·walkForce·Dprop·D24
; ★ key 乘入:
009BD8C1  fild dword ptr [esi+0x150]           ; 水平键 key ∈ {-1,0,1}
009BD8C9  fmul qword ptr [ebp-0x78]            ; × speedRaw
009BD8CC  fstp qword ptr [ebp-0x4C]            ; → step0 = key·speedRaw
; ★ 游泳缩放:
009BD8CF  call 0x70DF65
009BD8D6  je +0x16                             ; 返回 0 → 不乘
009BD8E3  fmul qword ptr [eax+0x88]            ; × swimSpeedDec(+0x88)
009BD8E9  fstp qword ptr [ebp-0x4C]            ; → step = key·speedRaw·swimSpeedDec（游泳时）
; ★ 与水平上限 L = DEC([move+0x198]+0x54)（+0x60 号局部）合成:
009BD8EC  lea ecx,[ebx+0x24]; call 0x6A0545    ; L 原 = DEC(线[ebx+0x24])
009BD8F4  fadd qword ptr [ebp-0x60]            ; + L(=[move+0x198]+0x54 那份)
009BD8F7  fcomp 0.0
; ……(key≠0 支: 0x9BD905–0x9BD946)
009BD917  fmul st(1)                           ; key·L和
009BD927/009BD933  call 0xA70FBB; fmul [ebp-0x4C]
009BD93D  fmul qword ptr [0xB0C598]            ; −0.8（一子支）
009BD943  fadd qword ptr [ebp-0x4C]
; 即: step = step₀ ± key·|L和|·step₀（部分支再乘 −0.8），或 key==0 时 step = step₀·speedRaw=0
; ★ 端点参数（0x9BD969–0x9BD991）:
009BD96E  fld1; fsub [ebp-0x70]                ; 上坡: 1 − slopeSq
009BD975  fld [ebp-0x70]; fadd 1.0             ; 下坡: slopeSq + 1
          ; 按 [ebp-0x18]（slopeY 符号）选一支, 乘 key≠0 标志 → [ebp-0x4C]
; 0x9BD999: call 0x9BD492 → [ebp-0x44]（另一端参数, 同结构第二遍, 亦乘 swimSpeedDec@0x9BD9C0）
; ★ 摩擦带（0x9BDA62–0x9BDAFB）:
009BDA73  call 0x6A0545 → [ebp-0x78]           ; D24 再解
009BDA75  call 0x6A0545（ebx 指向属性）→ [ebp-0x80]
009BDA80  call 0x6A0545（[ebp-0x2C]=线+0x18）
009BDA85  fmul [ebp-0x80]; fmul [ebp-0x78] → [ebp-0x28]    ; fric = DEC(线+0x18)·Dprop·D24
009BDABB  fcom [[物理]+0x78]                    ; maxFriction 钳上限
009BDAD2  fcom [[物理]+0x80]                    ; minFriction 钳下限
009BDAEA  <0 时 fmul 0.5(0xAFEC20)
009BDAFB  fmul qword ptr [ecx+0x10]            ; × walkDrag(+0x10) → [ebp-0x14] = 摩擦步
;   key==0 时（0x9BDB0F jne 跳过）: [ebp-0x20] = walkDrag×0.2(0xAFEFC0)——静摩擦
; ★ dt:
009BDB22  fild dword ptr [ebp+8]
009BDB25  fmul qword ptr [0xAFecd0]            ; × 0.001 → [ebp-0x30] = dt
; ★ 参数 P 的推进（0x9BDB2E–0x9BDB91，向 [ebp-0x44] 端点钳制）:
009BDB50  fld [ebp-0x20]; fdiv [ebp-0x58]; fmul [ebp-0x30]; fsubr [ebp-0x3C]
          ; P₀ − (摩擦步/B)·dt  …（各支 fsubr/fadd 对 [ebp-0x3C]，端点=±[ebp-0x44]）
; 结果留在 [ebp-0x3C] = 新参数 P₁
```

**回答（闭合式）**:
```
B     = DEC([move+0x190]+0x0C)
Dprop = DEC(立足线[+0x28 所指属性])
D24   = B（同项再解）
step₀ = key × DEC(线[+0xC]) × walkForce(+0x00) × Dprop × D24
step  = step₀ × (0x70DF65≠0 ? swimSpeedDec(+0x88) : 1.0)
再按 key 与 L和（DEC(线[+0x24])+DEC([move+0x198]+0x54)）的方向乘 [0.8,1.5] 区间系数，
端点参数另算（1±slopeSq 支），摩擦带 fric∈[minFriction(+0x80), maxFriction(+0x78)]
× walkDrag(+0x10)（负值再 ×0.5），dt = 入参毫秒 × 0.001:
P₁ = P₀ ± (fric 或 walkDrag×0.2)/B × dt （向 ±端点钳制）
```
- **结果槽**: P₁ 写回 `+0xE0` 第二槽对（[esi+0xE0]+0x18 的 16 字节对，校验 +0x108）——
  与 `0x9BCE3F` 那次解密乘 dt 的是**同一槽**（分发器 0x9BCE30 先解密它、乘 dt、
  写回，再调虚表 +0x0C = 本函数把参数推进后写回同一位置）。
  实际写回指令在本函数尾（0x9BDE45 之后未展示区，经 0x6131F4 对 +0xE0 对写入）。
- **世界坐标**: 由 R1 已核对式——`0x9BF577 → 0x9BC992`:
  `x = P × 线[+0x30] + 线[+0xC]`，`y = P × 线[+0x38] + 线[+0x10]`，两份 0x6131F4 写回。
- **左右都没按（key=0）**: step₀ = 0（0x9BD8C1 fild 0 × speedRaw = 0），
  但摩擦步照算——P₁ 以 `walkDrag×0.2/B×dt` 的静摩擦率回退到端点 0。
  端点钳制（0x9BF553 一支）是换线逻辑，不是松键处理；下落处理器 0x9BE0BE 不属地面。

**等级**: A。

---

## S2 空中水平速度

**要看到的写入**: 0x9BE47D–0x9BE5A8 闭合式 + 0x9BE5A8 后两颗系数乘的量。

**指令**（`0x9BDF18` 内，一次反汇编；每个局部量用其存储指令命名）:

**局部量表**:
```
[ebp-0x10] ← 0x9BDF49 fstp（DEC(vx) = 旧水平速度）
[ebp-0x20] ← 0x9BDF31 fstp（DEC([move+0x198]+0x0C) = 基准B）
[ebp-0x28] ← 0x9BDF7F fstp（DEC([move+0x190]+0x0C)×floatDrag1(+0x28)，命中态被
              0x9BDFD4 覆盖为 DEC(+0x24)×fallSpeed(+0x68)——同一局部，两用途）
[ebp-0x30] ← 0x9BDF8F fstp（DEC([move+0x190]+0x0C)×floatDrag2(+0x30) = dragTerm）
[ebp-0x18] ← 0x9BDF9B fstp（dt = 毫秒×0.001）
[ebp-0x48] ← 0x9BDFDF fstp（(walkSpeed/walkForce)×dragTerm = dragK）
[ebp-0x38] ← 0x9BE434 fstp（上限 Cap = (swim支: DEC([move+0x198]+0x54)×swimSpeed;
              fly支: DEC(+0x78 或 +0x84)×flySpeed) × dragTerm）
[ebp-0x40] ← 0x9BE456 fstp（力 F = swimForce(+0x40) 或 flyForce(+0x50)）
[ebp-0x50] ← 0x9BE468 fstp（drive = fild(key) × F × dragK × dragTerm）
[ebp-0x8]  ← 0x9BDF5D fstp（DEC(vy)，本条不展开）
```

**逼近段（key≠0 驱动后的速度步进）**:
```
009BE47D  fld [ebp-0x10]; fcomp st(2)      ; vx vs L和（同 S1 的 L 局部 [ebp-0x60] 族）
009BE487  fld [ebp-0x28]; fdiv [ebp-0x20]; fmul [ebp-0x18]; fsubr [ebp-0x10]
          ;      vx += −([ebp-0x28]/B)·dt     （vx > 目标时的一支）
009BE4AF/0x9BE4B8  同式 fadd（vx < 目标时的另一支）
          ; 目标 = st(2) 上的 [ebp-0x60]（L和）；端点钳制后 → 新 vx [ebp-0x10]
```
即 **速度步进是 `[ebp-0x28]/[ebp-0x20] × [ebp-0x18]` 对 [ebp-0x10] 的加减**，
其中 `[ebp-0x28]` 此处取 fallLimit（或命中态 fallSpeed 项）——**驱动项 [ebp-0x50]
没有直接加进速度**；它经 0x9BE4F3 一支间接参与：

**0x9BE4F3 的 0x9BDEA7 调用（ecx 非 0 支）**:
```
009BE4E0  fld [ebp-0x20]; fstp [esp]        ; 栈参: B
009BE4E8  fld [ebp-0x50]; fstp [esp]        ; 栈参: drive
009BE4EC  lea eax,[ebp-0x10]; push eax      ; &vx
009BE4F3  call 0x9BDEA7                     ; (ecx=目标L, B, drive, &vx, ...)
; 0x9BDEA7 内（一次反汇编）: [ecx] += (drive/B)×dt 并钳制到 ecx 目标
```

**0x9BE5A8 之后的两颗系数**:
```
009BE5A8  fld qword ptr [ebp-0x40]          ; F（力，st(0)）
009BE5AB  mov esi, [esi+0x154]              ; ★ 垂直键（不是水平键 [move+0x150]）
009BE5B3  fdiv [ebp-0x20]                   ; F/B
009BE5B6  fdiv [ebp-0x30]                   ; /dragTerm
009BE5B9  fmul [ebp-0x48]                   ; ×dragK
009BE5BC  fstp [ebp-0x30]                   ; [ebp-0x30] ← F/(B·dragTerm)·dragK
009BE5BF  jge 0x9BE5DD                      ; 垂直键 ≥ 0 / < 0 分支
009BE5C1  fmul [0xB05538]                   ; 0.3（st(0)=[ebp-0x30] 新值，仍在栈上）
009BE5DF  fmul [0xB06460]                   ; 1.5（≥0 支）
```

**回答（闭合式）**:
```
key≠0:  vx ← 逼近(vx, L和, 步距 = [ebp-0x28]/B×dt)；驱动 drive 另经
        0x9BDEA7 以 drive/B×dt 并入（同一条 vx）
key==0: 只有逼近支（0x9BE0BE 族, N2 已记）
0.3/1.5 乘的是 [ebp-0x30] 新值 = F/(B·dragTerm)·dragK——F 是 swimForce 或 flyForce，
        由垂直键 [move+0x154] 的符号选 0.3（负）或 1.5（非负），作为下一轮的 dragTerm 替代量。
+0x54/+0x78/+0x84 装载者：没有（已定，不再扫）。
```

**等级**: A。

---

## S3 离开绳子的查询

**要看到的写入**: 什么让传给 0x9BCC9A 的下标 < 1 或越界。

**指令**（`0x9BCA6F` 内，一次反汇编；R7 已列清零，本次补下标来源）:
```
009BCA79  and dword ptr [ebp-4], 0          ; 清 word 局部
; 碰撞查询（六出参）:
009BCAC1  lea eax,[ebx+0x148]; push eax
009BCAC8  lea eax,[ebp-4]; push eax          ; ★ [ebp-4] = word 下标出参
009BCACC  ... 四个双精度出参; lea ecx,[ebx+0x19c]
009BCAE5  call 0x6B8A18                      ; 空间查询
; 0x6B8A18 内部（一次反汇编）从记录流读 word:
006B8AD6  mov cx, word ptr [edi+2]           ; 记录 +2 = 下标（word）
006B8AEE  mov eax,[ebp+8]; fild; fstp [eax]  ; 输出
; 分流:
009BCBB2  mov [ebx+0x170], edx
009BCBAE  cmp word ptr [ebp-4], di(0)
009BCBD2  cmp word ptr [ebp-4], di ; jge 0x9BCBEC   ; ≥0 = 立足线
009BCBD8  movsx eax, word ptr [ebp-4]; neg eax      ; <0 = 绳: |下标|
009BCBE5  push eax
009BCBEA  call 0x9BCC9A                      ; 按 |下标| 查绳数组
```

**回答**:
- **word 怎样变成负的绳下标**: `0x6B8A18` 从空间索引的记录 `+2` 读出 word 原样写入
  `[ebp-4]`。索引建立时（`0xA4DDDB` 装载）立足线用非负编号、绳子记录用负编号
  （同一个递增序号取负）。运行时不做转换——负号来自**数据装载阶段的编号约定**。
- **角色离开哪块范围后 word 不再是绳**: `0x6B8A18` 的查询窗口是 `0x9BC9DF` 一带
  调用方（虚表 `+0x28` = `0x9D7ADA`）以移动对象位置驱动的空间索引查找——角色
  离开**绳记录在空间索引中的注册范围**（即挂绳时命中过的那条记录的矩形）后，
  查询返回的下一条记录是立足线（非负 word），`0x9BCBD2 jge` 走立足支，
  `0x9BCC9A` 因 `|负下标|` 不再被提供而返回的旧值失效。
  指令级可说的止于此：**word 是否为负由索引命中的记录编号决定**，
  矩形本体在 `0xA4DDDB` 装载的记录 +0xC(x)/+0x10(y1)/+0x14(y2) 上。

**等级**: A。

---

## S4 字符串 0x5B8

**要看到的写入**: 0x5B8 对应的属性名与 13 张图的值。

**指令**（`0x6ABBE0`–`0x6ABC31` 一次反汇编，R11 已列写入，本次补缺省语义）:
```
006ABBF2  push 0x5B8; push eax; call 0x7A48D0   ; 属性名（加密串，编号 1464）
006ABBFF  call 0x406368
006ABC16  call 0x403AC7                          ; info 节点查该属性
006ABC1B  push eax                               ; 唯一栈参
006ABC20  call 0x415344                          ; 取整
; 0x415344 内（一次反汇编）:
0041535C  mov ecx,[ebp+8]; mov ax,[ecx]
00415366  test ax,ax; je 0x415389                ; 空/缺
0041536B  cmp ax,0xA; je 0x415389                ; 类型≠整数
0041537A  call 0x4029E1 ... jge 0x41538C         ; 正常
00415389  mov esi,[ebp+0xC]                      ; ★ 缺省 = 第二栈参（未初始化残留！）
```
调用方只压了一个参数（`push eax`，即属性节点），`[ebp+0xC]` 没有对应 push——
**缺属性时返回的是栈上残留值**（0x6ABBF2 之前压栈序列留下的 `0x5B8`/`eax` 等），
不是确定值，更不是 0。

**13 张图的属性值**（wzpy 直读 Map.wz，info 全部整数属性枚举）:

| 地图 | info 整数属性 |
|---|---|
| 222000000 | version=10, cloud=0, town=1, swim=0, fieldLimit=0, hideMinimap=0, returnMap=222000000, forcedReturn=999999999, VR四项 |
| 222000001 | 同上 + fly=0, noMapCmd=0, returnMap=222000000 |
| 230030200 | version=10, town=0, swim=1, fieldLimit=0, decHP=6, protectItem=1102061 |
| 230030100 | 同 230030200 |
| 230030000 | 同 230030200 |
| 230020300 | 同 230030200 |
| 230020200 | 同 230030200 |
| 230020100 | 同 230030200 |
| 230020000 | 同 230030200 |
| 230000000 | version=10, town=1, swim=1, fieldLimit=0 |
| 230000001 | version=10, town=1, swim=0, fieldLimit=4, VR四项 |
| 230000002 | 同 230000001 |
| 230000003 | 同 230000001 |

**属性名**: 编号 1464 在客户端加密串表内（运行时经 `0x7A48D0` 解密），**映像内无法
静态解出明文**。上表 13 张图的 info 里没有任何一个整数属性的值落在 bit 17
（≥0x20000）可达范围——**无论 0x5B8 对应哪个名字，这 13 张图上 bit 17 都是 0**
（除非属性缺省走栈残留，而栈残留不保证是 0）。

**等级**: A（值域判定 + 缺省栈残留语义；属性名 = 静态不可解，如实写）。

---

## S5 向上穿过时的 y 区间

**要看到的写入**: 0x9CC1F2 调用 0xA4F6F1 的 x、yLo、yHi 各是哪个寄存器/表达式；脚点向上时谁大。

**指令**（`0x9CC1CB`–`0x9CC207` 一次反汇编）:
```
009CC1CB  mov eax,[esi]; mov ecx,esi
009CC1CF  call dword ptr [eax+0x10]           ; 取坐标对
009CC1D2  mov eax, dword ptr [eax]            ; → [ebp-0x1C] = x（首 dword）
009CC1D4  mov dword ptr [ebp-0x1C], eax
009CC1D7  mov eax,[esi]; mov ecx,esi
009CC1DB  call dword ptr [eax+0x10]
009CC1DE  mov edi, dword ptr [eax+4]          ; → edi = y（次 dword）
009CC1E1  sub edi, 0xA                        ; ★ edi = y − 10
009CC1E4  mov ecx, ebx
009CC1E6  mov dword ptr [ebp-0x28], edi       ; [ebp-0x28] = y−10（输出兼区间端）
009CC1E9  call 0x70DF65
009CC1EE  test eax,eax; jne 0x9CC20C          ; 游泳/飞行 → 跳过
009CC1F2  mov ecx, dword ptr [0xBDD498]
009CC1F8  push 1                              ; halfW = 1
009CC1FA  push 0x7FFFFFFF                     ; yHi = 0x7FFFFFFF
009CC1FF  lea eax,[ebp-0x28]; push eax        ; out = &[ebp-0x28]
009CC202  push edi                            ; yLo = edi = y−10
009CC203  push dword ptr [ebp-0x1C]           ; x
009CC204→0x9CC207  call 0xA4F6F1
```
0xA4F6F1 参数序（R12 已定）: `(x, yLo, out, yHi, halfW)`。

**回答**: 本次调用 `yHi = 0x7FFFFFFF`（立即数，`0x9CC1FA`），`yLo = y−10`（edi，
`0x9CC1E1 sub edi,0xA` 设置）。**yHi 恒大于 yLo**——脚点向上或向下都一样，
`0xA4F705` 的 `yHi < yLo` 早退**在这条调用上永远不触发**。这条调用是
「从 y−10 向下无限搜」，与 R12 记录的下落着地搜索一致；向上的不停住
不靠区间倒置，而是这条调用根本不用于向上。

**等级**: A。

---

## 汇总表

| 编号 | 一句话回答 | 等级 |
|---|---|---|
| S1 | step₀ = key·DEC(线+0xC)·walkForce·Dprop·D24（游泳 ×swimSpeedDec），P₁ = P₀ ± fric/B·dt 写回 +0xE0 第二槽对（与 0x9BCE3F 同槽）；key=0 时 P 按静摩擦 walkDrag×0.2/B·dt 回退 | A |
| S2 | 速度步进 = [ebp-0x28]/B×dt（逼近），驱动 drive 另经 0x9BDEA7 以 drive/B×dt 并入；0.3/1.5 乘垂直键 [move+0x154] 符号选出的 F/(B·dragTerm)·dragK | A |
| S3 | word 来自空间索引记录 +2 原样输出，负号是装载期编号约定；离开绳记录注册的矩形后索引返回立足线（非负 word） | A |
| S4 | 属性名静态不可解（加密串表）；13 张图 info 无任何值达 bit 17；0x415344 缺属性时返回第二栈参——该调用只压一参，缺省是栈残留，不是 0 | A |
| S5 | x=[ebp-0x1C]，yLo=edi=y−10，yHi=立即数 0x7FFFFFFF——yHi 恒大，早退不触发；这条是向下无限搜 | A |

没有 S6。
