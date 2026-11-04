import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as m  # noqa: E402

m.blob = m.WINDOW.read_bytes()
m.END = m.BASE + len(m.blob)
m.STRINGS = m.strings()
w = m.Walker()
w.run([(0x859780, "normal-root"), (0x859A61, "detection-root")])
print("blocks", len(w.blocks), "calls", len(w.calls))
for b in w.blocks:
    succ = [hex(x) for x in b["successors"]]
    note = "; ".join(b["notes"])[:110]
    print(f"{b['start']:#x}-{b['end']:#x} kind={b['kind']} succ={succ} preds={b['preds']} {note}")
print("calls:")
for c in w.calls:
    print(f"  {c['rva']:#x} {c['form']} callee={c['callee']} args={c['args']}")
