# Reverse-Engineering Scripts

本目录只存放 CMS079 逆向研究、协议观察、WZ 解析和静态分析辅助脚本。它们是研究档案，不属于正式游戏运行时，也不应被正式应用直接导入。

脚本运行时所需的客户端样本必须由使用者在本机合法准备；原始输入放在仓库根目录的 `.raw/`，中间输出放在 `.work/`。不要把二进制样本或完整资源导出提交到 Git。

## Running scripts

Run scripts from the repository root unless a script's CLI help says otherwise. The tracked evidence archive is under `research/result/`; local client inputs and intermediate captures remain under the root `.raw/` and `.work/` directories and are not committed.

## Script inventory (key entries)

| 脚本 | 功能 |
|---|---|
| `maple079_packet.py` | 完整包 codec（AES-OFB + 滚动密码 + opcode 解析），已用合成客户端验证 |
| `t055_syn_client_v2.py` | 合成客户端：登录 → 选角 → 进场 → 聊天 → 移动 |
| `t056_client.py` | 带游戏动作（聊天/移动/表情/keepalive）的合成客户端 |
| `t053_vm_control.py` | QEMU 虚拟机控制（启动/截图/键鼠注入） |
| `t053_capture_analyze.py` | 内存捕获（ELF）分析 |
| `maple079_function_census.py` | 函数普查（调用图/引用统计） |
| `maple079_loader_emulate.py` | 保护器 loader 仿真 |
| `map_wz_extract.py` / `map_wz_classify.py` | 从服务端 WZ XML 提取/分类地图数据 |
| `t063_find_containing.py` | 在 Ghidra 反编译 CSV 中定位"函数中间地址"所在的包含函数（VA↔RVA 换算示范） |
| `t063_find_physics.py` | 在游戏映像字符串池 + 反编译代码中搜索 WZ 属性名（ASCII 与 unicode 双路） |
| `t063_physics_names.py` | **突破性方法**：从 Ghidra unicode 标签 `u_<name>_<addr>` 提取全部 WZ 属性名（Physics.img 20 字段即由此发现） |
| `t063_movement_physics.py` | 移动物理深挖：跳跃公式/速度积分/绳索矩形/坐下/下跳门控 |
| `t063_gap_search.py` | 8 个已知缺口的系统性 Ghidra 反编译搜索 |

### t063 系列的共同读法

所有 t063 脚本从 `E:\ghidra-projects\decompiled_v2.csv` 读取 52K 函数的反编译伪代码（列：`rva`, `decompiled`）。注意两点：

1. `csv.field_size_limit(50 * 1024 * 1024)` 必须设置——单个函数的伪代码可超过默认 128KB 限制。
2. CSV 的 `rva` 列是 **RVA**；用户分析文档中的地址是 **VA = RVA + 0x400000**。

