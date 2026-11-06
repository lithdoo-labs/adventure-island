# WZ → FSDB converter

`convert_cms.py` is the CMS 079 converter used for the local validation. Importing it does not read a WZ archive or write an FSDB.

## Dependencies

Install the Python packages listed in `requirements.txt`. Pillow is enough for the synthetic tests. A real conversion also needs a local `wzpy` checkout; pass its parent directory with `--wzpy`. Do not copy that checkout into this repository. On the validation machine it lived under `.work/tools/wz-python`, which is gitignored.

## Synthetic tests

From the repository root:

```text
python -m unittest discover -s tests/wz_fsdb -v
```

These tests build their own nodes and files. They do not need a WZ archive. Tests named `test_repair_*` cover the original repair targets. Three tests also read the recorded collision, invalid-path, and UOL diagnostics from `tests/wz_fsdb/fixtures/`. Those JSON files are the same blobs as PR #1 `result/64-wz-fsdb-*.json`; `result/` itself is not part of this tree.

## Conversion

```text
python scripts/wz_fsdb/convert_cms.py --scope phase1 --wz-root <wz-root> --wzpy <directory that contains the wzpy package> --out <fsdb-output>
```

`--wz-root` is the directory that contains `Base.wz`, `Character.wz`, and the other packages. `--out`, `--report-dir`, and `--pixel-log` must be outside tracked source, or in a gitignored directory. The summary does not record those absolute paths.

`--scope all` walks every package. `--only Map.wz,String.wz` limits the run. This handoff does not ask for another full conversion.

## Current CMS079 result (2026-11-06)

**The one-time CMS079 full conversion has already completed locally. Do not rerun it for Issue #50.** This converter was selectively migrated from historical PR #1 at source blob `c3951951aecbfe720e19c43e495043c2e2ddd293`; the converter itself was not rewritten. The 16 data WZ packages produced the local, off-repository FSDB:

`E:\cms079-pr1-work\fsdb-all\[FSDB]cms`

The repository's [2026-11-06 validation report](../../docs/validation/cms079-wz-fsdb-real-closure.md) records the completed foreground run, 34,760 source IMG, 1,399,931 PNGs, 3,601 sounds, a real LoomRealm ContentClient record/group/resource read, and the Chromium Avatar loop (stand1, walk1, jump, brandish1, left/right) with no presentation failures. The independent GitHub [PWA CI run #42150011248](https://github.com/lithdoo-labs/adventure-island/actions/runs/42150011248) also passed. **The real full-WZ and Avatar checks were local, not hosted-GitHub tests.**

Issue #50's scope was formally reduced to **one-time full conversion plus reuse**. A separate `--scope avatar` export and crash-recovery `--batch-state`/WAL/`--finalize` are **not requirements** and have deliberately not been implemented in this PR #1-based converter. Use the complete FSDB and the current pinned LoomRealm Content Index/ContentClient to look up only the assets needed by each screen or AvatarPlan; do not recursively rescan all PNGs for each lookup.

**Verdict boundaries:** emitted-file counts match the converter summary (output accounting), but this is *not* proof of source-level losslessness. A `Character.wz` IMG named `01102670 .img` has an invalid trailing-space record key; the current converter rejects its struct entry even though four related PNGs were written under an encoded resource path. A few Canvas decodes failed in the pinned parser; their true source-vs-parser cause remains unproven. Historical dangling/cyclic UOLs remain. Full-client Integrity-valid is **PARTIAL / not PASS**, although the tested real Avatar/Content/Chromium path succeeded. See the validation report's anomaly audit.

Do not copy or commit the raw WZ files, complete FSDB, or resource bytes into the repository. Keep the validated output immutable and back it up to a *different physical storage device*.

## One-time backup and complete SHA-256 verification

A standard-library-only helper backs up the existing **`fsdb-all/` and `reports/`** directories. It does **not** run the converter, export a second Avatar DB or upload files to GitHub. It only copies an existing FSDB and its validation reports. Run it on the Windows computer where the actual `E:` drive is mounted, with `X:` replaced by an independently stored backup disk:

~~~powershell
python scripts/wz_fsdb/backup_artifacts.py backup --source "E:\cms079-pr1-work" --destination "X:\cms079-pr1-work-backup"
python scripts/wz_fsdb/backup_artifacts.py verify --destination "X:\cms079-pr1-work-backup" --source "E:\cms079-pr1-work"
~~~

The backup command writes `backup-manifest.jsonl` (relative path, size and SHA-256 for **every** saved file) plus `backup-manifest.sha256`, then verifies every copied file against that manifest and the source. `verify` independently re-reads and hashes both trees. It refuses symlinks, unexpected files, damaged copies, same-volume destinations by default, and an existing completed archive. If interrupted while copying, rerun with `backup ... --resume`; it checks existing copies before using them and **never silently overwrites mismatched bytes**. Keep the resulting backup and manifest off Git and on an independent disk.

For long-term use, retain both the working FSDB and the verified backup; also keep the WZ input identity/summary, `reports/all/accounting.json`, and `reports/content-avatar-2026-11-06-session.json` (these are included under `reports/`). This repo has no access to the Windows drive, so **the backup is not verified until those commands actually return `VERIFIED` on the local machine**. Do not mark the backup requirement as fulfilled based on this README or the helper's tests alone.

## Original converter repair notes (historical)

The original PR #1 handoff text referred to conversion as "pending" when the converter had only synthetic coverage. That statement is superseded by the completed local run above. The repair preserves colliding record keys using `struct.WzRecordAlias` and records resource-path aliases in the conversion summary. Sound assets live in `resource.音` independently of PNG `resource.图`.
