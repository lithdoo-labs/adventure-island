# Task 001 — 怀旧岛079V5客户端初步分析

## 目标

对本地原始归档：

```text
.raw/怀旧岛079V5客户端.rar
```

执行一次**只读、可复现的初步静态分析**，建立后续逆向研究的样本基线。

本任务不要求破解、脱壳、绕过反作弊或修改客户端；重点是确认归档内容、文件哈希、PE 基础信息、依赖、可疑保护特征以及后续值得深入分析的入口。

所有最终结果统一写入仓库根目录：

```text
result/
```

临时解压和中间文件放到：

```text
.work/task-001/
```

`.raw/` 中的原始文件不得修改、重命名或覆盖。

---

## 执行约束

1. **只读原始样本**：不要直接修改 `.raw/怀旧岛079V5客户端.rar` 或其中解出的原始文件。
2. **不要提交原始客户端内容**：不要把 EXE、DLL、WZ、RAR、ZIP、dump 等复制到 `result/`。
3. **不要执行未知二进制**：本任务默认只做静态分析。除非后续任务明确要求，否则不要启动客户端、DLL、启动器、更新器或第三方保护程序。
4. **不要尝试绕过保护**：如果发现壳、反调试、反作弊、驱动或其他保护组件，只记录证据和初步判断，不进行规避或移除。
5. **保留证据链**：所有结论尽量注明来自哪个文件、哪个字段、导入项、字符串或工具输出。
6. **工具缺失时不要阻塞**：优先使用本机已有工具；缺少某个工具时，记录缺失项并使用可替代工具继续。
7. **路径与文件名使用 UTF-8**：特别注意中文文件名，避免解压时发生乱码或路径丢失。

---

## 阶段 A：环境与输入确认

记录执行环境：

- 操作系统及版本；
- CPU 架构；
- Python 版本；
- `7z` / `unrar` / `bsdtar` 等实际使用的归档工具及版本；
- PE 分析工具及版本，例如 `pefile`、`lief`、`objdump`、`rabin2`、Detect It Easy（DIE）等；
- 执行时间。

确认输入文件存在：

```text
.raw/怀旧岛079V5客户端.rar
```

计算归档本身：

- 文件大小；
- MD5；
- SHA-1；
- SHA-256。

如果归档不存在、损坏或需要未知密码：

- 不要猜密码或下载其他样本；
- 在 `result/00-baseline.md` 中明确记录阻塞原因；
- 仍然保存能够取得的归档元数据和哈希。

---

## 阶段 B：归档目录清单

优先先列出归档内容，再进行解压。

需要记录：

- RAR 格式/版本（工具能够识别时）；
- 是否加密；
- 是否为多卷归档；
- 文件总数；
- 目录总数；
- 归档内总未压缩大小；
- 顶层目录结构；
- 文件扩展名统计。

将完整文件清单保存为：

```text
result/file-manifest.csv
```

建议字段：

```text
relative_path,size,extension,md5,sha1,sha256,notes
```

如果只列目录阶段无法取得内部文件哈希，可在解压后补齐。

特别标记以下类型：

```text
*.exe
*.dll
*.sys
*.wz
*.ini
*.cfg
*.dat
*.pak
*.manifest
*.xml
*.txt
```

---

## 阶段 C：安全解压到工作目录

将归档完整解压到：

```text
.work/task-001/extracted/
```

要求：

- 不覆盖 `.raw/`；
- 不执行任何解出的程序；
- 保留原始目录层级；
- 记录解压工具、命令和是否出现 CRC / 文件名编码 / 路径错误。

对所有解出的普通文件计算 SHA-256；对 EXE/DLL/SYS 额外计算 MD5 和 SHA-1，写回 `result/file-manifest.csv`。

---

## 阶段 D：识别关键组件

从文件名、PE 元数据、目录位置和字符串中识别可能属于以下角色的文件：

- 主游戏客户端；
- Launcher / Patcher / Updater；
- HackShield / GameGuard / XignCode 或其他保护、反作弊相关组件；
- 网络或加密相关 DLL；
- DirectX / 图形 / 音频相关组件；
- 输入法、浏览器、广告或网页组件；
- 驱动程序；
- WZ 资源；
- 配置文件。

**不要仅凭文件名下结论。** 对关键判断至少给出一个额外证据，例如 PE CompanyName、ProductName、导入表、版本资源、字符串或签名工具结果。

预期需要重点确认是否存在：

```text
MapleStory.exe
```

如果主程序文件名不同，请解释判断依据。

---

## 阶段 E：PE 基线分析

对所有 EXE / DLL / SYS 读取基础 PE 信息，并重点详细分析主客户端。

至少记录：

- 文件名和 SHA-256；
- PE32 / PE32+；
- Machine；
- TimeDateStamp（同时注明该字段可能被伪造）；
- ImageBase；
- AddressOfEntryPoint；
- SizeOfImage；
- Subsystem；
- DLL Characteristics；
- 节区名称、RVA、VirtualSize、RawSize、Characteristics、entropy；
- Import DLL 列表；
- Export（若存在）；
- Version Info；
- Debug Directory / PDB path（若存在）；
- TLS callbacks（若存在）；
- Overlay 大小（若存在）；
- Authenticode 签名状态（工具支持时）。

