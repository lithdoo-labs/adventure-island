"""T090: append t090 refinements to the GAP-REGISTER G36/G37/G39/G10 rows and
add the t090 round section. Idempotent."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REG = REPO / "research/result/REVERSE-ENGINEERING-GAP-REGISTER.md"

t = REG.read_text(encoding="utf-8")
if "t090" in t and "C-117" in t:
    print("already applied")
    raise SystemExit

APPEND = """
## T090 轮次增补（2026-11-16，WZ Timing & Camera Provenance）

| ID | 状态 | t090 增补 |
|---|---|---|
| G10 | PARTIAL-STATIC（不变） | **滤波消费链闭合（C-116/EV-106）**：滤波提交在共享相机 Vector2D 上创建动画 wrapper（[this+0x24]，ctor 0x51407340）；X/Y getter（+0x20/+0x28）在 wrapper 存在时经 0x51406ADC 解析器——内联泵引擎 0x51406CF7（应用滤波/插值/视差记录）并返回滤波坐标（w+0x70/+0x74）；立即 Set 在武装态变为增量存储（0x51407A34）保持滤波位移；scene-cull slot15 与 world→screen 结构性地消费滤波坐标；EXE `call [reg+0xA4]` 普查=0（滤波系数从不被 EXE 查询）。焦点写入者调用表精化（C-119）：8/10 arg3=0（含 0x990E21/0x990E91 的 esi=0 勘误）、0x959493 为调用者依赖、0x98DC43 与滤波武装同处 [0xBDD460] 全局上下文。25 个残余 slot90 站点分类：18 SHARED-WRITE-CONTEXT-POSSIBLE + 7 RECEIVER-OTHER-POSSIBLE（各有具体静态原因；接收者均为指针解引用，确切对象链路未追）。残项：[[arg3]+0x14] 写入者普查、arg3↔F28 关系（F28 直接写者仅 ctor-zero 0x934443——盲审普查）、E2/E3 泵相位、wrapper 场景切换持续性。 |
| G36 | PARTIAL-STATIC（不变） | **+0x9C (0x514086B3) 完整解码（C-118）**：ret 0x34（this+12 栈参）；双 int 范围 0xFFFFFF 钳制→E_INVALIDARG；VARIANT 门 + VT_UI4 强转 + 集合成员解析；快路径构造矩形（x1,y1,x1+e1,y1+e2）经 [0x5141185C] 应用到 rec+0xC、装 clamp-vs-mod 模式处理器（rec+0x1C）、经 0x5140833B 提交进与 Set/视差/滤波共享的待处理列表、调用成员 [vt+8]；EXE 8 站点（0x437xxx 滤波武装族包装 / 0x4B3xxx UI 动态矩形 / 0x66B1A6 等平铺带）。attach 基线机制文档化（WP2-B）：基线=注册时 [0xBE2788] 原点位置的运行时快照——**首帧绝对屏幕偏移静态不可证**（与 OpenMS GMS083 同边界，独立到达）。13 图 387 条 back 记录原始 WZ 布局表（T090-G36-13MAP-LAYOUT.csv，含 C-051 跨度与 C-111 视差比，视口 800×600）。 |
| G37 | PARTIAL-STATIC（不变） | obj 层帧普查并入 G39 资源闭合（EV-104：3,540 obj 帧、2,114 显式 delay；平铺器 0x66ABCD 的 120 默认覆盖 flow 子帧）；共享引擎无独立 Obj 时序逻辑；残项=逐帧绘制体（运行时）。 |
| G39 | PARTIAL-STATIC（不变） | **三项 T089 残项闭合（C-117/EV-104/EV-105）**：(1) 原始 Map.wz 帧普查——4,347 帧/475 资源，2,450 显式 delay（35 种值 100..4000；190×284/200×265/170×258 居多），225/329 多帧资源依赖消费者默认，456 帧 a0/a1 渐变——"全部 120ms"被资源数据反证；(2) animationScale 默认=1000（累加器 0x5040B9DE=[vt+0x110]@0x5042E3F0 主表；0x504027BB 空缺 VARIANT 快路径 0x5040283D 存 0x3E8）；(3) 36 站点默认矩阵全表：120×18（全部 imm8 `6A 78` 种子）、150×2、60×2、180×3（`68 B4 00 00 00` 字节确认）、1000×2、寄存器×9——portal 平面记录读取 0x71A72A 默认=ebx=0（0x71A203 内 xor）。原始 portal 帧无 delay（pv=8、ph 4/7/3；仅 psh/1 带 delay=1500+a0/a1；psh/2-3=6/14/6）。残项：portal 逐帧默认值未字节定位（960/480/840/360 ms 保持默认基估计）；8 个寄存器默认变量。数值时间线模型（t090_wp1d）覆盖 32 位语义/重复三分/边界。 |
"""

t = t.rstrip() + "\n" + APPEND
REG.write_text(t, encoding="utf-8", newline="")
print("gap register appended")
