# N1–N8 指令级逆向：像素距离与换帧

日期: 2026-11-11。映像 `.work/task-036/game-image-unpacked.bin`，ImageBase `0x400000`，文件偏移 = VA − `0x400000`。
工具: Capstone（`mtool.dis(VA)`）。加密读写只跟 `0x6131F4`（写）、`0x6A0545` / `0x548806`（读）。
物理表在 `[[0xBDD498]+8]`，偏移按 MAP-PHYSICS-FIELDS.md。反编译不作为结论。

不重开清单以任务卡与 `MAP-MOTION-REVERSE.md`、`MAP-M1-M16-REVERSE.md` 为准。

---

## N1 行走逐步（0x9BE703 尾部之前）

**要看到的写入**: walkForce/walkSpeed/walkDrag 乘进水平速度；速度写哪一对加密槽；水平键怎样进式子；dt 乘在哪一步。

**指令**（`0x9BE703` 入口 → `0x9BEE0B` 之前，共 500 条，全段扫描）:

```
; 唯一的 [0xBDD498] 读取及其去向：
009BE72F  mov eax, dword ptr [0xbdd498]
009BE735  mov dword ptr [ebp-0x98], eax        ; 存物理指针
; ……后仅两处使用：
009BE873  mov eax, [ebp-0x98]; lea ecx,[eax+0x44]
009BE888  call 0x5114AA                        ; 矩形排序查询（容器），不是物理乘
009BE908  mov ecx, [ebp-0x98]
009BE90E  cmp eax, dword ptr [ecx+0x40]        ; 记录 id 比较，不是物理乘
; FPU 内存运算只有取整常数：
009BE74D/009BE77C/009BE7AB/009BE7E0  fadd qword ptr [0xafec20]   ; 0.5（取整）
009BE755/009BE784/009BE7B3/009BE7E8  fsub qword ptr [0xb00d60]   ; 0.4999…（取整）
; 调用表（去重）：0x548806×13、0xA70F94×5、0x9BF7EA、[edx+0x18]×1、0x5114AA、[eax]×1、
;   0x9BF144×2、0xA70B13×2、0xA718D0——无 0x6131F4，无 0x6A0545
; fild 目标全部是局部整数（立足线坐标），无 dt 换算
```

**回答**: **没有这条写入**。`0x9BE703` 入口到尾部之前的整段里：
- 没有 `fmul [物理表+0x00/+0x08/+0x10]`（walkForce/walkSpeed/walkDrag 均未出现）；
- 没有任何 `0x6131F4` 调用（速度槽不写）；
- 没有读 `+0x150`（水平键不进这段）；
- 没有 `fild dt × 0.001`。
`[0xBDD498]` 的两次使用是容器查询（0x5114AA 排序、id 比较），不是物理项。行走段把解密
结果与立足斜率做几何比较，真正写速度/坐标的部分在已记录的 `+0xE0` 尾部（不重写）。
没有 140000 参与的任何指令。

**等级**: A。

---

## N2 下落逐步的完整式子

**要看到的写入**: 四项怎样加减、写回哪一对速度槽；dt 出现几次。

**指令**（`0x9BDF18` 全文 + 被它调用的 `0x9BDEA7`，一次反汇编）:

**局部量装载**（edi = move+0x20，即 edi+0x00/0x18/0x30/0x48 = 绝对 +0x20/+0x38/+0x50/+0x68）:
```
009BDF2C  call 0x6A0545            ; decrypt([move+0x198]+0x0C) → [ebp-0x20]（基准）
009BDF3E  call 0x548806            ; DEC(edi+0x30)=v0x → [ebp-0x10]
009BDF4D  call 0x548806            ; DEC(edi+0x48)=v0y → [ebp-8]（edi+0x48/+0x58 = 绝对 +0x68/+0x78 对）
009BDF69  call 0x6A0545            ; decrypt([move+0x190]+0x0C)
009BDF6E  fmul qword ptr [ebx+0x28] ; × floatDrag1  → [ebp-0x28] = fallLimit
009BDF85  call 0x6A0545            ; decrypt([move+0x190]+0x0C)（同一项再解一次）
009BDF8A  fmul qword ptr [ebx+0x30] ; × floatDrag2  → [ebp-0x30] = dragTerm
009BDF92  fild dword ptr [ebp+8]
009BDF95  fmul qword ptr [0xafecd0] ; dt = 毫秒 × 0.001 → [ebp-0x18]
009BDF9E  call 0x979AA8            ; 状态分支门
009BDFBC  call 0x6A0545            ; decrypt([move+0x190]+0x24)
009BDFC1  fmul qword ptr [ebx+0x68] ; × fallSpeed → [ebp-0x28]（命中状态时覆盖 fallLimit）
009BDFD7  fld qword ptr [ebx+8]     ; walkSpeed
009BDFDA  fdiv qword ptr [ebx]      ; ÷ walkForce
009BDFDC  fmul qword ptr [ebp-0x30] ; × dragTerm → [ebp-0x48] = dragK
```

