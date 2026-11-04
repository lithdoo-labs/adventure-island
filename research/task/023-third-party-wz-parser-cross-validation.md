# Task 023 — Third-Party WZ Parser Cross-Validation

## 0. Purpose

Use mature third-party MapleStory WZ libraries to independently validate the current CMS079 WZ conclusions, instead of continuing to rely on a single custom parser implementation.

This task is a **cross-validation task**, not a format-reimplementation task.

Primary questions:

1. Can multiple mature WZ implementations parse the same 16 CMS079 PKG1 archives?
2. Do they independently agree that the archive version is 79?
3. Do they agree on the actual WZ IV/key selection used by this private-server package?
4. Do they produce the same normalized image/directory tree?
5. Do they agree on sampled property trees, Canvas pixels, and link/UOL semantics?
6. Can at least one mature pre-Big-Bang implementation independently reproduce the current `List.wz` result of 1,258 ordered entries?
7. Which library should become the primary automation dependency, and which should remain the correctness oracle?

This task does **not** modify any WZ resource and does not require reverse engineering the protected `MapleStory.exe`.

---

## 0.1 Repository synchronization gate

Task 023 must start from the latest clean `origin/main`, following the same execution discipline as the previous tasks.

From the repository root, first record:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

Then fetch the remote state:

```text
git fetch origin
```

If the checkout has tracked/uncommitted changes, **do not** stash, reset, discard, overwrite, rebase, or otherwise hide them. Stop before synchronization and report the blocker.

If the working tree is clean but the current branch is not `main`, switch to `main`.

Then update only by fast-forward:

```text
git pull --ff-only origin main
```

Record the resulting starting commit:

```text
git rev-parse HEAD
```

The final Task 023 report must include this **starting HEAD** so that all test results can be tied to an exact repository baseline.

If `origin/main` cannot be fast-forwarded cleanly, stop and report the repository-state blocker. Do not force, reset, or silently resolve history.

Only after this synchronization gate should the task read existing results and begin WZ validation.

---

## 0.2 Directory and artifact contract

Run all commands from the repository root unless a third-party build explicitly requires another working directory.

The directory roles for Task 023 are fixed:

```text
.raw/
    proprietary/raw inputs; read-only

task/
    task specifications; do not rewrite Task 023 during execution unless explicitly required

.work/task-023/
    all scratch data, third-party repositories, harness-only code, build outputs,
    parser raw exports, temporary images/audio, logs and large intermediate files

result/
    ALL permanent Task 023 findings that should be committed

scripts/
    only reusable, project-owned generic orchestration/cross-check scripts

glm-work/
    may be READ as prior research evidence, but Task 023 must not place new final
    deliverables here; formal Task 023 outputs belong in result/ and scripts/
```

Recommended scratch layout:

```text
.work/task-023/
├── tools/
│   ├── wz-python/
│   ├── MapleLib/
│   ├── Harepacker-resurrected/
│   └── WzComparerR2/
├── harness/
├── build/
├── output/
├── samples/
└── logs/
```

Permanent findings must be written directly under `result/`; do not leave the only copy of an important conclusion in `.work/` or `glm-work/`.

Third-party source trees and one-off harnesses remain under `.work/task-023/` and must not be committed.

---

## 1. Existing evidence to preserve

Read after the repository synchronization gate:

- `README.md`
- `task/023-third-party-wz-parser-cross-validation.md`
- `result/20-wz-inventory.md`
- `result/19-wizet-dlls.md`
- `result/listwz-entries.csv`
- `result/wz-directory-index.csv`
- `result/file-manifest.csv`

If present in the synchronized checkout, also inspect:

- `glm-work/scripts/maple079_wz_dir.py`
- `glm-work/scripts/maple079_listwz.py`

Current conclusions to test, not assume:

