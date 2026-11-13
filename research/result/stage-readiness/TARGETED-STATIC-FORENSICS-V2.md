# TARGETED-STATIC-FORENSICS-V2 — CMS079 定点静态逆向（t080 轮实际执行记录）

**轮次**: t080，2026-11-13/14。主 Agent 实际执行的机器指令静态分析总览；逐工作包细节见 `forensics/` 下五份记录。所有结论标注 DIRECT-INSTRUCTION / DIRECT-DATA / DERIVED-FROM-INSTRUCTION / INFERENCE / UNVERIFIED；Critical 结论经独立 Reviewer 复核（见 INDEPENDENT-STATIC-REVIEW.md）。

**输入**: `.work/task-036/game-image-unpacked.bin`（SHA-256 `d4a67597…31718`，线性内存转储，`fileOffset=VA−0x400000` 经锚点验证）+ `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll`（`ad67b9a0…a25d1`，节表映射）。二进制在上一轮被判"不在 Git tree 内"而阻塞取证——本轮确认其在本机 `.work` 内且哈希与权威 Evidence 完全一致，静态取证由此恢复。

## G36/G37 — 背景平铺与 Obj.flow（forensics/G36-G37-TILING-0x66A8D5.md）

- `0x66A8D5` = thiscall、9 栈参（`ret 0x24`）、全像仅 **3** 个 E8 调用点（双方独立扫描一致）。
- 完整参数表（三个调用点逐 push 重建）：资源智能指针、mode、cx、cy、alpha、ani、objFlag、{未初始化 dword, 容器句柄} 结构。
- mode bit0=水平、bit1=垂直；bg-normal 直接传 type（1/2/3）、scroll 重映射 4→1/5→2/6|7→3、Obj 直接传 flow；**flow=0/type0 → 恰一次迭代（单实例）**。
- 零步长回退：bg `slot+0xB8/+0xC0 + 1 − (1<<item0.slot+0x58)`（item0 经 slot+0x100/VT_I4 0）；Obj 走 `[this+0x38]` 矩形宽/高差。**13 图 387 条 Back 全部 cx==0 或 cy==0——回退是主路径**。
- 跨度 `((view + 2·step − 2)/divisor)·step`，view=[0xBE2788] slot `+0x2C/+0x30`，无符号除。
- 每 tile：0x427EB3 造层 → 逐子项 0x427DE0（3 个 int 属性、alpha 缩放）→ +0x90 以 `(x−x0, y−y0)` 定位 → +0x9C 裁剪矩形 → +0xFC/+0xE0 → 0x671234 挂载（Obj→this+0x50；bg→arg9 容器）。
- FSDB 实测：387=109/155/36/9/78（**无 type5/6/7**）；Obj 1817 条 flow={0:1762, 1:55}（55 条全水平、cx/cy 缺省）；rx('−15'..'15') 不入 0x66A8D5。
- 新增：滚动分支 `idiv`-零除隐患（rate==0 时 0x66A574 先于 rate==0 处理执行）——13 图数据不可达（78 条 type4 无 rx==0）。

## G39 — 动画与滚动时钟（forensics/G39-ANIMATION-CLOCK.md）

- 注册链绑定：`[资源.vt+0x110]` + item0 `+0x6C/+0x74` 原点；`0x43715C` = vt+0x58 槽读取（非 GetTickCount）。
- 滚动相位 `slot58 + 20000/|rate|` 以 `V{VT_I4,sum}` 进入第二 +0x90（伴随 `V{VT_I4,0x10000000}`）。
- `0x66B544`（真实范围 **0x66B544–0x66BC80**）读 **5** 个 item0 属性（0x54F..0x553；moveType 开关 {0..3}、rate 符号处理）——历史五属性主张获字节级确认（对抗复核纠正了主 Agent 初版"仅 2 个"的窗口截断错误）。
- 时钟单位仍在运行时体（静态链已穷尽可见部分）。