**竖直积分**（`0x9BDEA7` 带钳制，被 0x9BE0A5 调用）:
```
009BE091  call 0x6A0545            ; decrypt([move+0x190]+0x24)
009BE096  fmul qword ptr [ebx+0x60] ; × gravityAcc
009BE09E  fmul qword ptr [ebp-0x20] ; × 基准
      → 0x9BDEA7(&vy, dragTerm, 基准, dt, …):
009BDED6  fdiv qword ptr [ebp+0x14] ; dragTerm ÷ 基准
009BDED9  fmul qword ptr [ebp+0x24] ; × dt
009BDEDC  fadd qword ptr [ecx]      ; + 当前 vy   （向 fallLimit 钳制）
```
另有 `[esi+0x174] × jumpSpeed(+0x70) × 0.001`（0x9BDFF2，dt 第二次出现）作为初速替换。

**水平项**（0x70DF65 门，一次反汇编已在 M4 记录）:
```
009BE3E5/009BE403  decrypt([move+0x198]+0x54) × swimSpeed(+0x48)      ; 游泳水平上限
009BE40B/009BE42C  decrypt([move+0x198]+0x78/0x84) × flySpeed(+0x58)  ; 飞行水平上限
009BE42F  fmul qword ptr [ebp-0x30]  ; × dragTerm → [ebp-0x38]
009BE448  fld qword ptr [eax+0x40]   ; swimForce（游泳分支）
009BE44D  fld qword ptr [eax+0x50]   ; flyForce（飞行分支）
009BE45C  fild dword ptr [ebp+8]     ; 水平键（[move+0x150]，0x9BE0AD 读入）
009BE45F  fmul qword ptr [ebp-0x40]  ; × 力
009BE462  fmul qword ptr [ebp-0x48]  ; × dragK
009BE465  fmul qword ptr [ebp-0x30]  ; × dragTerm → [ebp-0x50] 水平驱动
; 随后 0x9BE4CC–0x9BE5A8 用 dragTerm/dragK × dt 向上限逼近（钳制），含 0.5(0xAFEC20) 因子
```

**坐标与速度写回**（尾部）:
```
; x（edi+0x00 槽对，校验 edi+0x10）：
009BE660  call 0x548806             ; DEC(x)
009BE66F  call 0x548806             ; DEC(v0x)
009BE674  fadd qword ptr [ebp-0x10] ; v0x + 新 vx
009BE67C  fmul qword ptr [ebp-0x18] ; × dt
009BE67F  fmul qword ptr [0xafec20] ; × 0.5（梯形）
009BE685  fadd qword ptr [ebp-0x50] ; + x
009BE68F  call 0x6131F4 → [edi+0x10]（校验）
; y（edi+0x18 槽对，校验 edi+0x28）：0x9BE69E–0x9BE6CE 同形，[ebp-8] 为新 vy
; 新 vx/vy 写回：
009BE6D6  lea ecx,[edi+0x30]; 0x9BE6E1 call 0x6131F4 → [edi+0x40]（vx 校验）
009BE6E9  lea ecx,[edi+0x48]; 0x9BE6F4 call 0x6131F4 → [edi+0x58]（vy 校验）
```

