# T087 — Camera Object Identity & Static Writer Closure (CMS079 纯静态)

Round: T087 (2026-11-15). Branch: `design/adventure-field-map-scene`.
Baseline: `5172dcb79bad94231f7ba517ef8357e87b9c8f89`（开工时核验一致；远程无新提交）。

Binary identity（每脚本运行前 sha-pinned）：
- EXE `.work/task-036/game-image-unpacked.bin` `d4a67597…a31718`（linear，VA−0x400000）
- Gr2D `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` `ad67b9a0…f6a25d1`（0x50400000）
- Shape2D `.work/task-001/extracted/冒险岛online/Shape2D.dll` `9802bacc…c8111b`（0x51400000，本轮新增 pinned）
- 服务端 `.work/task-063/server079.jar` `49382081…8cf360`

约束遵守：**零运行时行为**（无启动/登录/调试/内存采样/网络捕获）；仅修改 `research/`；Frozen ABI / LoomRealm / content / 原始二进制零改动。报告级标签（ORIGINAL-STATIC-PROVEN / STATIC-UNDERDETERMINED / UNRESOLVED-VERSION-AUTHORITY / PRODUCT-SUBSTITUTION）仅用于本文与取证文件，不进入权威 CSV status。

---

## 执行摘要

| WP | 对象 | 结论 |
|---|---|---|
| WP1 | `[fieldctx+0xD4]` 身份 | **定案（ORIGINAL-STATIC-PROVEN）**：fieldctx 构造器 = 0x9EC3E1（安装 `[0xBDD6F4]`）；+0xD4 = 命名空间 id **0x31D** 对象，名称经**完整静态解密**（0x7A4DA9/0x7A484B/0x7A48B3/0x7A4CBE 密码学全恢复）= **`Shape2D#Vector2D`**；构造时 `Set(−400, −300)`（负半屏=世界原点居中）；Shape2D.dll 内 RTTI `.?AVCWzVector2D@@` + UTF-16 注册串互证；71 个 getter 消费点普查 + 208 条 disp32=0xD4 全量引用普查 |
| WP2 | `[0xBDD838]` 身份 | **定案（行为级 A）**：唯一全局写入者 0xA012E5（0xA0125F 创建 0xA04 字节对象，ctor 0xA012D3+0x5CA5A9）；= **输入/光标管理器单例**（键盘 0x5CB9EC / 手柄 0x5CBE2A（±700 死区/±1000 饱和）/键盘轴移动器 0x5CB573；光标位置 +0x938/+0x93C 初始 (400,300)=屏幕中心，硬 [0,800]×[0,600] 夹取；光标精灵 id 0xA58=`UI/Basic.img/Cursor/%d`；0xA020E2 窗口消息带（0x100 键/0x200-0x20A 鼠标）转发）——T086.1 的"双 UI 生产者 vs 输入更新器"歧义就此解决：全部位置生产者写的是**光标** |
| WP3 | Camera 数据流/公式 | **核心公式恢复（ORIGINAL-STATIC-PROVEN）**：0x5CA91A = 相机写入 `camera := point − (400,300)`（7 写入点普查：ctor 初始、光标 setter 0x5CB0E0 两分支、0x5CB3DF、键盘移动器 0x5CB74B、**field 世界坐标写入者 0x9E6D18（记录对 +0x38/+0x3C）与 0x9F1ADF（打包 16:16 坐标）**）；world→screen = `world − camera`（0x9EA446 指令级）；0x9EC924/0x9EC989 = **屏↔世界转换器**（光标+相机），非相机 IO；同一 Vector2D 实例 = `[fieldctx+0xD4]` == `[singleton+0x9B0]`（同 id 同槽位） |
| WP4 | G17 BOAT 0x97/0x98 | **载荷级完成（PARTIAL-STATIC B）**：0x97 = 子操作码分发（首字节 7..12；7/9/11=空桩；8/10/12 带参选 4 个船动作）；0x98 = 双字节状态机（状态 1|6/2|5/4 × 泊位态 [this+0x774]）；共用船对象 this+0x768；动作经命名空间 id 0x43A=**"Whistle"** 汽笛音；命名维持 UNRESOLVED-VERSION-AUTHORITY |
| WP5 | EV-15 卫生 | **修复（ORIGINAL-STATIC-PROVEN）**：文件在库、单文件、按 T086.1 规范哈希可复算 → 占位符 `(in-repo csv)` 替换为真实值 `520d8333…a3898`；审计全留痕；Validator 17a 现在主动校验该行 |