- 16 PKG1 WZ archives parse as version 79.
- The private-server WZ set is currently believed to use IV bytes `B9 7D 63 E9`.
- The existing directory inventory contains roughly 36,000 `.img` nodes.
- `Base.wz` exposes 15 links corresponding exactly to the other 15 WZ archives.
- `List.wz` currently decodes to 1,258 ordered external `.img` mount entries.
- Existing `List.wz` decoding uses the WZ AES keystream with IV `B9 7D 63 E9`, reset to keystream index 0 for each string.

These are hypotheses/baselines for this task. A third-party disagreement must be investigated rather than normalized away.

---

## 2. Candidate third-party libraries

At minimum evaluate the following three toolchains/implementations.

### 2.1 `Leonana69/wz-python`

Repository:

`https://github.com/Leonana69/wz-python`

Role:

- preferred Python automation candidate;
- convenient for scripted tree/property extraction;
- already demonstrated basic compatibility with the current WZ set, but Task 023 must pin a specific commit and reproduce the result cleanly.

### 2.2 `lastbattle/MapleLib` / `Harepacker-resurrected`

Repositories:

- `https://github.com/lastbattle/MapleLib`
- `https://github.com/lastbattle/Harepacker-resurrected`

Role:

- primary correctness oracle candidate for legacy/pre-Big-Bang MapleStory WZ behavior;
- especially valuable for `List.wz`, links, Canvas and old-client compatibility;
- if MapleLib alone is inconvenient to invoke, use HaRepacker as the host application/library caller while recording the exact MapleLib commit used by that checkout.

### 2.3 `Kagamia/WzComparerR2`

Repository:

`https://github.com/Kagamia/WzComparerR2`

Role:

- secondary oracle candidate;
- use `WzLib`/library code or a small non-interactive harness if practical;
- GUI spot-checks are acceptable for a few nodes, but final comparisons must be machine-readable when possible.

### 2.4 Optional additional oracle

If setup cost is low, evaluate one of:

- `https://github.com/toyobayashi/libwz`
- `https://github.com/davipk/wzlib-rs`

An optional oracle is useful but must not block completion of the minimum three-library plan.

---

## 3. Dependency provenance and hygiene

All third-party repositories must be cloned under:

```text
.work/task-023/tools/
```

For every dependency record in the permanent Task 023 results:

- repository URL;
- exact commit SHA;
- license/SPDX or license filename;
- runtime/compiler version;
- build command;
- run command;
- whether an adapter or harness was needed;
- any local harness-only patch.

Recommended permanent provenance file:

```text
result/wz-third-party-sources.csv
```

Do not vendor third-party repositories into this repository.

Do not commit third-party binaries or generated resource dumps.

Do not modify third-party parser core logic merely to force agreement with the existing local result. If a minimal API adapter is needed, keep it separate from parser semantics.

---

## 4. Sample identity gate

Before invoking any parser, recompute SHA-256 for the 16 WZ archives and compare with `result/file-manifest.csv`.

Archives:

```text
Base.wz
Character.wz
Effect.wz
Etc.wz
Item.wz
Map.wz
Mob.wz
Morph.wz
Npc.wz
Quest.wz
Reactor.wz
Skill.wz
Sound.wz
String.wz
TamingMob.wz
UI.wz
```

Also hash `List.wz`.

If any hash differs from the recorded baseline, stop reusing existing tree/count/IV conclusions and clearly report the mismatch.

The WZ files remain read-only throughout the task.

---

## 5. Test A — Basic parser capability matrix

For every parser and every WZ archive, record:

```text
parser
parser_commit
archive
success
reported_version
region_enum_or_key_name
actual_iv_bytes
root_directory_count
root_image_count
recursive_image_count
warnings
error
```

Explicitly test these candidate IVs/regions when the library supports forced selection:

```text
BMS: 00 00 00 00
GMS: 4D 23 C7 2B
candidate/private-set: B9 7D 63 E9
```

Library region enum names are not authoritative. Always record the **actual four IV bytes** used.

