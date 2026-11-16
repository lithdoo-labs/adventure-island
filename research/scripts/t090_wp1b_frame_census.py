"""T090 WP1-B: G39 WZ frame census generator.

Enumerates, for the 13 target maps, every animated/static Back and Obj resource
frame referenced by the map .img, plus the MapHelper portal family, recording
per-frame properties (delay/a0/a1/z0/z1/origin/...) from the ORIGINAL Map.wz
(sha-pinned). Output: T090-G39-WZ-FRAME-CENSUS.csv.

Resource path conventions (per EV-103 namespace names + loader semantics):
  back ani=1  -> Back/<bS>/ani/<no>
  back ani=0  -> Back/<bS>/back/<no>
  obj         -> Obj/<oS>/<l0>/<l1>/<l2>
  portal      -> MapHelper.img/portal/game/{pv,ph,psh}[...]
"""
import csv
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

MAP_WZ = next(p for p in (REPO / ".work/task-001/extracted").iterdir()
              if p.is_dir()) / "Map.wz"
MAP_WZ_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"

MAPS = ["222000000", "222000001", "230030200", "230030100", "230030000",
        "230020300", "230020200", "230020100", "230020000", "230000000",
        "230000001", "230000002", "230000003"]

OUT = REPO / "research/result/stage-readiness/forensics/T090-G39-WZ-FRAME-CENSUS.csv"

TIMING_PROPS = ("delay", "a0", "a1", "z0", "z1")


def kids(node):
    ch = getattr(node, "children", None)
    return ch() if callable(ch) else (ch or [])


def parse_if(node):
    return node.parse() if hasattr(node, "parse") else node


def val(node):
    try:
        return node.value
    except Exception:
        return None


def props_of(node):
    return {p.name: val(p) for p in kids(parse_if(node)) if not list(kids(parse_if(p)))}


def resolve(root, path):
    """path like 'Back/folkvillige.img/back/0' -> node or None.
    Chain per-component .get() (falling back to a children scan), parsing
    each WzImage encountered (wzpy requires image parse before child access)."""
    node = root
    for part in path.split("/"):
        nxt = None
        try:
            nxt = node.get(part)
        except Exception:
            nxt = None
        if nxt is None:
            ch = getattr(node, "children", None)
            if callable(ch):
                ch = ch()
            else:
                ch = ch or []
            for c in ch:
                if c.name == part:
                    nxt = c
                    break
        if nxt is None:
            return None
        node = nxt
        if hasattr(node, "parse"):
            try:
                node = node.parse()
            except Exception:
                pass
    return node


def frame_frames(node):
    """Return list of (frame_name, props).

    A node is a FRAMESET when it has named frame children that themselves carry
    property children (e.g. pv -> 0,1,2...; each -> origin/delay/...). When the
    node's children are ALL direct properties (a WzCanvas: back/<no> static,
    single-frame obj <l2>), the node IS one frame — return [('<canvas>', props)]
    so canvas properties are never miscounted as frames."""
    node = parse_if(node)
    ck = list(kids(node))
    if not ck:
        return [("<canvas>", {})]
    grandkids = any(list(kids(parse_if(c))) for c in ck)
    if grandkids:
        return [(c.name, props_of(c)) for c in ck]
    # all children are properties -> this node is a single canvas frame
    props = {}
    for c in ck:
        v = val(c)
        if v is not None:
            props[c.name] = v
    return [("<canvas>", props)]


