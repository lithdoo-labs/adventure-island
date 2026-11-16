"""T090 WP1-B summary: census analysis -> per-consumer delay distributions."""
import csv
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CSV = REPO / "research/result/stage-readiness/forensics/T090-G39-WZ-FRAME-CENSUS.csv"

rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
print(f"total rows: {len(rows)}")

groups = defaultdict(list)
for r in rows:
    c = r["consumer"]
    if c.startswith("back") and "ani=1" in c:
        g = "back ani=1"
    elif c.startswith("back"):
        g = "back ani=0"
    elif c.startswith("obj"):
        g = "obj"
    else:
        g = c
    groups[g].append(r)

for g, rs in sorted(groups.items()):
    n = len(rs)
    expl = [r for r in rs if r["delay_explicit"] == "True"]
    missing = [r for r in rs if r["frame"] in ("RESOURCE-MISSING", "MISSING")]
    dist = Counter(r["delay"] for r in expl)
    print(f"\n== {g}: {n} frame rows | explicit delay: {len(expl)} | missing-res rows: {len(missing)}")
    print("   top delays:", dist.most_common(12))
    if expl and g != "back ani=0":
        pass

# distinct animated resources and their delay profiles
res_expl = defaultdict(lambda: [0, 0, set()])
for r in rows:
    if r["resource_path"]:
        e = res_expl[r["resource_path"]]
        e[1] += 1
        if r["delay_explicit"] == "True":
            e[0] += 1
            e[2].add(int(r["delay"]))
multi = {k: v for k, v in res_expl.items() if v[1] > 1}
print(f"\ndistinct resources: {len(res_expl)}; multi-frame resources: {len(multi)}")
all_default = [k for k, v in multi.items() if v[0] == 0]
print(f"multi-frame resources with NO explicit delay on any frame: {len(all_default)}")
partial = [k for k, v in multi.items() if 0 < v[0] < v[1]]
print(f"multi-frame resources with PARTIAL explicit delay: {len(partial)}")
full = [k for k, v in multi.items() if v[0] == v[1]]
print(f"multi-frame resources with ALL frames explicit: {len(full)}")
if all_default:
    print("example all-default resources:", all_default[:8])
if partial:
    print("example partial resources:", partial[:5])
    for k in partial[:3]:
        print("   ", k, sorted(res_expl[k][2]))

# a0/a1 coverage
a0 = sum(1 for r in rows if r["a0"])
a1 = sum(1 for r in rows if r["a1"])
z0 = sum(1 for r in rows if r["z0"])
print(f"\nframes with a0: {a0}, a1: {a1}, z0: {z0}")