## G38 — Portal 落点（forensics/G38-PORTAL-ARRIVAL.md）

- 同图链端到端：pending `user+0x28F8/+0x28FC`（flag +0x28F0）；冷却门 `[0x2900]≠0 && [0x2904]>now`；**Y−10 在触发时**（0x963D6D）；deadline `now+0x78`（触发）/`now+0x258`（应用后）；tick=`[[0xBDD89C]+0x18]`。
- 应用经 `[move-vt+0x40]`：**0x9C1113 位于 8 个兄弟虚表 slot+0x40**（`ret 0xC` 与调用点匹配）；EV-22 的 0xB0CB70 是同族兄弟，其 slot16=E_FAIL 存根（0x9D34FA 构造时安装——**逐状态换表**，该状态下同图传送被拒绝而非崩溃）。
- 0x9C1113：加密双精度 setter（C-035 机制）于 **move+0x20(X)/+0x38(Y)**（第二副本 inner+0x80/+0x98；速度清零 inner+0x50/0x68/0xB0/0xC8；RNG cookie 至 inner+0x12C）。
- 跨图：0x9507F0 单一 E8 调用者 0x97EC37（换图处理器 0x97EBC9）；PortalRecord `+0xC/+0x10`=x/y（[0xBDEB48] 步长 8 表）；**Y−10**（0x950964）；m1=**0x9BC622**(1,x,y−10,0,0,user+0x3C0,0) 含**地图边界夹取** `[move+0x138..0x144]`、速度清零、FH 提示 `move+0x130/+0x134`。opcode 0x0081=WARP_TO_MAP（A 级语料）。

## G40/G41 — 移动/爬绳/座位（forensics/G40-G41-MOVEMENT.md）

- 爬绳 **`y += 3.0 × verticalKey`**（`[0xB00D68]=3.0` 字节直读；槽 move+0x38 与传送同槽）；端点夹取 bottom−5 / top+1 / 绳 y 回退；退出通知 (move,0,0,0)。
- 座位：`0x6131B9(0/1, &user+0x2944)` 写链、`[user+0x294C]` 值槽；矩形 **x±10/y±30**（[field+0x16C] 步长 8 表）；坐点 `0x9D35F2(move,seat_x,seat_y)`；到达复用 **0x963C7D 传送触发族**。
- `0xA4F6F1` 竖线碰撞**半宽为调用方参数**（box x±w）——R12 之争按调用点裁断；首个站点数据：portal 触发传 **halfWidth=1**。
- tick dt 经 0x9C4Bxx 分发器**由调用方供给**至 0x9BCD6C——0x1E 仍非全局帧频证明（G34 维持）。
- fh 邻段 `+0x4C/+0x50` 在 0x9BF1FA 头部被消费（完整体余留）。

## R13/G07/G27 — 分派与出参（forensics/R13-G27-OUT-SEMANTICS.md）

- **0x427EB3 arg1 = OUT 指针**：`*arg1 =` slot25 执行后 arg8 槽首 dword（0x427F01–09）。静态 Gr2D slot25（trivial setter, ret 8）不写出参 ⇒ 生产路径要求运行时 slot25 为 put-with-object-out——G27 矛盾由"参数序错"改写为"运行时写出参绑定"，dump 目标收窄到单 dword。
- tile 路径 push 重建：arg2/arg3 = WZ `x`/`y` 属性 int（0x331/0x332）；arg7 = `V{VT_UNKNOWN, layer}`（EV-02 打包）；arg8 = missing-variant。
- `[ebp-0x10]` 唯一写者即 0x427EB3 出参（Reviewer 字节穷尽扫描确认），随后 Release——运行时必须是堆对象指针。
- G24/G27 合并裁决点：bp 0x666F77 单值 dump。

## 未推进（本轮范围外）

G10 Camera 更新链（无新线索窗口）、G01/G07 比较器本体（0x43E3A6 族未读）、G12 alert 递减具体绑定（结构候选 [move+0x248] 已记）。
