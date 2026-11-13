# 逆向运行时残留清单（REVERSE-ENGINEERING-RUNTIME-REMAINING）

日期: 2026-11-13。仅收录**已证明静态资料不足**的未闭合项。每项附最小验证方案。
静态可解项见 REVERSE-ENGINEERING-GAP-REGISTER.md（全部闭合或定性）。

## 清单（8 项）

| ID | 项 | 缺失证据 | 最小验证 | 预期收益 |
|---|---|---|---|---|
| R-01 | [0xBE2788] 对象真实虚表 | 进图后对象指针（选角时=0） | 进图转储读 `[[0xBE2788]]` 1 dword | R13 全链最后一环 + 20 个调用槽定名 |
| R-02 | DLL 内二分插入比较器 | R-01 定位虚表后 | 反汇编插入函数体 | 排序稳定性/相等处理终证 |
| R-03 | Avatar 插入键构造 | 进图运行时路径 | 进图转储 + Avatar 注册路径 | 人物/Obj 遮挡精确规则 |
| R-04 | Camera 跟随/deadzone | 进图输入循环 | 转储 [0xBDF54C] 族对象 | 镜头实现 |
| R-05 | +0x61 死亡位移位 | 77 disp8 候选无结构归属 | 进图 diff：user ±0x100 两转储对比 | 动作切换最后一未知位 |
| R-06 | +0x3BC 减计数机制 | 全库无 sub/dec（可能计算位移循环） | 进图采样 5000→0 轨迹 | alert 计时器实现 |
| R-07 | WINMM 实际调用序列 | 哈希导入运行时解析表 | 进图后 [0xafeXXX] 解析值 + 枚举 waveOut | 音频 API 全名 |
| R-08 | DLL 运行时装载基址 | 捕获点早于 DLL 加载（时间戳证明） | 进图后第二次转储 | 虚表运行时绑定 |

## 捕获前提

VM Windows 7 激活失败（C004F009）阻塞登录（ROUND8-S2C-FIX-CAPTURE-DIAG.md）。
修复路径：WinRE 离线 slmgr rearm 或更换磁盘镜像。
地址空间走查方法已就绪（RUNTIME-ADDRESS-SPACE.md：CR3=PDPT@0x3F6EC000 + 锚点验证法）。

## Round-3 增补（2026-11-13）

| ID | 项 | 最小验证 | 收窄说明 |
|---|---|---|---|
| R-09 | [ebp-0x10] 对象具体虚表（tile 路径 @0x666F7D） | 进图转储在 0x666F7D 前寄存器快照或 [[ebp-0x10] 链] 1 dword | 候选集已收窄至 R13-DISPATCH-RESOLUTION.csv 所列；slot45 在不同实现中语义不同（析构 vs 插入 vs 解码） |

（R-01/R-02 的 [0xBE2788] 虚表问题已在 Round-2/3 静态闭合为 0x5042D140/CWzGr2DLayer；容器插入语义移至 R-09。）