**回答（逐项可代）**:
```
dt          = 入参毫秒 × 0.001                （0x9BDF95；0x9BDFFB 再现一次）
fallLimit   = DEC([move+0x190]+0x0C) × floatDrag1(+0x28)      或（命中态）DEC(+0x24) × fallSpeed(+0x68)
dragTerm    = DEC([move+0x190]+0x0C) × floatDrag2(+0x30)
dragK       = walkSpeed(+0x08) / walkForce(+0x00) × dragTerm
vy         += (DEC([move+0x190]+0x24) × gravityAcc(+0x60) × 基准) / 基准 × dt   （0x9BDEA7 钳制到 fallLimit）
水平上限    = DEC([move+0x198]+0x54) × swimSpeed(+0x48)  （游泳）或 DEC(+0x78/0x84) × flySpeed(+0x58)（飞行）
水平驱动    = 水平键([move+0x150]) × (swimForce(+0x40) | flyForce(+0x50)) × dragK × dragTerm
x' = DEC(x) + (DEC(v0x) + vx_new) × dt × 0.5 → ENC(+0x20 槽对, 校验 +0x30)
y' = DEC(y) + (DEC(v0y) + vy_new) × dt × 0.5 → ENC(+0x38 槽对, 校验 +0x48)
vx_new → ENC(+0x50 槽对, 校验 +0x60)；vy_new → ENC(+0x68 槽对, 校验 +0x78)
```
dt 出现位置：`0x9BDF95`（主换算）、`0x9BDFFB`（初速）、`0x9BE48D/0x9BE4B5/0x9BE516/0x9BE538`
（水平逼近）、`0x9BE67C`、`0x9BE6BB`（梯形）——共 8 处乘法点。四个 decrypt 项保持符号
（见 N5）。单位没有指令证明，不写 px/s。

**等级**: A。

---

## N3 同一次分发里的坐标

**要看到的写入**: 哪条 `0x6131F4` 把水平量写进人物 `+0x20`（校验槽一并写出），哪条写 `+0x38`；式子里乘的是速度还是别的槽。

**指令**（分发 `0x9BCD6C` 本次调用的子函数中，唯一写绝对 `+0x20/+0x38` 的位置——
下落处理器尾部，见 N2 引用）:
```
009BE65C  push dword ptr [edi+0x10]      ; x 校验字
009BE65F  push edi                       ; edi = move+0x20 → x 槽对基址
009BE660  call 0x548806                  ; DEC(x)
009BE668  push dword ptr [edi+0x40]
009BE66B  lea eax, [edi+0x30]            ; vx 槽对（绝对 +0x50）
009BE66F  call 0x548806                  ; DEC(v0x)
009BE674  fadd qword ptr [ebp-0x10]      ; + 本帧新 vx
009BE67C  fmul qword ptr [ebp-0x18]      ; × dt
009BE67F  fmul qword ptr [0xafec20]      ; × 0.5
009BE685  fadd qword ptr [ebp-0x50]      ; + 旧 x
009BE68F  call 0x6131F4                  ; ENC 写 x 槽对
009BE694  mov dword ptr [edi+0x10], eax  ; x 校验字
; y 同形：0x9BE697–0x9BE6CE，槽对 edi+0x18（绝对 +0x38），校验 [edi+0x28]（绝对 +0x48）
```

**回答**: `0x9BE68F` 写 `+0x20` 槽对（校验 `+0x30`），`0x9BE6CE` 写 `+0x38` 槽对（校验 `+0x48`）。
式子乘的是 **（旧速度 + 本帧新速度）× dt × 0.5**（梯形），加在解密后的旧坐标上。
前提：本次分发走下落分支（无立足/0x9BDF18）。行走分支的坐标走已记录的 `+0xE0` 参数化尾部，
不在本条重写。传送函数（0x954B58/0x53FF69/0x963D89）排除，未涉及。

**等级**: A。

---

## N4 游泳逐步读的是哪几个物理字段

**要看到的写入**: `+0x40 swimForce`、`+0x48 swimSpeed`、`+0x88 swimSpeedDec` 有没有在逐步路径上被乘。

