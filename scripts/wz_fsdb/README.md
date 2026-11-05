# WZ → FSDB converter

`convert_cms.py` is the CMS 079 converter used for the local validation. Importing it does not read a WZ archive or write an FSDB.

## Dependencies

Install the Python packages listed in `requirements.txt` (Pillow for synthetic tests; numpy/pycryptodome are needed by the external `wzpy` package during a real conversion). A real conversion also needs a local `wzpy` checkout at the pinned, cross-validated commit; pass its parent directory with `--wzpy`. Do not copy that checkout into this repository.

The pinned parser baseline (see `research/result/23-wz-library-cross-validation.md`): wz-python commit `79344c95774a911adf93a4d43c67e5fc51fa6e76` (MIT), region EMS, IV `B9 7D 63 E9`, WZ version 79. The converter refuses to open a package that does not report version 79.

## Synthetic tests

From the repository root:

```text
python -m unittest discover -s tests/wz_fsdb -v
```

These tests build their own nodes, records and PNG bytes. They do not need a WZ archive. They cover the historical PR #1 repair targets (record alias preservation, resource path encoding, UOL statuses, extension conflicts), the `avatar` wanted-canvas filter and the cross-batch resume guarantees. The historical run evidence stays on the historical branch; nothing under `result/**` is imported here.

## Scopes

```text
python scripts/wz_fsdb/convert_cms.py --scope <phase1|all|avatar> \
  --wz-root <wz-root> --wzpy <directory that contains the wzpy package> \
  --out <fsdb-output> [--report-dir <reports>] [--only Base.wz,...] \
  [--batch-state <state-dir>] [--finalize]
```

- `--wz-root` is the directory that contains `Base.wz`, `Character.wz`, and the other packages.
- `--out` is the FSDB database root itself; its directory name must start with `[FSDB]` for the LoomRealm FSDB reader (for example `.../fsdb-avatar/[FSDB]cms`). `--out`, `--report-dir`, `--pixel-log` and `--batch-state` must be outside tracked source, or in a gitignored directory. The summary does not record absolute paths.
- `phase1` keeps the historical sample semantics (three maps, one body, Bgm00).
- `all` processes the complete 16 data packages (`List.wz` is input-identity evidence only).
- `avatar` exports the five Look records (`00002000`, `00012000`, `00020000`, `00030000`, `01302000`), `struct.ZMap/order`, and only the Canvas PNGs those records' tested actions (`stand1`, `walk1`, `jump`, `brandish1`) actually reference. The filter mirrors the production AvatarPlan adapter (`systems/adventure-island/cms079-avatar-plan.mjs`); every other canvas of the five records is counted as `canvasesOutOfScope`, never silently dropped from the record.

## Resumable batches (scope `all`)

A full 16-package conversion takes hours; one process run may be interrupted. With `--batch-state <dir>` the run is crash-safe:

- Every output write is preceded by a journaled intent (identity + expected file SHA-256) in `<dir>/manifest/journal.jsonl`, executed as an atomic temp-file + `os.replace`, and confirmed by the file itself: an intent counts as committed iff its final file exists with the recorded hash. Directory-name folds, record remaps, alias candidates, resource aliases, collisions, errors and accounting counters are journaled too, so conflict decisions replay identically.
- On startup the journal is replayed: ops up to the last checkpoint (package completion) are trusted; later intents are verified against disk, so a kill between "output written" and "checkpoint" reuses the complete output, a kill before the write simply re-does the item, and an interrupted package never misjudges its own partial output as a key collision or triggers `resource-overwrite-refused`. Same-source items resume at-most-once; genuine different-source conflicts still alias exactly as in a single-process run.
- A `pkgStats` snapshot at each package start plus exact write-op deltas keep the accounting counters correct across interruptions; traversal counters (nodes, UOL classes) re-accumulate when the interrupted package is re-parsed.
- Each package writes `<dir>/<Package>.json` on completion: package name, input SHA-256, converter identity, status, elapsed time, counters and an output summary. Completed packages are skipped.
- The converter identity is a hash of the converter source itself (repository commit recorded alongside): batch state produced by a different converter is refused instead of silently extended, while doc/test-only commits between rounds do not force regeneration.
- When all 16 packages are complete, run `--finalize` (or let a full single-process run finalize itself): it writes the `struct.WzRecordAlias` table, the table metadata and the aggregate summary.

Crash-window model: process kill at any point is fully covered by the journal (intent lines are flushed to the OS before each write). Machine-level crashes can additionally lose journal tail lines; such an uncommitted final file is detected by hash mismatch and rewritten on the next encounter. Synthetic fault-injection tests (`tests/wz_fsdb/test_crash_recovery.py`) kill real conversions before the write, after the write and after a checkpoint, and assert byte-identical equivalence with an uninterrupted run.

Never reuse or incrementally overwrite a prior generated FSDB: construct a new output root.

## Verification (Node, pinned loom-realm)

```text
node scripts/wz_fsdb/verify_fsdb.mjs --fsdb <db-root> [--summary <convert-summary.json>] [--deep] [--out <report.json>]
node scripts/wz_fsdb/verify_content.mjs --fsdb <installation root that contains [FSDB]cms> --out <report.json>
```

`verify_fsdb.mjs` opens the database with the pinned `@loomrealm/fsdb` reader (Well-formed) and cross-checks the converter's accounting. `verify_content.mjs` prepares the real installation through `@loomrealm/game-launcher-hostra` + the desktop Content Service and reads records, groups and resources through the pinned `ContentClient`, verifying `contentVersion` against body SHA-256. Both print counts and classifications only; they never print asset bytes.

## Repair status

Colliding records are retained with unique FSDB keys and the generated `struct.WzRecordAlias` mapping; resource path aliases are reported as `resourceAliases` in the local JSON summary. Audio belongs to `resource.音`, independent of PNG `resource.图`; unknown audio payloads are stored as opaque `bin`, never fake MP3. Do not commit generated outputs.
