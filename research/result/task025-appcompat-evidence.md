# Task 025 — Phase B AppCompat / PCA evidence (read-only)

Guest: Windows 7 Professional SP1, 6.1.7601, x86, `WIN7X86LAB`, QEMU snapshot
`win7x86-clean` restored before every run. Client
`MapleStory.exe` SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
(revalidated in-guest with `certutil` in every run: `hash-maplestory.txt`).

## 1. Why Windows flags the executable (confirmed, system SDB)

The guest's own system compatibility database
(`C:\Windows\AppPatch\sysmain.sdb`, 4,075,336 bytes, extracted read-only in Task 024;
parsed on the host in Task 025 with `.work/task-024/vm/parse_sdb.py`) contains an
EXE entry that matches the client by metadata only:

| Field | Value |
| --- | --- |
| EXE NAME | `MapleStory.exe` |
| MATCHING_FILE NAME | `*` (any file name) |
| Company (0x6009) | `Wizet` |
| PRODUCT_NAME | `Wizet MapleStory` |
| UPTO_BIN_FILE_VERSION | `0x10000FFFFFFFF` (65536.65535.65535 — matches every version) |
| APPHELP PROBLEMSEVERITY | `1` = **MINORPROBLEM** (not HARDBLOCK, no SHIM) |
| APPHELP FLAGS | 1 (message-only entry) |
| APPHELP SUMMARY_MSG_RC_ID | 10002 |

Conclusion: the warning is triggered by the executable's version-resource identity
(company `Wizet`, product `Wizet MapleStory`), not by file hash, file name, code
signature status, architecture, or launch arguments. Because the match ceiling is
effectively "any version", the entry is unavoidable for this client family short of
modifying the executable's version resource (out of scope and explicitly forbidden).

Evidence tag: **confirmed-runtime** for the dialog behavior below;
**static-only** for the SDB structure itself (parsed offline).

## 2. MapleStory.exe metadata and signature

From the in-guest, read-only checks (`exe-versioninfo.txt`, `exe-signature.txt` of
every run; identical across all runs):

- Authenticode signature: **Valid**, signer `CN=NEXON Corp., OU=Development
  Department, O=NEXON Corp., L=Gangnam-gu, S=Seoul, C=KR`.
- The UAC prompt (manifest `requireAdministrator`) names the program
  `MapleStory China`, publisher `NEXON Corp.` (Task 024 record; unchanged).
- Version/product fields are the `Wizet` / `Wizet MapleStory` values above, which is
  what the SDB entry matches on.

## 3. PCA runtime behavior in every Phase A run

Consistent across A1R1, A1R2, A1R3, A2R1, A3R1, A1P (no Procmon except A1P):

1. The `Microsoft-Windows-ApplicationExperienceInfrastructure` **Event ID 1**
   is written at process creation (t0 + 0.08…0.3 s), *before* the dialog is visible,
   with the text: "应用程序(Maple story,发行商 Wizet)存在兼容性问题: Maple story
   与此版本的 Windows 不兼容。有关详细信息，请联系 Wizet。"
2. The Program Compatibility Assistant dialog (`#32770`, buttons
   联机检查解决方案 / **运行程序** / 取消) appears t0 + 1.7…3.4 s.
3. The observer clicks 运行程序 once (in-guest `BM_CLICK`, timed in `pca.txt`),
   t0 + 1.75…3.5 s. The dialog closes and never returns.
4. After the click the process keeps executing. In spin-outcome runs it burns
   ~0.95 CPU-seconds per wall second for the whole 150 s window; in dialog-outcome
   runs it finishes ~2.6–2.7 CPU-seconds of work and idles in its own modal window.
   Either way, **PCA dismissal does not stop the process and does not gate visible
   progression by itself**.

## 4. No AppCompat state is written before vs after (confirmed)

For every run, the read-only registry snapshot taken before launch
(`reg-gate-before.txt`) is **byte-identical** to the one taken after the sampling
window (`reg-after.txt`):

- `HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store` — absent/empty both times (no PCA store entry is created by clicking 运行程序).
- `HKCU\...\AppCompatFlags\Layers` (HKCU and HKLM) — absent/empty. No compatibility
  layer is applied.
- `HKCU\Software\WinLicense`, `HKCU\Software\WLkt`, `HKLM\SOFTWARE\WLkt`,
  `HKCU\Software\Wine` — absent before and after (protector keys never created).

Services `SICE`, `SIWVID`, `NTICE`, `oreans32`, `oreansx64`, `ehsvc` are absent
before and after every run; `driverquery` output is identical before/after; the
`oreans*` file search over the client directory and `system32\drivers` returns
"找不到文件" in every run.

## 5. `apphelp.dll` presence

`apphelp.dll` is loaded in the process from the first module sample (t0 + ~2 s) in
every run — spin and dialog outcomes alike — and stays loaded through the sampling
window (`modules-final.txt`). This is consistent with the SDB APPHELP entry being
evaluated in-process. There is no evidence that apphelp performs further work after
the dialog is dismissed: no shims are installed (registry unchanged), no
compatibility-related module appears later, and the process keeps running
identically with or without the extra observer/Procmon instrumentation.

## 6. Interpretation

- The PCA warning is a **message-only MINORPROBLEM entry** matched on
  Wizet/Wizet-MapleStory metadata; it fires identically for A1/A2/A3 and for both
  drive-letter layouts.
- Clicking 运行程序 leaves **no persistent trace** and applies **no compatibility
  layer**. After the click the process's own code continues.
- Therefore **PCA/appcompat is not causally dominant after Run program** in any
  observed run (Route C is not supported by this evidence). The post-PCA outcome
  (spin vs loader-success dialog) is governed by something else — see the main
  report: the outcome tracks which drive letter the client disk mounted as, not the
  launch arguments.

Evidence tags: dialog behavior, event ID, registry no-op, module presence =
**confirmed-runtime**; SDB internals = **static-only** (offline parse of an
extracted copy).