**指令**（对 `0x9BE703`（行走，入口→0x9BEE0B）与 `0x9BDF18`（下落）全文扫描
`fmul/fld [物理表+0x40/+0x48/+0x88]`）:
```
walk (0x9BE703): +0x40 NONE, +0x48 NONE, +0x88 NONE
fall (0x9BDF18):
009BE403  fmul qword ptr [eax+0x48]      ; swimSpeed —— 游泳水平上限项
009BE448  fld  qword ptr [eax+0x40]      ; swimForce —— 水平驱动项
009BE45C  fild dword ptr [ebp+8]         ; 水平键
009BE45F  fmul qword ptr [ebp-0x40]      ; × swimForce
fall +0x88: NONE
```
（eax = `[[0xBDD498]+8]`，0x9BE3FB/0x9BE43E 两处装载；`0x70DF65` 门控见 M4。）

**回答**: 游泳逐步用 **swimForce(+0x40)** 与 **swimSpeed(+0x48)** 两个（都在下落处理器的
水平项里，经 `0x70DF65` 游泳门）。**swimSpeedDec(+0x88) 两个处理器都没有读**——没有这条写入。
行走处理器三个都不读（见 N1）。起跳式子（0x9BD42D 一族）不含在内（不重开）。

**等级**: A（swimSpeedDec = 否定式）。

---

## N5 四个 decrypt 槽的数从哪来

**要看到的写入**: 创建或进图时，谁把数装进 `[move+0x190]+0x18/+0x24` 和 `[move+0x198]+0x48/+0x6C`。

**指令/扫描**:
- M5 已定：全映像无 `[reg+0x190]` 的 mod10 存储指令；`[reg+0x198]` 仅 `0x5FFF96`
  （`mov [eax+0x198], esi`，esi 来自 `0x415344` 的 0/1 收敛）——0/1 不是加密双精度的来源，对象不符。
- 本次补查：全映像 182 处 `0x6131F4` 调用中，前置 `lea ecx,[reg+0x18/+0x24/+0x48/+0x6C]`
  的 70 处全部落在移动对象自身槽区（esi/edi/ebx 基址即 move 的 +0x20 起的四对槽），
  没有任何一处 ecx 来自 `[move+0x190]` 或 `[move+0x198]` 的解引用链。

**回答**: **没有**。装载者不在映像静态可见——`+0x190/+0x198` 指向的记录对象没有静态构造点，
其内容（含四个加密双精度）经反序列化/服务端数据到达，写入指令不在本映像。
N1/N2 的式子里这四项保持符号：`D₁₈=DEC([move+0x190]+0x18)`、`D₂₄=DEC([move+0x190]+0x24)`、
`D₄₈=DEC([move+0x198]+0x48)`、`D₆C=DEC([move+0x198]+0x6C)`。不用 walkForce、jumpSpeed 或 555 填。

**等级**: A（否定式）。

---

## N6 `0x7ACCFF` 的钳制限值

**要看到的写入**: 与 dx、dy 比较的立即数或内存常量；超过之后写成哪个值。

**指令**（0x7ACD28–0x7ACDF8 全部比较）:
```
007ACD31  fcom  qword ptr [0xafecc0]      ; 0.0 —— 方向判定
007ACD3C  fcom  qword ptr [ecx+0x180]     ; 与累加器当前值比较
007ACD52  fcomp st(1)                     ; 与和值比较
007ACD81  fcom  qword ptr [ebp+8]         ; ★ 与入参 dx 本身比较
007ACD8E  fstp  qword ptr [ecx+0x180]
; dy 同形：0x7ACD9B(0.0)、0x7ACDA6([ecx+0x188])、0x7ACDBC(st1)、0x7ACDEB([ebp+8])、0x7ACDF8
```
映像内该窗口的比较内存量只有 `0xAFECC0`（=0.0，方向判定用）。此外没有别的立即数或常量。

**回答**: **没有独立的钳制限值**。钳制的边界就是**传入的 dx/dy 参数本身**（`[ebp+8]` /
`[ebp+0x10]`，0x7ACD81/0x7ACDEB）：累加结果超过入参时写成入参值；方向由与 0.0 的比较决定。
没有 0.3/1.5 等常数参与钳制（0xB05538=0.3、0xB06460=1.5 出现在下落处理器的水平键选速
`0x9BE5C1/0x9BE5DF`，不在 `0x7ACCFF` 窗口内）。不自造上限。

**等级**: A。

---

## N7 背景换帧

