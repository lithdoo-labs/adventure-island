# 数据资产清单

## 1. 游戏镜像

| 文件 | 路径 | 大小 | 格式 |
|---|---|---|---|
| 游戏体 | `.work/task-036/game-image-unpacked.bin` | 10.3MB | raw binary, RVA==offset, base 0x400000 |
| 物化捕获 | `.work/task-053/captures/t053-mat.elf` | 1.74GB | ELF memory dump |
| 036 捕获 | `.work/task-036/captures/t036-mem.elf` | 2.16GB | ELF memory dump |

## 2. Ghidra 反编译

| 文件 | 路径 | 大小 | 内容 |
|---|---|---|---|
| v2 导出 | `E:\ghidra-projects\decompiled_v2.csv` | 35.5MB | 52,326 函数伪代码 |
| Ghidra 项目 | `E:\ghidra-projects\cms079\` | — | 可重新打开的项目 |
| 导出脚本 | `E:\ghidra-projects\scripts\ExportDecompiled.java` | — | Ghidra Java 脚本 |

## 3. 服务端

| 文件 | 路径 | 说明 |
|---|---|---|
| JAR | `.work/task-002/server/079V5/dist/江浩079.jar` | 861 类 |
| 反编译源码 | `E:\t055-decompiled\` | 364 Java 文件 |
| MySQL 数据 | `.work/task-002/server/079V5/mysql/` | 完整游戏数据库 |
| WZ XML | `.work/task-002/server/079V5/wz/` | 全部 WZ 数据 XML 格式 |

## 4. 结果文件 (result/)

### 协议
| 文件 | 内容 |
|---|---|
| `task055-s2c-opcodes.csv` | 217 s2c opcodes |
| `task055-c2s-opcodes.csv` | 148 c2s opcodes |
| `task055-server-methods.csv` | 7,507 服务端方法 |
| `task055-server-field-names.csv` | 172 服务端字段名 |
| `task055-server-writer-fields.csv` | 1,312 writer 字段 |

### 语义
| 文件 | 内容 |
|---|---|
| `task059-final-labels.csv` | 51,200 函数最终标签 (95.3%) |
| `task058-mass-labels.csv` | Task 058 批量标注 |
| `task050-vtable-classes.csv` | 179 验证 vtable 类 |
| `task050-class-map.csv` | 语义类映射 |
| `task050-field-facts.csv` | 522 字段事实 |

### 数据
| 文件 | 内容 |
|---|---|
| `task057-string-data.csv` | 22,438 字符串 |
| `task057-equipment-stats.csv` | 25,491 装备 |
| `task057-skill-data.csv` | 技能数据 |
| `task060-map-summary.csv` | 4,259 地图 |
| `task060-portals.csv` | 18,339 传送门 |
| `task060-npc-spawns.csv` | 3,174 NPC 放置 |
| `task060-mob-spawns.csv` | 30,827 怪物放置 |
| `task060-map-graph.csv` | 5,505 地图连接 |

### 物理/公式
| 文件 | 内容 |
|---|---|--- |
| `task061-game-formulas.md` | 伤害/属性公式 |
| `task061-formula-candidates.csv` | 202 公式候选函数 |
| `map/MAP-PHYSICS-FIELDS.md` | 20 Physics.img 字段名 |
| `map/MAP-MOTION-GAPS-ANALYSIS.md` | 移动物理缺口分析 |

### 验证
| 文件 | 内容 |
|---|---|
| `task061-handler-reference.md` | 19 handler 伪代码 |
| `task061-knowledge-graph.csv` | 88 知识图谱边 |
| `56-game-actions-spec.md` | 游戏动作验证报告 |

## 5. 脚本 (scripts/)

| 脚本 | 功能 |
|---|---|
| `maple079_packet.py` | 完整包 codec |
| `t055_syn_client_v2.py` | 合成客户端 |
| `t056_client.py` | 带动作合成客户端 |
| `t053_vm_control.py` | VM 控制 |
| `t053_capture_analyze.py` | 捕获分析 |
| `maple079_full_replay.py` | 完整重放 |

## 6. 虚拟机 (E:\vm-store\)

| 文件 | 说明 |
|---|---|
| `task-024-vm/win7x86.qcow2` | Win7 x86 虚拟机 |
| `task-024-vm/client.img` | 5GB 客户端磁盘 |
| `task-036-captures/t036-mem.elf` | 036 内存捕获 |
| `raw/*.iso` | Win7 安装介质 |
| `raw/*.rar` | 客户端原始压缩包 |

## 7. 任务规格 (task/)

50 个任务文件从 `001-cms079v5-baseline.md` 到 `062-gap-closure.md`，记录完整的任务执行历史。

## 8. 语义数据库 (.work/task-050/db/)

| 文件 | 内容 |
|---|---|
| `function-summary.csv` | 51,200 函数摘要 |
| `callgraph.csv` | 146,375 调用边 |
| `callers.csv` | 47,278 函数的调用者 |
| `field-facts.csv` | 10,922 字段观测 |
| `state-writes.csv` | 状态写入 |