**G10 维持 PARTIAL-STATIC**（身份/公式/转换层已静态定案；跟随节奏/deadzone 有界残留）；G17 维持 PARTIAL-STATIC。项目维持 **NOT STAGE-READY**。

---

## 1. WP1 — [fieldctx+0xD4] 构造链与对象身份

### 1.1 构造器定位与安装链

```
Field Constructor       0x9EC3E1（[0xBDD6F4]=this @0x9EC404；+0xD4 清零 @0x9EC478/0x9EC47E；
                         主 vtable 0xB0D208 @+0；子对象 vtable 0xB0D23C @+0x64）
  → Object Factory      命名空间管理器 [0xBE2000]（临界区 0xBE2004 保护）
      resolve id 0x31D: 0x7A48D0(&out, 0x31D) → 0x40634C（密集数组按 id 懒创建）
  → Concrete Class      "Shape2D#Vector2D"（Shape2D.dll 的 CWzVector2D，RTTI+UTF-16 注册串）
  → Installed Interface 0x447891(OBJ, &[this+0xD4], 0) 智能指针附加+AddRef @0x9EC4EE
  → +0xD4              随后立即 [vt+0x90](obj, −400, −300, V{VT_ERROR}, V{VT_UNKNOWN,[0xBE2788]-iface})
                         @0x9EC61A/0x9EC620/0x9EC62A —— Set 负半屏 = 世界原点 (0,0) 置于屏幕中心
```

每条边均有指令地址（见 forensics/T087-FIELDCTX-D4-CONSTRUCTION.txt §1-2）。

### 1.2 命名空间名称解密（本轮新方法，纯静态）

密钥推导（从 0x7A4DA9→0x7A484B→0x7A4CBE→0x7A48B3 字节级恢复）：

```
key0   = dump .data 0xB07640 处 16 字节（长度 [0xB07650]=0x10）
key1   = key0 循环左移 (type div 8) mod 16 字节        # 0x7A4CF0-0x7A4D3F：temp[i]=key[(r+i)%16]
key    = key1 整体（128 位大端）左旋 (type mod 8) 位    # 0x7A4D52-0x7A4DA0（方向经单测锚定）
plain[i] = cipher[i] XOR key[i mod 16]                 # 0x7A4DD8-0x7A4DF0；零结果存键字节（0x7A4DEA）
```

（t087-reviewer 修正并入：初稿文字把字节步写成"右移"——代码/单测实现的是正确的左移，此处仅勘误文字；reviewer 独立复算同值。）

锚定结果：id 0x31D(type 0x51)=**`Shape2D#Vector2D`**；id 0x819=`Gr2D_DX8`（与 EV-07 创建链独立互证）；id 0xA58=`UI/Basic.img/Cursor/%d`；id 0x43A=`Whistle`；id 0x818=`Data.wz` 等。密文记录表 0xBA7B04+id*4 是 dump 捕获的运行时挂载态（.data 内，可静态读取）。

### 1.3 写者/读者普查（完整编码覆盖）

- `disp32=0xD4` 任何编码引用：**208 条**（解码器探针法；disp8 对 0xD4 不可能；SIB 形含于探针），分类见 T087-FIELDCTX-D4-WRITER-CENSUS.csv。
- `+0xD4` getter 0x48AEC3 直接 E8 调用者：**71 个站点**（字节模式法，带内完备）。
- `+0xD4` 的非构造写入：无直接 disp 写入到 fieldctx 实例（其余 49 个 W 站点均属其它结构族，含 +0xD4 为标量坐标的族，如 0x79293F 的 `imul 0x1F4` 记录、0x7C939A 的加密坐标解密器输出）；**对象 X/Y 的更新全部经 `[vt+0x90]` 虚调用**（见 WP3 公式），构造器是唯一安装点。

### 1.4 [scene+0x1CC]（slot15 的 X1/Y1 源）

- slot15 主体（0x53471A）本轮从原始字节重验：裁剪窗 `X1+(3−X0) ≤ x ≤ X1+([scene+0x1D0]−X0)+5`（Y 同构 5/5），X0/Y0=相机 Vector2D（经 0x48AEC3+0x404B07/0x404B2E），X1/Y1=场景自有成员 [scene+0x1CC] 内部对象（E_POINTER 守卫，同型 getter）——视差层偏移测试（与 G36 层滚动一致）。
- 0x52429B 构造器（primary 0xB01040，非 slot15 家族）向其 +0x1CC 安装内嵌 vtable 0xB002C0——属另一类族；slot15 家族（33 张表，基 0xB01278..0xB026DC）的 +0x1CC 安装者**本轮未定位**（有界残留，STATIC-UNDERDETERMINED）。

## 2. WP2 — [0xBDD838] 单例定身