**要看到的写入**: `0x43715C` 返回值在背景绘制路径的使用点；ani 为 1 时各帧 delay 的累加槽、帧号写入偏移、循环或停末帧。

**指令**:
```
; 0x43715C 在背景函数（0x669397–0x66A8D5）内唯一调用点：
0066A564  mov ecx, dword ptr [ebp-0x14]   ; layer 对象
0066A567  call 0x43715C                   ; 返回 dword
0066A56C  mov ecx, eax
0066A56E  mov eax, 0x4e20                 ; 20000
0066A574  idiv edi                        ; ÷ |rate|
0066A576  add ecx, eax                    ; 返回值 + 步长 → [ebp-0x1C]（滚动累加）
; —— 返回值只进滚动，无帧号写入
; ani 分支的动画交接（加载函数内）：
0066A0E3  call 0x66B544                   ; moveType/moveR/moveW/moveH/moveP（位移属性）
0066A136  call dword ptr [eax+0x110]      ; ★ 动画画布列表交给 layer 对象运行时方法
; 静态映像中没有 delay 累加指令，没有帧号偏移的写入指令
```

**回答**: **没有这条写入**。`0x43715C` 的返回值在背景路径只参与滚动
（`+20000/|rate|`，已记录不重开）。动画帧序列在 `0x66A136` 经虚表 `+0x110` 交给运行时
layer 对象；delay 累加与帧号推进都在该运行时方法内，**静态不可达**。不把 20000/|rate|
当成换帧周期，不给无 delay 的帧补毫秒。

**等级**: A（否定式：返回值只参与滚动 + 方法体静态不可达）。

---

## N8 传送门画面换帧

**要看到的写入**: MapHelper `portal/game/pv` 与带 delay 的 helper 帧被画出的那条更新里，帧号写入偏移与 delay 比较。

**指令**:
```
0071ACAF  push 0x602                      ; 字符串号 = portal/game/pv 路径（0x71ACAF 装载函数）
0071AD04  call 0x7A48D0                   ; 取串后走属性链构建画布列表
; 唯一调用点：
0071A961  mov ecx, dword ptr [ebp-0x20]
0071A968  call 0x71ACAF                   ; 得到 pv 画布
0071A96D–0071A983  push 序列 →
0071A983  call 0x43286E                   ; 直接交给绘制 API
; 之后 0x71A994/0x71A99F 取 [eax+0xC]/[eax+0x10]（记录字段）继续组绘制参数
; 整条路径无 delay 比较、无帧号偏移写入
```

**回答**: **没有这条写入**。pv 画布在 `0x71A968` 取得后直接交给 `0x43286E` 绘制；
帧推进不在静态路径上（与 N7 同因，运行时 layer 对象）。pt 9 的门字段 delay（+0x2C）
与 pt 12 效果偏移不混入。

**等级**: A（否定式）。

---

## 汇总表

| 编号 | 结论 | 等级 |
|---|---|---|
| N1 | 没有这条写入：行走段（0x9BE703→尾部前）无物理表乘、无 0x6131F4、无键、无 dt | A |
| N2 | 完整式子已列出（fallLimit/dragTerm/dragK/梯形坐标写回，dt×8 处）；单位不写 | A |
| N3 | 0x9BE68F 写 +0x20（校验 +0x30）、0x9BE6CE 写 +0x38（校验 +0x48），式子 = 旧坐标 +（旧速度+新速度）×dt×0.5 | A |
| N4 | swimForce(+0x40) 与 swimSpeed(+0x48) 在下落水平项（经 0x70DF65 门）；swimSpeedDec(+0x88) 两处理器都没有读 | A |
| N5 | 没有：四个槽的装载者不在映像；式子保持 D₁₈/D₂₄/D₄₈/D₆C 符号 | A |
| N6 | 没有独立限值：钳制边界即传入的 dx/dy 本身（[ebp+8]/[ebp+0x10]）；方向与 0.0 比较 | A |
| N7 | 没有这条写入：返回值只进滚动；动画经虚表 +0x110 交运行时对象，静态不可达 | A |
| N8 | 没有这条写入：pv 直接交 0x43286E 绘制，无 delay 比较、无帧号写入 | A |

没有 N9。