Expected positive baseline to test:

```text
actual IV = B9 7D 63 E9
version = 79
```

Expected negative control:

- wrong IV should fail parsing, produce invalid directory names, or otherwise score clearly worse than the correct IV;
- do not modify the parser core merely to make the expected IV win.

Permanent output:

`result/wz-parser-capability-matrix.csv`

---

## 6. Test B — Full normalized tree comparison

Do not compare counts alone.

For each parser, export all directory and image paths from each archive into `.work/task-023/output/`, then write only the normalized comparisons/digests to `result/`.

Canonical path rules:

1. use `/` as separator;
2. do not include host absolute paths;
3. preserve original case for the authoritative comparison;
4. also produce a case-folded diagnostic form;
5. normalize only representational differences, not semantic names.

Example canonical path:

```text
Map/Map/Map0/100000000.img
Character/Cap/01002000.img
```

For every archive compute:

```text
sorted_paths = sorted(exact_image_paths)
SHA256(UTF8("\n".join(sorted_paths)))
```

Compare exact path sets pairwise.

Any mismatch must be classified as one of:

- real missing/extra image;
- directory-vs-link representation difference;
- lazy/deferred node representation;
- Unicode/case normalization difference;
- parser error;
- unexplained.

Permanent outputs:

- `result/wz-tree-crosscheck.csv`
- `result/wz-tree-digests.csv`

Success criterion:

- all correctly supporting parsers produce no unexplained `.img` path-set difference across all 16 archives.

---

## 7. Test C — `Base.wz` namespace projection

Independently extract the root links/directories in `Base.wz` from every parser.

Compare them to the filenames of the other 15 WZ archives.

Required summary:

```text
links-not-files = []
files-not-links = []
```

If a parser represents Base links as a special node rather than a directory, record that representation explicitly.

Include the permanent result in `result/wz-tree-crosscheck.csv` and summarize it in the final report.

---

## 8. Test D — Deterministic property-tree sample

Do not immediately canonicalize all ~36k images. First build a deterministic sample of about 200 `.img` nodes.

Suggested distribution:

```text
Character   30
Map         30
Mob         25
Npc         20
Item        20
String      20
UI          20
Skill       15
TamingMob   10
Other       10
```

Mandatory anchors:

