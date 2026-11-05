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

A full 16-package conversion takes hours; one process run may be interrupted. With `--batch-state <dir>`:

- Each package writes `<dir>/<Package>.json` on completion: package name, input SHA-256, converter commit, status, elapsed time, counters and an output summary.
- Completed packages are skipped; a re-run of an interrupted package continues at-most-once through persisted manifests (record keys, group keys, resource identities, directory-name folds and alias tables live in `<dir>/manifest/`, never only in process memory).
- Cross-package resource conflicts are detected and aliased exactly as in a single-process run.
- Batch state written by a different converter commit is refused instead of silently extended.
- When all 16 packages are complete, run `--finalize` (or let a full single-process run finalize itself): it writes the `struct.WzRecordAlias` table, the table metadata and the aggregate summary.

Never reuse or incrementally overwrite a prior generated FSDB: construct a new output root.

## Verification (Node, pinned loom-realm)

```text
node scripts/wz_fsdb/verify_fsdb.mjs --fsdb <db-root> [--summary <convert-summary.json>] [--deep] [--out <report.json>]
node scripts/wz_fsdb/verify_content.mjs --fsdb <installation root that contains [FSDB]cms> --out <report.json>
```

`verify_fsdb.mjs` opens the database with the pinned `@loomrealm/fsdb` reader (Well-formed) and cross-checks the converter's accounting. `verify_content.mjs` prepares the real installation through `@loomrealm/game-launcher-hostra` + the desktop Content Service and reads records, groups and resources through the pinned `ContentClient`, verifying `contentVersion` against body SHA-256. Both print counts and classifications only; they never print asset bytes.

## Repair status

Colliding records are retained with unique FSDB keys and the generated `struct.WzRecordAlias` mapping; resource path aliases are reported as `resourceAliases` in the local JSON summary. Audio belongs to `resource.音`, independent of PNG `resource.图`; unknown audio payloads are stored as opaque `bin`, never fake MP3. Do not commit generated outputs.