将机器可读摘要保存为：

```text
result/pe-summary.json
```

将主客户端的 imports 单独保存：

```text
result/main-client-imports.txt
```

对于主客户端，重点标记这些 API 是否存在，以及它们位于哪个导入 DLL：

### 网络

```text
WSAStartup
socket
connect
send
recv
WSASend
WSARecv
select
ioctlsocket
closesocket
gethostbyname
getaddrinfo
```

### 文件/资源

```text
CreateFileA/W
ReadFile
WriteFile
CreateFileMappingA/W
MapViewOfFile
FindFirstFileA/W
FindNextFileA/W
```

### 进程/模块

```text
CreateProcessA/W
LoadLibraryA/W
GetProcAddress
GetModuleHandleA/W
VirtualAlloc
VirtualProtect
VirtualQuery
```

### 调试/异常/时间

```text
IsDebuggerPresent
CheckRemoteDebuggerPresent
OutputDebugStringA/W
SetUnhandledExceptionFilter
QueryPerformanceCounter
GetTickCount
```

API 不存在并不代表功能不存在，可能通过动态解析或 wrapper 实现。仅作为后续定位线索。

---

## 阶段 F：字符串与网络线索

仅对关键 PE 文件提取可打印 ASCII / UTF-16LE 字符串，并优先整理：

- URL；
- 域名；
- IPv4 文本；
- `.wz` 文件名；
- `.dll` / `.sys` 文件名；
- 错误信息；
- 日志路径；
- 注册表路径；
- mutex / event 名称；
- `login`、`server`、`channel`、`world`、`socket`、`packet` 等可能有意义的词；
- 调试/PDB 路径；
- 保护或反作弊产品名。

将筛选后的结果保存到：

```text
result/interesting-strings.txt
```

不要把数十万条无筛选字符串直接提交到结果目录。

如果发现域名/IP，只记录，不连接、不扫描、不发送请求。

---

## 阶段 G：保护/壳的初步判断

使用静态指标判断主客户端是否可能存在 packing / protector：

- 节区名称异常；
- 节区 entropy 明显偏高；
- EntryPoint 位于异常节区；
- Import Table 极少；
- 大量动态 API 解析；
- overlay；
- DIE/PEiD 类工具识别结果；
- 明显保护产品字符串。

结论使用保守措辞，例如：

```text
未发现明显 packing 指标
疑似存在 packing/protector
静态证据不足，暂不能判断
```

不要在本任务中尝试脱壳或绕过保护。

---

## 阶段 H：WZ 基线

对所有 `.wz` 文件至少记录：

- 相对路径；
- 文件大小；
- SHA-256；
- 是否以预期的 WZ/PKG 文件特征开头（仅在能可靠判断时记录）；
- 文件集合名称，例如 Base / Character / Effect / Etc / Item / Map / Mob / Morph / Npc / Quest / Reactor / Skill / Sound / String / TamingMob / UI 等。

当前任务**不要求完整解析 WZ 内容**。

如果存在重复、额外或命名异常的 WZ 文件，在基线报告中单独指出。

---

## 最终产物

完成后，`result/` 至少应包含：

```text
result/
├── README.md
├── 00-baseline.md
├── file-manifest.csv
├── pe-summary.json
├── main-client-imports.txt
└── interesting-strings.txt
```

可以增加辅助文件，但禁止复制原始客户端二进制或完整 WZ 数据。

### `result/00-baseline.md` 必须包含

按以下结构编写：

```markdown
# 怀旧岛079V5客户端 — Baseline

## 1. Input
## 2. Environment
## 3. Archive Summary
## 4. File Layout
## 5. Main Client Identification
## 6. PE Summary
## 7. Imports of Interest
## 8. Strings / Network Indicators
## 9. WZ Inventory
## 10. Protection / Packing Indicators
## 11. Notable Findings
## 12. Uncertainties
## 13. Recommended Next Steps
## 14. Reproduction Commands
```

其中：

- `Notable Findings` 只写有证据支持的发现；
- `Uncertainties` 明确区分事实与推测；
- `Recommended Next Steps` 给出下一轮逆向最值得做的 3–8 项工作；
- `Reproduction Commands` 保存本次实际使用的重要命令，方便重跑。

---

## 完成判定

满足以下条件才视为 Task 001 完成：

- [ ] 原始 RAR 已计算 SHA-256；
- [ ] 已生成完整文件清单和关键文件哈希；
- [ ] 已识别主客户端或明确说明无法识别；
- [ ] 已生成主要 PE 元数据；
- [ ] 已整理主客户端 imports；
- [ ] 已整理筛选后的关键字符串；
- [ ] 已形成 WZ 文件清单；
- [ ] 已记录保护/packing 的静态判断及证据；
- [ ] 未执行未知客户端程序；
- [ ] 未修改 `.raw/`；
- [ ] 未将原始客户端二进制复制到 `result/`；
- [ ] `result/00-baseline.md` 已给出下一步逆向建议。

完成后，不要只在终端输出结论；务必将所有最终结果写入 `result/`。