- `TamingMob/0001.img` (or the parser's equivalent full path);
- at least 5 Mob images;
- at least 5 NPC images;
- at least 5 Character equipment images;
- at least 5 Item images;
- at least 5 UI images;
- several String.wz tables;
- at least one normal Map image.

The sample must be deterministic. If selection uses hashing, document the algorithm and seed.

Canonicalize each property to:

```text
archive
image_path
property_path
canonical_type
canonical_value
```

Canonical type vocabulary:

```text
int
long
float
double
string
vector
canvas
sound
uol
link
subproperty
unknown
```

Rules:

- preserve exact Unicode strings;
- compare integer values exactly;
- compare floating values by exact representation if libraries expose the same type, otherwise document a minimal tolerance;
- normalize vectors to `x,y`;
- do not compare library class names.

Permanent output:

`result/wz-property-crosscheck.csv`

Acceptance targets:

- mandatory anchors: 100% path/value agreement where all libraries claim support;
- 200-image sample: >=99.9% property path/value agreement;
- every mismatch must be listed individually and explained or marked unexplained.

---

## 9. Test E — Canvas pixel equivalence

Do **not** compare exported PNG file hashes.

Different PNG encoders can generate different byte streams from identical pixels.

Choose at least 50 Canvas nodes across:

- Character;
- Mob;
- Map;
- UI;
- Item.

Normalize each decoded image to RGBA8888 and compare:

```text
width
height
RGBA byte-stream SHA-256
```

If a parser yields BGRA/ARGB, convert before hashing.

For mismatches, record the first differing pixel coordinate and both RGBA values when practical.

Raw pixel/PNG samples belong in `.work/task-023/samples/`; only hashes and mismatch metadata belong in `result/`.

Permanent output:

`result/wz-canvas-crosscheck.csv`

Acceptance target:

- every Canvas supported by at least two parsers should have identical width, height and normalized RGBA hash.

---

## 10. Test F — UOL / `_inlink` / `_outlink`

Collect at least 50 link-like properties across the sampled set.

For each parser record:

```text
raw_link_string
resolved_archive
resolved_image
resolved_property_path
resolution_status
```

Resolution statuses:

```text
resolved
unsupported
broken
ambiguous
```

Do not count `unsupported` as a wrong resolved value, but report support coverage separately.

Permanent output:

`result/wz-link-crosscheck.csv`

---

## 11. Test G — `List.wz` independent validation

This is a high-priority test.

Current baseline to challenge:

```text
entry_count = 1258
actual IV = B9 7D 63 E9
ordered Unicode path list recovered
```

Use the current local implementation only as one side of the comparison:

`maple079_listwz.py`

At least one mature third-party pre-Big-Bang implementation must independently parse or interpret `List.wz`.

Preferred oracle:

- MapleLib / HaRepacker-resurrected.

Optional additional oracle:

- `wzlib-rs` if its List.wz API is straightforward.

For every implementation export raw per-entry data to `.work/task-023/output/`:

```text
index
raw_or_original_path
normalized_path
```

Compute both:

```text
SHA256(UTF8("\n".join(raw_entries_in_original_order)))
SHA256(UTF8("\n".join(normalized_entries_in_original_order)))
```

Acceptance target:

```text
1258 / 1258 exact ordered match
```

The comparison must include:

- order;
- case;
- slash direction/normalization differences;
- Unicode content.

If a third-party parser normalizes paths internally, distinguish raw vs normalized output rather than silently changing the local baseline.

Permanent output:

`result/listwz-library-crosscheck.csv`

If no mature third-party library can expose List.wz entries without substantial parser modifications, classify this test as `blocked-by-library-interface`, not as validation success.

---

## 12. Optional Test H — Sound nodes

Only perform if at least two libraries can expose raw Sound payloads without large implementation work.

Sample 20 Sound nodes.

Compare:

```text
codec/container metadata
reported duration
raw compressed payload SHA-256
```

Prefer raw compressed payload comparison over decode/re-encode comparison.

Raw audio/payload material remains in `.work/task-023/` and is never committed.

This test is optional and must not block task completion.

---

## 13. Harness design

Create, if useful:

`scripts/maple079_wz_crosscheck.py`

Its responsibility is orchestration/canonicalization only:

- ingest machine-readable output from third-party harnesses;
- normalize paths;
- normalize property types;
- calculate tree/property/pixel digests;
- produce diffs and CSVs.

Do **not** copy a third-party WZ parser implementation into this script.

Small one-off C#/C++/Rust harnesses used solely to invoke third-party libraries must remain under `.work/task-023/harness/` unless they are generic, project-owned, and clearly worth preserving.

---

## 14. Performance measurements

Performance is secondary to correctness.

If easy, record for a full 16-archive directory traversal:

```text
wall time
peak RSS
exceptions
```

Do not repeatedly load multi-gigabyte archives solely for benchmarking.

Do not reject an otherwise correct oracle because it is slower.

---

## 15. Required permanent outputs

Task 023 formal deliverables belong in `result/` and `scripts/`, not `.work/` or `glm-work/`.

Produce as many of the following as applicable:

```text
result/23-wz-library-cross-validation.md
result/wz-third-party-sources.csv
result/wz-parser-capability-matrix.csv
result/wz-tree-crosscheck.csv
result/wz-tree-digests.csv
result/wz-property-crosscheck.csv
result/wz-canvas-crosscheck.csv
result/wz-link-crosscheck.csv
result/listwz-library-crosscheck.csv
```

Optional reusable project script:

```text
scripts/maple079_wz_crosscheck.py
```

Large raw parser exports remain in:

```text
.work/task-023/output/
```

Do not commit duplicate copies of the same Task 023 results under `glm-work/`.

---

## 16. Final library-selection decision

The final report must select, or explicitly decline to select, these roles:

```text
Primary automation
Correctness oracle
Secondary oracle
Custom code still required for
```

Expected candidate arrangement, subject to test results:

```text
Primary automation:
    wz-python

Correctness oracle:
    MapleLib / HaRepacker-resurrected

Secondary oracle:
    WzComparerR2.WzLib
```

Do not select a library only because it agrees with the current local implementation.

Consider:

- CMS079/pre-Big-Bang compatibility;
- List.wz support;
- property correctness;
- Canvas decoding;
- link resolution;
- reproducible automation;
- active maintenance;
- dependency/build complexity.

Also state explicitly that multiple MapleStory community libraries may share historical format knowledge. This task establishes engineering cross-consistency, not mathematical independence of implementations.

---

## 17. Minimum success criteria

Task 023 is complete when all of the following are true:

1. The task started from a recorded, synchronized `origin/main` commit.
2. Exact commits and licenses are recorded for at least three candidate libraries.
3. Sample hashes are revalidated.
4. The 16 WZ archives are tested by all practical candidate parsers.
5. Version and actual IV/key selection are compared across implementations.
6. Full normalized image-path sets are compared, not only counts.
7. Base.wz 15-link correspondence is independently checked.
8. A deterministic property sample is compared.
9. Canvas pixels are compared by normalized RGBA bytes, not PNG file bytes.
10. Link/UOL support is compared.
11. `List.wz` gets an independent mature-library validation attempt, with exact 1,258-entry comparison if supported.
12. Every unexplained mismatch is recorded.
13. A primary automation library and correctness oracle are chosen, or the reasons for declining are stated.
14. Permanent findings exist under `result/`, not only in `.work/` or `glm-work/`.

A library failing to build is a valid result only after reasonable environment/setup attempts are documented.

---

## 18. Repository and safety rules

Do not modify:

```text
.raw/
```

Do not commit:

- WZ files;
- IMG/resource extracts;
- bulk PNG exports;
- audio extracts;
- third-party repositories;
- third-party build artifacts;
- large JSON/tree dumps;
- `.work/` contents;
- machine-specific caches or local toolchains.

Before commit run:

```text
git status --short
git diff
git diff --cached
```

Verify that staged files are limited to expected Task 023 outputs under:

```text
result/
scripts/
```

Do not commit new Task 023 artifacts under `glm-work/`.

Suggested completion commit:

```text
Complete Task 023 third-party WZ parser cross-validation
```

Push normally:

```text
git push origin main
```

Do not force push.

If push is rejected because `origin/main` advanced during execution, do not force it. Fetch and report the divergence/blocker before modifying history.

---

## 19. Final report checklist

The final execution report must state:

- Task 023 completion status;
- synchronized starting HEAD;
- final local commit SHA;
- push status;
- all tested libraries and exact commit SHAs;
- license and build/runtime environment for each library;
- successful WZ count per parser;
- whether all parsers agree on version 79;
- whether `B9 7D 63 E9` is independently confirmed;
- wrong-IV negative-control outcome;
- exact tree-digest agreement/disagreement;
- total `.img` counts;
- Base.wz link-set result;
- property-sample agreement rate;
- Canvas normalized RGBA agreement count;
- link/UOL agreement and unsupported counts;
- List.wz exact ordered match count and ordered digests;
- any actual bug found in the existing local parser/results;
- selected Primary automation library;
- selected Correctness oracle;
- selected Secondary oracle;
- features still requiring custom code;
- generated permanent `result/` and `scripts/` files;
- blockers/unexplained mismatches.
