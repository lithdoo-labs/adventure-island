# 工具位置和使用方法

## 1. Ghidra 反编译器

### 安装位置
```
C:\Users\lithd\scoop\apps\ghidra\current\
```

### 项目位置
```
E:\ghidra-projects\
  cms079\           — Ghidra 项目
  decompiled.csv    — 第一版导出
  decompiled_v2.csv — 带符号注入的导出 (推荐使用)
  scripts\          — Ghidra 脚本 (ExportDecompiled.java 等)
```

### 重新运行分析
```powershell
$env:JAVA_HOME = "$env:USERPROFILE\scoop\apps\temurin-lts-jdk\current"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# 无头分析 + 导出
& "$env:USERPROFILE\scoop\apps\ghidra\current\support\analyzeHeadless.bat" `
    E:\ghidra-projects cms079 `
    -process game-image-unpacked.bin -noanalysis `
    -scriptPath E:\ghidra-projects\scripts `
    -postScript ExportDecompiled.java E:\ghidra-projects\decompiled_v2.csv
```

### 读取反编译输出
```python
import csv
csv.field_size_limit(50 * 1024 * 1024)  # 必须增大字段限制

fns = {}
with open(r'E:\ghidra-projects\decompiled_v2.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        fns[row['rva'].lower()] = row.get('decompiled', '')
```

### ⚠️ VA vs RVA 陷阱
- 用户分析文档中的地址是 **VA** (如 0x9BD58F)
- Ghidra 输出中的地址是 **RVA** (= VA - 0x400000 = 0x5BD58F)
- **始终确认你用的是哪种地址!**

### ⚠️ CSV 字段大小限制
Python 的 csv 模块默认字段限制 131,072 字节。反编译代码可能超过这个限制。必须:
```python
import csv
csv.field_size_limit(50 * 1024 * 1024)
```

## 2. Python 分析脚本

### 位置: `scripts/`
| 脚本 | 功能 |
|---|---|
| `maple079_packet.py` | 完整包 codec (加密/解密/解析) |
| `t055_syn_client_v2.py` | 合成客户端 (登录→进场→聊天→移动) |
| `t056_client.py` | 带游戏动作的合成客户端 |
| `t053_vm_control.py` | QEMU 虚拟机控制 |
| `t053_capture_analyze.py` | 内存捕获分析 |

### 位置: `.work/task-*/`
每个任务的工作目录包含该任务的分析脚本。关键目录:
- `.work/task-036/` — 游戏体恢复工具
- `.work/task-050/` — 语义分析数据库
- `.work/task-058/` — 批量函数标注
- `.work/task-059/` — 深度语义恢复
- `.work/task-061/` — 游戏公式提取
- `.work/task-063/` — 移动物理缺口分析

## 3. 服务端

### 启动
```powershell
python .work\task-053\start_stack.py
# MySQL 自动启动, 服务端 JAR 启动, 端口 7575
# 登录端口 9555
```

### 账号
- fl1234 / 123456 (角色 ID 25 = 江浩浩)
- fl2223 / 123456 (角色 ID 23 = 江浩 Lv200)

### WZ 数据位置
```
.work\task-002\server\079V5\wz\
  Map.wz\Map\Map0-Map9\ (4260 XML files)
  String.wz\ (15 XML files)
  Item.wz\ (6 subdirs)
  Character.wz\ (46 files + Weapon/ Cap/ etc.)
```

## 4. 虚拟机

### VM 存储 (已迁移到 E:)
```
E:\vm-store\
  task-024-vm\win7x86.qcow2    — Win7 x86 SP1 虚拟机
  task-024-vm\client.img        — 5GB 客户端磁盘
  raw\                           — Win7 ISO 和客户端原始 RAR
  task-036-captures\             — 内存捕获
```

### 原路径 (junction)
`.work\task-024\vm` → `E:\vm-store\task-024-vm`
`.raw` → `E:\vm-store\raw`

### WSL QEMU
```bash
wsl -d Ubuntu -u root --exec sh -c \
  "qemu-system-i386 -name win7x86 -machine pc,accel=kvm -m 2048 -smp 2 -cpu coreduo \
   -drive file=/mnt/e/vm-store/task-024-vm/win7x86.qcow2,if=ide,index=0,media=disk,format=qcow2 \
   -drive file=/mnt/e/vm-store/task-024-vm/client.img,if=ide,index=1,media=disk,format=raw \
   -boot order=c -nic user -vga std -display none -usb -device usb-tablet \
   -monitor tcp:127.0.0.1:45454,server,nowait -daemonize"
```

## 5. GLM-4V 视觉模型

用于虚拟机屏幕分析:
```python
# 环境变量 ZAI_API_KEY
import base64, json, urllib.request

b64 = base64.b64encode(open('screenshot.png', 'rb').read()).decode()
body = {'model': 'glm-4v-flash', 'messages': [{
    'role': 'user', 'content': [
        {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{b64}'}},
        {'type': 'text', 'text': '描述这个屏幕...'}
    ]}]}
req = urllib.request.Request(
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    data=json.dumps(body).encode(),
    headers={'Authorization': f'Bearer {os.environ["ZAI_API_KEY"]}',
             'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=120) as r:
    print(json.loads(r.read())['choices'][0]['message']['content'])
```

## 6. 环境注意事项

- `PYTHONIOENCODING=utf-8` 必须设置
- capstone 5.0.7 + pefile 已安装
- 避免在 PowerShell 中直接写中文 (用 Python 文件)
- C 盘空间有限 — 大文件放 E 盘
- git push 可能需要代理: `git -c http.proxy= -c https.proxy= push origin main`
