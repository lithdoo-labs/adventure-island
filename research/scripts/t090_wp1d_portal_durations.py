"""T090 WP1: portal duration scenarios from the ORIGINAL WZ frame data.

Combines the proven engine semantics (t090_wp1d_timeline_model) with the
actual Map.wz frame census (T090-G39-WZ-FRAME-CENSUS.csv) to compute portal
family durations under each candidate consumer default, clearly separating
ORIGINAL WZ facts from default-based estimates. Output:
T090-G39-PORTAL-DURATIONS.csv
"""
import csv
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "research/scripts"))
from t090_wp1d_timeline_model import timeline  # noqa: E402

CENSUS = REPO / "research/result/stage-readiness/forensics/T090-G39-WZ-FRAME-CENSUS.csv"
OUT = REPO / "research/result/stage-readiness/forensics/T090-G39-PORTAL-DURATIONS.csv"

rows = list(csv.DictReader(open(CENSUS, encoding="utf-8")))


def frames_of(res_path, prefix):
    """Frames of portal/game/<res_path> whose frame name starts with prefix."""
    out = []
    for r in rows:
        if (r["consumer"] == "portal/game" and r["resource_path"] == f"portal/game/{res_path}"
                and r["frame"].startswith(prefix)):
            d = r["delay"]
            out.append(int(d) if d else None)
    return out


FAMILIES = [
    ("pv", "pv", "", 8),
    ("portalStart (ph/default)", "ph", "default/portalStart/", 4),
    ("portalContinue (ph/default)", "ph", "default/portalContinue/", 7),
    ("portalExit (ph/default)", "ph", "default/portalExit/", 3),
]

out_rows = []
for name, res, prefix, expect in FAMILIES:
    fr = frames_of(res, prefix)
    n_explicit = sum(1 for d in fr if d is not None)
    scen = {}
    for default in (0, 60, 120, 150, 180, 1000):
        delays = [d if d is not None else default for d in fr]
        tl = timeline(delays, scale=1000, repeat=None)
        scen[default] = tl["end_timestamps"][-1] if tl["end_timestamps"] else 0
    out_rows.append({
        "family": name,
        "wz_frames": len(fr),
        "fsdb_expected": expect,
        "frames_match_fsdb": len(fr) == expect,
        "frames_with_explicit_delay": n_explicit,
        "explicit_delays": ";".join(str(d) for d in fr if d is not None),
        "duration_if_default_0": scen[0],
        "duration_if_default_60": scen[60],
        "duration_if_default_120": scen[120],
        "duration_if_default_150": scen[150],
        "duration_if_default_180": scen[180],
        "duration_if_default_1000": scen[1000],
        "note": ("original WZ frames carry NO explicit delay (verified this "
                 "round); effective duration depends on the per-frame consumer "
                 "default which is NOT yet byte-located for the portal family "
                 "(the flat portal-record delay read 0x71A72A defaults 0 and "
                 "is a different dataflow); the T089 960/480/840/360 ms figures "
                 "correspond to the default-120 column"),
    })

with open(OUT, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(out_rows)
for r in out_rows:
    print(r["family"], r["wz_frames"], "frames;",
          r["frames_with_explicit_delay"], "explicit;",
          "durations:", {k: r[k] for k in r if k.startswith("duration")})
print("->", OUT)