### 2.1 创建与布局

唯一全局写入 0xA012E5；创建链 0xA0125F（0x402D66 类描述分配 0xA04 字节）→ ctor A 0xA012D3（[0xBDD838]=this；+4/+0x92C/+0x978 清零；+0x97C 处理器表 0xA70B1E(4, 0xD, 0x4B6FBB, 0x414A99)）→ ctor B 0x5CA5A9（设备创建、键表、光标初始化、Vector2D 安装）。布局表（A 级）：

| 偏移 | 语义 | 证据 |
|---|---|---|
| +0x8/+0xC/+0x10 | 输入设备对象（键盘/门控/可切换设备） | 0x5CB9EC 读 [+8] vt+0x24；0x5CB573 读 [+0xC]；0x5CBDF7 切 [+0x10] |
| +0x14/+0x18/+0x1C | [0xBE157C](0,0,0,0) 创建的 3 设备 | 0x5CA5D0-0x5CA61A |
| +0x24/+0x424 | 256 项键表（从 204 字节表 0xBA1D7B 填充） | 0x5CA664-0x5CA689 |
| +0x92C | 按键边沿标志（0x10000000/0x20000000…） | 0x5CBA91/0x5CBAB2 |
| +0x938/+0x93C | **光标位置**，初始 (400,300)=屏幕中心 | 0x5CA787/0x5CA78D；[0,800]×[0,600] 夹取于 0x5CB0F1-0x5CB115 |
| +0x970 | 键盘移动速度基值（0x5CB573：+5 后 /10 缩放） | EV-88 §8 + 复核 |
| +0x97C | 光标精灵集（id 0xA58 `UI/Basic.img/Cursor/%d`） | 0x5CAD7B |
| +0x9B0 | **共享 Shape2D#Vector2D（=相机）** | 0x5CA68E-0x5CA6B1 |
| +0x9BC | 命令通知队列（cmd 0x200/0x500） | 0x5CC30A 调用族 |

### 2.2 输入分发与坐标表面

- 0x5CAB38(arg)：case0→0x5CB9EC 键盘（256 字节设备态、前态表 +0x824、[0xBE18D4] 时戳、边沿翻转 +0x92C）；case1→0x5CB573 键盘轴移动器；case2→0x5CBE2A **手柄**（0x110 字节状态；lX/lY ±0x2BC(700) 死区→±0x3E8(1000) 饱和；边沿标志 +0x9DE/+0x9DF；cmd {0x500,3,0}）。
- 驱动点 0x9FEE18：模式 = `[0xBE179C](3, input+0x88, 0)` ∈{0,1,2}；分发后 0x5CAB5F 读取 +0x9C4/+0x9C8 三元组并经 **0xA020E2 窗口消息分发**（0x100 键带、0x200-0x20A 鼠标带——鼠标带消息**携带 (x,y) 转发给 [0xBDD6F4] 的方法**、0x500/0x501）。
- **报告级分类：UI-SCROLL-SURFACE / SHARED-SCREEN-COORDINATE-SERVICE 混合体**（其自身位置是屏幕空间光标；同时作为相机写入者之一）。不强制二选一——两个表面的共存已被指令证明。

### 2.3 非 E8 写入链边界（WP2-C）

+0x938/+0x93C 的写者普查（T086.1 已列 0x5CB122/128 + 0x5CB713/71F）：本轮补充（a）全带 `[reg+disp]` 写扫描中所有 +0x938/+0x93C 命中（T086.1 reviewer 的对抗扫描复认 0x7860D9/0x78F3ED/0x79029B 为 `lea edx,[esi+0x938]; call 0x79A8FC` 的异构结构族——非本单例）；（b）虚表/函数指针存储路径：单例无 vtable（ctor 未安装 [this]），位置更新仅经 0x5CB0E0 包装与 0x5CB573 直写 + 0x9EC989→0x5CB0E0 漏斗；（c）**0x5CA91A 为位置变化后的相机写入口**（见 §3）。未覆盖：以整数运算在别名寄存器上构造 +0x938 地址的路径理论上不可枚举尽——本负结论有界于"带内直接编码 + 已知漏斗函数族"。

## 3. WP3 — 相机数据流与公式（本轮核心成果）

### 3.1 相机写入公式（0x5CA91A，7 写入点）

```
0x5CA91A(this, x, y):
    V{VT_ERROR,missing} ×2
    E_POINTER [this+0x9B0]（=相机 Vector2D）
    y' = y − 0x12C (300)      # 0x5CA9AC
    x' = x − 0x190 (400)      # 0x5CA9B8
    [Vector2D.vt+0x90](Vector2D, x', y', V, V)   # 0x5CA9C1
→  camera := (x − 400, y − 300)     —— 点 (x,y) 置于屏幕中心
```

