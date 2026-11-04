# result

本目录用于保存 `task/` 中分析任务的**可提交研究结果**。

当前任务：

```text
task/001-cms079v5-baseline.md
```

对应本地输入：

```text
.raw/怀旧岛079V5客户端.rar
```

Task 001 完成后，预期至少生成：

```text
result/
├── README.md
├── 00-baseline.md
├── file-manifest.csv
├── pe-summary.json
├── main-client-imports.txt
└── interesting-strings.txt
```

## 可以放入 result 的内容

- Markdown 分析报告；
- CSV / JSON 形式的文件清单、哈希和 PE 元数据；
- 经过筛选的 imports / strings；
- 函数地址、RVA、签名、结构和协议记录；
- 不包含原始受版权保护内容的复现命令和分析结论。

## 不要放入 result 的内容

- 原始或修改后的 EXE / DLL / SYS；
- WZ 文件；
- RAR / ZIP / 7z 客户端归档；
- crash dump / memory dump；
- Ghidra / IDA 大型本地工程数据库；
- 密钥、账号或其他敏感信息。

中间产物和解压内容统一放入 `.work/`；原始输入始终保留在 `.raw/`。
