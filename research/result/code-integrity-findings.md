# Code Integrity：`0xC0E90008`

判断：**confirmed policy block**。

`HShield\HSUpdate.exe` 加载 `HShield\AspINet.dll` 时，Windows Code Integrity 把这次加载记成策略拒绝。状态码就是 `0xC0E90008`。这次任务没有再启动 `HSUpdate.exe`。同一天的 Operational 日志里已经有一整组相同事件，任务要求不要反复触发。

## 时间

本地时间 2026-10-09 16:33:21 出现第一组。16:34:40 到 16:34:46 又重复出现。下面以 `2026-10-09T08:34:46.178Z`（本地 16:34:46）这条为准。

| 项 | 值 |
| --- | --- |
| 进程映像 | `HShield\HSUpdate.exe` |
| 被加载映像 | `HShield\AspINet.dll` |
| 事件里的 Execution ProcessID | 21728 |
| `HSUpdate.exe` 自己的 PID | 日志没有单独给出 |

## 事件

日志：`Microsoft-Windows-CodeIntegrity/Operational`。

| 本地时间 | Event ID | 级别 | 内容 |
| --- | --- | --- | --- |
| 16:34:46 | 3033 | 错误 | `HSUpdate.exe` 加载 `AspINet.dll`，不满足 Enterprise signing level |
| 16:34:46 | 3077 | 错误 | 同上，并写明违反 code integrity policy。`Status` = `0xC0E90008` |
| 16:34:46 | 3089 | 信息 | 签名数量 0，Publisher `Unknown`，Issuer `Unknown` |
| 16:34:46 | 3118 | 信息 | 标题是 Smart App Control Block Details |

3077 的策略字段：

| 字段 | 值 |
| --- | --- |
| PolicyName | `VerifiedAndReputableDesktop` |
| PolicyGUID | `{0283ac0f-fff1-49ae-ada1-8a933130cad6}` |
| PolicyID | `27555.1000.240208` |
| Requested Signing Level | 2 |
| Validated Signing Level | 1 |
| SHA256 flat hash | `21F8027C6BE26C3957640C4C8862CB7A23B0B904AF8C42F2B70961F414A5D17E` |

这个 flat hash 和 `AspINet.dll` 的文件 SHA-256 相同。

3118 里 Defender 被调用过，`DefenderMadeCloudCall` 是 false，威胁名为空。`EnablementSwitchType` 是 1，`PreviousEnablementState` 是 2。

同一分钟的 Application 日志还有 `HSUpdate.exe` 2.0.0.20 的 AppHang（16:35:10，事件 1002/1001）。没有把 WER 报告复制出来。

`Microsoft-Windows-AppLocker/EXE and DLL` 在这个时间窗里没有匹配事件。Defender Operational 里没有另外一条点名这两个文件的记录。

## 当前策略状态

只读注册表，没有改任何值。

`HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy`：

| 值 | 数据 |
| --- | --- |
| `VerifiedAndReputablePolicyState` | 1 |
| `SAC_PreviousState` | 2 |
| `SAC_EnforcementReason` | 1 |
| `EmodePolicyRequired` | 0 |
| `SkuPolicyRequired` | 0 |

`HKLM\SYSTEM\CurrentControlSet\Control\CI\Config` 里 `VulnerableDriverBlocklistEnable` 是 1。

`citool.exe -lp` 返回 `0x80070005`（拒绝访问）。没有为了列出策略去提升权限，也没有调用任何关闭或替换策略的参数。

## 和 PE 损坏的区别

`AspINet.dll` 能被解析成完整的 PE32，导出函数有正常的 `push/call/ret` 指令，文件哈希也被 Code Integrity 算了出来。加载失败发生在签名级别检查，不是“文件头损坏”或“找不到导入 DLL”。`HSUpdate.exe` 自身的 Authenticode 是 Valid；被拒绝的是未签名的 `AspINet.dll`。

没有关闭 Smart App Control、Code Integrity、Defender 或 AppLocker。