def main():
    h = hashlib.sha256()
    with open(MAP_WZ, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 22), b""):
            h.update(chunk)
    assert h.hexdigest() == MAP_WZ_SHA, "Map.wz sha mismatch"

    wz = WzFile.open(str(MAP_WZ), region="EMS")
    root = wz.root

    rows = []

    def emit(map_id, consumer, res_path, frame, props, note):
        explicit = {k: props[k] for k in TIMING_PROPS if k in props}
        rows.append({
            "map_id": map_id,
            "consumer": consumer,
            "resource_path": res_path,
            "frame": frame,
            "delay": props.get("delay", ""),
            "delay_explicit": "delay" in props,
            "a0": props.get("a0", ""),
            "a1": props.get("a1", ""),
            "z0": props.get("z0", ""),
            "z1": props.get("z1", ""),
            "other_props": ";".join(
                f"{k}={v}" for k, v in props.items()
                if k not in TIMING_PROPS + ("origin",)) or "",
            "origin": str(props.get("origin", "")),
            "note": note,
        })

    seen_res = {}

    for m in MAPS:
        img = resolve(root, f"Map/Map2/{m}.img")
        if img is None:
            rows.append({"map_id": m, "consumer": "MAP-MISSING", "resource_path": "",
                         "frame": "", **{k: "" for k in
                         ("delay", "delay_explicit", "a0", "a1", "z0", "z1",
                          "other_props", "origin", "note")}})
            continue
        # ---- back records
        back = None
        for c in kids(img):
            if c.name == "back":
                back = parse_if(c)
        if back is not None:
            for ent in kids(back):
                p = props_of(ent)
                bS = str(p.get("bS", ""))
                ani = str(p.get("ani", "0"))
                no = str(p.get("no", ""))
                sub = "ani" if ani == "1" else "back"
                res = f"Back/{bS}.img/{sub}/{no}"
                node = resolve(root, res)
                if node is None:
                    emit(m, f"back[{ent.name}] ani={ani}", res, "RESOURCE-MISSING",
                         {}, "resource node not present in Map.wz Back/")
                    continue
                for fname, fprops in frame_frames(node):
                    emit(m, f"back[{ent.name}] ani={ani} front={p.get('front', 0)}",
                         res, fname, fprops, "")
        # ---- obj records inside layers 0..7
        for layer in "01234567":
            lay = None
            for c in kids(img):
                if c.name == layer:
                    lay = parse_if(c)
                    break
            if lay is None:
                continue
            objsec = None
            for c in kids(lay):
                if c.name == "obj":
                    objsec = parse_if(c)
                    break
            if objsec is None:
                continue
            for ent in kids(objsec):
                p = props_of(ent)
                oS = str(p.get("oS", ""))
                l0 = str(p.get("l0", ""))
                l1 = str(p.get("l1", ""))
                l2 = str(p.get("l2", ""))
                res = f"Obj/{oS}.img/{l0}/{l1}/{l2}"
                node = resolve(root, res)
                if node is None:
                    emit(m, f"obj[L{layer}:{ent.name}] flow={p.get('flow', '')}", res,
                         "RESOURCE-MISSING", {}, "resource node not present in Map.wz Obj/")
                    continue
                for fname, fprops in frame_frames(node):
                    emit(m, f"obj[L{layer}:{ent.name}] flow={p.get('flow', '')}",
                         res, fname, fprops, "")
        seen_res[m] = True

    # ---- MapHelper portal family
    helper = resolve(root, "MapHelper.img")
    for fs in ("pv", "ph", "psh"):
        node = resolve(root, f"MapHelper.img/portal/game/{fs}")
        if node is None:
            emit("MapHelper", "portal/game", f"portal/game/{fs}", "MISSING", {}, "")
            continue
        # frames may be direct (pv) or nested (ph/psh -> default/N -> portalX -> frames)
        def walk_frames(n, prefix):
            for c in kids(n):
                cname = c.name
                cn = parse_if(c)
                ck = list(kids(cn))
                if not ck:
                    continue  # pure value node
                grandkids = any(list(kids(parse_if(x))) for x in ck)
                if grandkids:
                    walk_frames(cn, f"{prefix}{cname}/")
                else:
                    props = {}
                    for x in ck:
                        v = val(x)
                        if v is not None:
                            props[x.name] = v
                    emit("MapHelper", "portal/game", f"portal/game/{fs}",
                         f"{prefix}{cname}", props, "")
        walk_frames(node, "")

    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"rows written: {len(rows)} -> {OUT}")

    # summary
    n_explicit = sum(1 for r in rows if r["delay_explicit"] is True)
    n_missing = sum(1 for r in rows if r["frame"] == "RESOURCE-MISSING")
    print(f"frames with explicit delay: {n_explicit}")
    print(f"missing resources: {n_missing}")
    distinct_delay = sorted({r["delay"] for r in rows if r["delay_explicit"] is True},
                            key=lambda x: int(x))
    print(f"distinct explicit delay values: {distinct_delay}")


if __name__ == "__main__":
    main()
