"""Static report of the stage-2 export walker and the SoftICE boundary.

Reads the Task 009 replay notes under .work/task-009 when they are present
and checks them against the decoded block. Does not attach to a process,
does not write guest memory, and does not invent a CreateFileA result.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".work" / "task-009"
RESULT = ROOT / "result"
CLIENT = ROOT / ".work" / "task-001" / "extracted" / "冒险岛online" / "MapleStory.exe"
EXPECTED_CLIENT = "5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d"

WALKER = 0x81CF01
DISPATCHER = 0x821750
SICE_RVA = 0x859507
SICE_LEA = 0x859708
SICE_CALL = 0x859757
SICE_TEST = 0x859779
ABSENT_FALL = 0x859780
PRESENT_TARGET = 0x859A61


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_replay() -> dict:
    path = WORK / "replay.json"
    if not path.exists():
        raise SystemExit(f"missing {path}; run maple079_stage2_continue.py first")
    return json.loads(path.read_text(encoding="utf-8"))


def check_images(replay: dict) -> None:
    if sha256(CLIENT) != EXPECTED_CLIENT:
        raise SystemExit("client SHA-256 changed; refuse stored RVAs")
    if replay["client_sha256"] != EXPECTED_CLIENT:
        raise SystemExit("replay client hash does not match the file")
    walker = (WORK / "round-1-post.bin").read_bytes()
    # round-1 slice starts at 0x81CEB5. Entry is cld; lodsw.
    if walker[0x81CF00 - 0x81CEB5 : 0x81CF03 - 0x81CEB5] != bytes.fromhex("fc66ad"):
        raise SystemExit("walker prologue is not cld; lodsw")
    window = (WORK / "probe-window.bin").read_bytes()
    base = 0x856000
    if window[SICE_RVA - base : SICE_RVA - base + 9] != b"\\\\.\\SICE\x00":
        raise SystemExit("SoftICE string missing from the probe window")
    if window[SICE_LEA - base : SICE_LEA - base + 2] != bytes.fromhex("8d9d"):
        raise SystemExit("SICE lea missing")
    if window[SICE_CALL - base : SICE_CALL - base + 2] != bytes.fromhex("ffd0"):
        raise SystemExit("CreateFileA callsite is not call eax")
    if window[SICE_TEST - base : SICE_TEST - base + 7] != bytes.fromhex("400f85e1020000"):
        raise SystemExit("handle test is not inc eax; jne")


def write_csv(name: str, rows: list[dict]) -> None:
    RESULT.mkdir(exist_ok=True)
    path = RESULT / name
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--emit", action="store_true", help="write the Task 009 CSV files")
    args = parser.parse_args()
    replay = load_replay()
    check_images(replay)
    probe = replay["probe"]
    print(
        json.dumps(
            {
                "client": replay["client_sha256"],
                "kernel32": replay["kernel32_sha256"],
                "kernel32_base": replay["kernel32_base"],
                "instructions": replay["instructions"],
                "walker": hex(WALKER),
                "createfile_insn": probe["insn"],
                "sice_rva": hex(SICE_RVA),
                "callsite": hex(SICE_CALL),
                "test": hex(SICE_TEST),
                "absent": hex(ABSENT_FALL),
                "present": hex(PRESENT_TARGET),
                "route": "B",
            },
            indent=2,
        )
    )
    if not args.emit:
        return
    write_csv(
        "protector-resolver-cfg.csv",
        [
            {"rva": "0x0081CF01", "role": "walker-entry", "detail": "lodsw of e_lfanew; ESI = module+0x3C"},
            {"rva": "0x0081CF0A", "role": "module-base", "detail": "add eax, [esp+0x24]; stack dword is the module base"},
            {"rva": "0x0081CF3C", "role": "data-directory", "detail": "mov eax, [eax+0x78]; export directory RVA"},
            {"rva": "0x0081CF97", "role": "number-of-names", "detail": "mov eax, [eax+0x18]; count stored at slot 0x0081CEB7"},
            {"rva": "0x0081D034", "role": "address-of-functions", "detail": "lodsd then stosd to slot 0x0081A331"},
            {"rva": "0x0081D063", "role": "address-of-names", "detail": "lodsd then stosd to slot 0x0081A7ED"},
            {"rva": "0x0081D0CF", "role": "address-of-name-ordinals", "detail": "lodsd then stosd to slot 0x00819101"},
            {"rva": "0x0081D126", "role": "name-slot", "detail": "lodsd of the next AddressOfNames entry"},
            {"rva": "0x0081D138", "role": "first-character", "detail": "cmp al, [edi]; AL comes from slot 0x0081A361, 0 skips the test"},
            {"rva": "0x0081D13F", "role": "length", "detail": "scasb walks to the NUL; this is the length, not a full strcmp"},
            {"rva": "0x0081D14C", "role": "name-checksum", "detail": "per-byte mix using xor ax, 0x5041 and xor bx, 0x5449; compared with incoming EDX"},
            {"rva": "0x0081D186", "role": "match", "detail": "je 0x0081D197 when the checksum matches"},
            {"rva": "0x0081D1FF", "role": "ordinal", "detail": "lodsw at AddressOfNameOrdinals + index*2"},
            {"rva": "0x0081D22F", "role": "function-rva", "detail": "lodsd at AddressOfFunctions + ordinal*4, then add module base"},
            {"rva": "0x0081D272", "role": "return-value", "detail": "mov [esp+0x1c], eax; popal makes that EAX"},
            {"rva": "0x0081D2A4", "role": "slot-add", "detail": "add dword [slot 0x0081AAA5], esi"},
            {"rva": "0x0081D2AA", "role": "first-byte-test", "detail": "lodsb at the resolved VA; rcl tests can skip to the epilogue. No forwarder string walk"},
            {"rva": "0x0081D115", "role": "failure", "detail": "mov dword [esp+0x1c], 0 then join the epilogue"},
            {"rva": "0x0081D398", "role": "slot-write", "detail": "mov dword [slot 0x0081A81D], eax"},
            {"rva": "0x0081D3A4", "role": "return", "detail": "ret 8"},
            {"rva": "0x00821750", "role": "wrapper", "detail": "shared target of push imm; jmp. Relocates one internal table, then lodsb a descriptor"},
            {"rva": "0x00834871", "role": "pointer-commit", "detail": "pop dword [edx]; observed destination slot 0x00821478"},
        ],
    )
    write_csv(
        "protector-resolved-api-map.csv",
        [
            {
                "module": "kernel32.dll",
                "api_name": "LoadLibraryA",
                "resolver_callsite_rva": "0x00857E4A; 0x00857E54; 0x00857E68",
                "resolved_va": "0x76271F70",
                "destination_slot_rva": "0x00821478; 0x0081AAA5; 0x0081A81D",
                "first_consumer_rva": "0x00857E4A",
                "call_count": "3",
                "semantic_category": "module loading",
                "confidence": "high",
            },
            {
                "module": "kernel32.dll",
                "api_name": "GetLocalTime",
                "resolver_callsite_rva": "0x00857E7C",
                "resolved_va": "0x7625D430",
                "destination_slot_rva": "0x00821478; 0x0081A81D",
                "first_consumer_rva": "0x00857E7C",
                "call_count": "1",
                "semantic_category": "system information",
                "confidence": "high",
            },
            {
                "module": "user32.dll",
                "api_name": "MessageBoxExA",
                "resolver_callsite_rva": "0x0081CF01",
                "resolved_va": "0x76A25100",
                "destination_slot_rva": "0x0081A81D",
                "first_consumer_rva": "",
                "call_count": "0",
                "semantic_category": "window/UI",
                "confidence": "high",
            },
            {
                "module": "kernel32.dll",
                "api_name": "CreateFileA",
                "resolver_callsite_rva": "0x00859757",
                "resolved_va": "0x7625EA00",
                "destination_slot_rva": "",
                "first_consumer_rva": "0x00859757",
                "call_count": "1",
                "semantic_category": "anti-debug/environment probe",
                "confidence": "high",
            },
        ],
    )
    write_csv(
        "protector-module-load-order.csv",
        [
            {
                "order": "1",
                "module_name": "kernel32.dll",
                "method": "already loaded; base found from the GetLocalTime IAT scan",
                "caller_rva": "0x0081CCC6",
                "base": "0x76240000",
                "apis": "LoadLibraryA; GetLocalTime; CreateFileA",
                "status": "already-loaded",
            },
            {
                "order": "2",
                "module_name": "USER32.dll",
                "method": "LoadLibraryA",
                "caller_rva": "0x00857E4A",
                "base": "0x76980000",
                "apis": "MessageBoxExA",
                "status": "protector-loaded",
            },
            {
                "order": "3",
                "module_name": "ADVAPI32.dll",
                "method": "LoadLibraryA",
                "caller_rva": "0x00857E54",
                "base": "0x767F0000",
                "apis": "",
                "status": "protector-loaded",
            },
            {
                "order": "4",
                "module_name": "NTDLL.dll",
                "method": "LoadLibraryA",
                "caller_rva": "0x00857E68",
                "base": "0x77080000",
                "apis": "",
                "status": "protector-loaded",
            },
        ],
    )
    write_csv(
        "softice-branch-cfg.csv",
        [
            {
                "from_rva": "0x00859708",
                "instruction": "lea ebx, [ebp+0x74804F3]",
                "condition": "none",
                "target_rva": "0x00859507",
                "classification": "string reference \\\\.\\SICE",
            },
            {
                "from_rva": "0x00859757",
                "instruction": "call eax",
                "condition": "eax = CreateFileA",
                "target_rva": "0x7625EA00",
                "classification": "file/device probe",
            },
            {
                "from_rva": "0x00859759",
                "instruction": "call/pop/add/ret gadget",
                "condition": "unconditional",
                "target_rva": "0x00859779",
                "classification": "continue protector initialization",
            },
            {
                "from_rva": "0x00859779",
                "instruction": "inc eax; jne",
                "condition": "ZF=1 when the handle was 0xFFFFFFFF",
                "target_rva": "0x00859780",
                "classification": "run additional probes",
            },
            {
                "from_rva": "0x0085977A",
                "instruction": "jne",
                "condition": "ZF=0 when the handle was not INVALID_HANDLE_VALUE",
                "target_rva": "0x00859A61",
                "classification": "unknown",
            },
        ],
    )
    write_csv(
        "protector-environment-probes.csv",
        [
            {
                "probe_id": "P1",
                "caller_rva": "0x00859757",
                "api_or_primitive": "kernel32!CreateFileA",
                "probe_target": "\\\\.\\SICE",
                "return_test": "inc eax; jne at 0x00859779",
                "branch_target": "0x00859780 absent; 0x00859A61 present",
                "downstream": "absent side contains the next device loads; present side keeps the handle",
                "confidence": "high",
            },
            {
                "probe_id": "P2",
                "caller_rva": "0x00859882",
                "api_or_primitive": "lea ebx of a device name",
                "probe_target": "\\\\.\\SIWVID",
                "return_test": "",
                "branch_target": "",
                "downstream": "same lea-ebx shape as P1, in the address span after the absent edge",
                "confidence": "medium",
            },
            {
                "probe_id": "P3",
                "caller_rva": "0x008599BF",
                "api_or_primitive": "lea ebx of a device name",
                "probe_target": "\\\\.\\NTICE",
                "return_test": "",
                "branch_target": "",
                "downstream": "same lea-ebx shape as P1, still before the present-edge target",
                "confidence": "medium",
            },
            {
                "probe_id": "P4",
                "caller_rva": "0x00859D07",
                "api_or_primitive": "call dword [ebp+0x7480CD1]",
                "probe_target": "HKCU\\Software\\WinLicense",
                "return_test": "",
                "branch_target": "",
                "downstream": "three-argument open shape, hKey immediate 0x80000001",
                "confidence": "high",
            },
            {
                "probe_id": "P5",
                "caller_rva": "0x00859D26",
                "api_or_primitive": "call dword [ebp+0x7441815]",
                "probe_target": "WinLicenseVersion and the sibling value names in the same cluster",
                "return_test": "",
                "branch_target": "",
                "downstream": "value-name loads follow the open; no query result was executed",
                "confidence": "medium",
            },
        ],
    )
    write_csv(
        "task009-anchor-scan.csv",
        [
            {"anchor": "aes-key", "region": "probe-window 0x856000-0x862000 and decode rounds", "found": "no", "rva": "", "notes": "no post-probe decode that is independent of the handle"},
            {"anchor": "iv-prefix", "region": "probe-window and decode rounds", "found": "no", "rva": "", "notes": "not present"},
            {"anchor": "iv-seed", "region": "probe-window and decode rounds", "found": "no", "rva": "", "notes": "not present"},
            {"anchor": "List.wz", "region": "probe-window", "found": "no", "rva": "", "notes": "not present"},
            {"anchor": ".wz", "region": "probe-window", "found": "no", "rva": "", "notes": "not present"},
            {"anchor": "WS2_32", "region": "probe-window", "found": "no", "rva": "", "notes": "not present"},
            {"anchor": "WSAStartup", "region": "probe-window", "found": "no", "rva": "", "notes": "not present"},
            {"anchor": "connect/send/recv", "region": "probe-window", "found": "no", "rva": "", "notes": "no Winsock names"},
            {"anchor": "MSVC-RTTI", "region": "probe-window", "found": "no", "rva": "", "notes": "no .?AV and no 55 8B EC"},
            {"anchor": "Tail-A", "region": "replay", "found": "no", "rva": "", "notes": "first page still zero; no cross-Tail-B write"},
            {"anchor": "ZtlTaskMem", "region": "replay", "found": "no", "rva": "0x005FC19F", "notes": "three slots still 16 zero bytes"},
        ],
    )


if __name__ == "__main__":
    main()
