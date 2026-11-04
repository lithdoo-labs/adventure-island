import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402

table = rd.module_checksums()
IMMS = {
    0xADE47B07: "registry fill#1 -> slot 0x859CE5 (open-shape), gate 'R'",
    0x902E00E5: "registry fill#2 -> slot 0x859CE1 (close-shape), gate 'R'",
    0xB9BF1235: "registry fill#3 -> slot 0x81A829 (set-shape), gate 'R'",
    0x98781034: "registry fill#4 -> slot 0x8191E9 (close2), gate 'R'",
    0xC005DBD4: "registry fill#5 -> slot 0x819C95 (unknown), gate 'R'",
    0x99395F90: "driver stage @0x85FFE5",
    0x90045206: "driver stage @0x86003F",
    0xBC907028: "driver stage @0x8600C5",
    0xD9DA1CE9: "driver stage @0x86017C",
    0xBADE0614: "driver stage @0x860203",
    0x8A0FB5E2: "driver stage @0x86023B",
    0x83D0B5F3: "driver stage @0x8602D6",
    0xF397A8A3: "driver stage @0x860343",
    0x8728FAF6: "driver stage @0x8603C3",
    0xBC8E6EFC: "driver stage @0x860456",
    0x8E726969: "driver stage @0x8604E6",
    0xB8F2EC64: "driver stage @0x86055E",
    0xCEE4E7B8: "driver stage @0x860594",
    0xC0764AA7: "driver/detection @0x860613",
    0xFCB148D8: "driver stage @0x860681",
    0x93C8F7C1: "driver stage @0x860849",
    0xE3E45B86: "driver stage @0x860B45",
    0xC7B15E87: "driver stage @0x860CBA (after \\\\.\\Oreans.vxd open)",
}
named = 0
for imm, note in IMMS.items():
    hit = table.get(imm)
    if hit:
        named += 1
    print(f"0x{imm:08X}  {hit[0] + '!' + hit[1] if hit else '???':<28} {note}")
print(f"\nnamed {named}/{len(IMMS)}")
