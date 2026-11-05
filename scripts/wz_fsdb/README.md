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

## Repair status

A full local-WZ conversion and FSDB Integrity-valid validation are **still pending**. Do not reuse or incrementally overwrite a prior generated FSDB: construct a new output root. Colliding records are retained with unique FSDB keys and the generated `struct.WzRecordAlias` mapping; resource path aliases are reported as `resourceAliases` in the local JSON summary. Audio now belongs to `resource.音`, independent of PNG `resource.图`. Do not commit these generated outputs.