写入点（E8 字节模式普查，带内 7 个 = **0x5CA91A 漏斗**；t087-reviewer 反证并入：另存在**绕过漏斗的直写 [vt+0x90] 家族**——≥4 站点已验证（0x43781F (0,−0x32)、0x692280 (−0xFF,0)、0x6BE6F4 (0x190,var)、0x6ED7CC (0x97,0x8D)），另有 24 个候选站点未普查；这些直写点的 VARIANT 参数是否与漏斗调用同语义（纯位置 set）为开放子问题）：

| # | 站点 | 输入 | 空间 |
|---|---|---|---|
| 1 | 0x5CA774（单例 ctor 再通知） | **预初始化值**（memset 与 (400,300) 存储在其后；相机起点 (0,0) 由 fieldctx ctor 的 (−400,−300) Set 确立） | 屏幕 |
| 2/3 | 0x5CB12E/0x5CB139（0x5CB0E0 两分支） | 夹取后光标 | 光标跟随模式 |
| 4 | 0x5CB3DF（0x5CB33F 错误路径） | 重试值 | — |
| 5 | 0x5CB74B（键盘移动器 0x5CB573） | 移动后光标 | 光标跟随模式 |
| 6 | **0x9E6D18**（field 记录循环 0x9E6CA4） | 记录 `+0x38/+0x3C` 对 | **世界坐标**（玩法路径） |
| 7 | **0x9F1ADF**（打包坐标路径） | 单 dword：低字=x 高字=y | **世界坐标 16:16 打包** |

构造器初值 `(−400,−300)` 与公式自洽：= `Set(0−400, 0−300)`（世界原点居中）。400/300 = 800/600 之半，与 0x5CB0E0 的 [0,800]×[0,600] 夹取（C-027）互锚。

### 3.2 坐标系分离与转换边

```
玩家世界位置（move 对象加密对；C-055/C-088）
      │ 0x5CA91A（field 写入者 #6/#7，触发节奏未解码）
      ▼
世界相机 Vector2D（[fieldctx+0xD4] == [singleton+0x9B0]；每图初始 (−400,−300)）
      │ world→screen: screen = world − camera（0x9EA446 指令级）
      ▼
屏幕坐标 —— 屏↔世界转换器：0x9EC924(get,flag=1): out = 光标 + 相机；0x9EC989(set,flag≠0): in − 相机
      ▲
      │ 光标 = [0xBDD838]+0x938/+0x93C（初始 (400,300)；[0,800]×[0,600] 夹取；键盘/手柄/网格/UI 驱动）
      ┘
```

24 个 0x9EC924 消费点（含 0x953B3D 命中测试、0x953AF4 per-draw 族）= **光标悬停→世界坐标**转换；slot12 tick（0x53465B）→ 0x9532D8（移动设定点队列）/0x9533EA（按键状态机：VK 0x25-0x28 镜像交换、0x416DE8 加密坐标解密、[user+0x2ED4/+0x2ED8] 每帧刷新）构成用户侧每帧链（与 T085 首帧链合流点已记录）。

### 3.3 已证 vs 有界残留

**ORIGINAL-STATIC-PROVEN**：相机对象身份与安装链；每图初始 (−400,−300)；写入公式 `point−(400,300)` 及全部 7 个**漏斗**写入点；world→screen=`world−camera`；0x9EC924/0x9EC989 转换器语义；[0xBDD838]=光标/输入管理器（其全部位置生产者语义定案）。

**STATIC-UNDERDETERMINED（有界）**：
1. 跟随节奏/deadzone：0x5CA91A 本体**无条件**居中（未发现阈值/平滑常量——负结论有界于已解码函数族）；若存在 deadzone，主要藏于 field 写入者 #6/#7 的上游门控（虚分发目标，含函数已定位，触发事件未解码）——此外 reviewer 发现的**直写槽位家族**（≥4 站点验证、24 候选未普查）构成另一处未普查的写入者集合。
2. 相机对地图边缘的 clamp：VR 折叠界喂给 slot15 裁剪窗（消费侧），未见相机侧 clamp。
3. [scene+0x1CC] 内部对象安装者。
4. Shape2D 内部 vt+0x90 的属性层路由（EXE 侧契约与可观察 X/Y 语义已证）；直写家族的 VARIANT 参数语义。

### 3.4 P2 实施契约（参数化）

见 forensics/T087-CAMERA-DATAFLOW-AND-FORMULAS.md §5：变换层与初值可按原版精确实现；跟随节奏/deadzone 为产品决策（PRODUCT-SUBSTITUTION，不得标注原版一致）。

## 4. WP4 — G17 BOAT 0x97/0x98 载荷审计

见 forensics/T087-G17-BOAT-0x97-0x98.txt。要点：两条互斥文法（0x97=子操作码；0x98=双字节状态机，t087-reviewer 勘误后：状态 {0,1,6}→0x564FBE、{2,5}→0x564E52、{3,4}→0x56512A 或按泊位态回退 0x564E52，仅 state<0 或 >6 为无操作）驱动同一船对象（this+0x768，泊位态 +0x774）；动作含 "Whistle" 汽笛音（命名空间 0x43A）；jar 侧 sendops BOAT_EFFECT=0x98 / recvops 无该名。**命名不裁定**（维持 T086.1 纪律：UNRESOLVED-VERSION-AUTHORITY）；G17 维持 PARTIAL-STATIC。0xA10CE3 未被使用于任何命名结论。

## 5. WP5 — EV-15 修复

见 forensics/T087-EV15-INTEGRITY-AUDIT.txt：`(in-repo csv)` → `520d8333b7d84fa4abe300f52ddd923ab9981ec72e5155b01d54bcd0608a3898`（T086.1 规范哈希；文件在库、单文件、内容 spot-check 与 C-012 分类一致）。Validator 未弱化——17a 现主动校验。

## 6. 台账动作

- 新增 Claim：C-103（相机身份+公式，CLOSED-STATIC A）、C-104（单例身份，CLOSED-STATIC A）、C-105（G17 载荷文法，PARTIAL-STATIC B）。
- 升级：C-028 OPEN-RUNTIME→PARTIAL-STATIC（A；world→screen + 写入公式静态恢复，节奏/deadzone 残留）。
- 新增 Evidence：EV-89/EV-90/EV-91/EV-92（全部 T086.1 规范 LF 哈希；附带件 CSV 哈希在 interpretation 列内注明）；EV-15 哈希修复。
- Gaps：G10 verified/unresolved scope 重写（含 C-103/C-104 引用；状态维持 PARTIAL-STATIC）；G17 追加 C-105。
- 矩阵：P2-01 → ORIGINAL-STATIC-PROVEN（变换层静态闭合）；P2-05/P2-06 更新证据等级与 residual。
- 数量：Claim/Evidence/Gap = **105 / 92 / 41**（CLOSED-STATIC 25 不变；PARTIAL-STATIC 9）。
- 清理：t087_append_claims.py / t087_update_ledgers.py / t087_fix_evidence_rows.py / t087_update_matrix.py 为一次性台账变更脚本（保留入库供审计复放）。

## 7. 独立 Review（Sub-Agent）

见 forensics/T087-REVIEWER-INDEPENDENT.md（独立只读子代理，盲审优先协议，R1-R6，双镜像前后哈希核验）。**最终裁决：ACCEPT-WITH-CORRECTIONS**——4 项修正（①密码字节旋转方向文字勘误；②G17 0x98 状态机三处路由勘误（状态 0 归入 {0,1,6}→0x564FBE、{2,5}→0x564E52、{3,4} 回退→0x564E52）；③"7 写入点"改为"7 漏斗写入点 + 直写槽位家族（≥4 验证，普查开放）"；④单例 ctor 0x5CA774 为预初始化再通知而非传 (400,300)）。主 Agent 对全部 4 项从原始字节复核确认并已应用（报告/取证/台账/矩阵/测试同步更新，修复闭环记录见 reviewer 文件尾部）。处置后复核：Validator/测试/clean-room 全过（见 §8）。

## 8. 质量门禁

| 门禁 | 结果 | 日志 |
|---|---|---|
| Validator | PASS（0 errors / 0 warnings） | forensics/T087-VALIDATOR-LOG.txt |
| Unit tests | 85/85 OK（原 69 + 本轮 16） | forensics/T087-UNITTEST-LOG.txt |
| Clean-room 再生 | 与 canonical 一致（claims=105 gaps=41 evidence=92） | forensics/T087-CLEANROOM-LOG.txt |

## 9. 边界声明

- 仅修改 `research/`；Frozen ABI pin 校验通过；LoomRealm submodule、content/、原始二进制零改动。
- 未重开 T086/T086.1 已闭合结论；对 C-101/C-102 的"角色未定"措辞按本轮身份定案更新（保留勘误链）。
- 负结论（无 deadzone 常量等）有界于已解码函数与其直接调用者，不外推整个二进制。
- 项目维持 **NOT STAGE-READY**。
