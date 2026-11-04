"""Static normal-path checks for the captured Tail B probe window.

Reads the existing probe-window capture. Does not attach a debugger, patch
the image, write process memory, or invent a CreateFileA return.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / ".work" / "task-001" / "extracted"
WINDOW = ROOT / ".work" / "task-009" / "probe-window.bin"
EXPECTED = "5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d"
BASE = 0x856000
IMAGE = 0x400000

# CreateFileA argument recipe shared by the three device sites.
ACCESS_XOR = (0xE6E15503, 0x26E15503)  # SIWVID / NTICE form
ACCESS_ADD = (0xBFB099AC, 0x4F6654)  # SICE form
FLAGS_ADD = (0xBE816E45, 0x417E923B)


def client_hash() -> str:
    exe = next(CLIENT.rglob("MapleStory.exe"))
    return hashlib.sha256(exe.read_bytes()).hexdigest()


def load_window() -> bytes:
    blob = WINDOW.read_bytes()
    if len(blob) != 0xC000 or int.from_bytes(blob[0x859757 - BASE : 0x859759 - BASE], "little") != 0xD0FF:
        raise SystemExit("probe window is not the CreateFileA capture")
    return blob


def decode(blob: bytearray) -> None:
    key = 0x5D02E67B ^ 0x587ACB01
    esi = 0
    ebx = 0x860290
    while True:
        off = ((ebx + esi) & 0xFFFFFFFF) - BASE
        val = int.from_bytes(blob[off : off + 4], "little")
        val = ((val ^ key) - 0x651CFF63) & 0xFFFFFFFF
        blob[off : off + 4] = val.to_bytes(4, "little")
        esi = (esi - 4) & 0xFFFFFFFF
        if esi == 0xFFFFA29C:
            break
    edx = 0x85A9BB + 0x5DA4
    remaining = 0x1746
    while remaining:
        off = edx - BASE
        val = int.from_bytes(blob[off : off + 4], "little")
        val = (val + 0x141E9FC6) & 0xFFFFFFFF
        val ^= 0x75AA4D86
        val = (val + 0x601EFFF4) & 0xFFFFFFFF
        blob[off : off + 4] = val.to_bytes(4, "little")
        edx -= 4
        remaining -= 1


def emit(result: Path) -> None:
    result.mkdir(parents=True, exist_ok=True)
    cfg = [
        ("0x00859780", "0x008597B6", "0x008597BC;0x008597CC", "0x0085977A", "device-probe", "", "fall-through after SICE inc/jne", "high"),
        ("0x008597CC", "0x008598B3", "0x008598B5", "0x008597BC;0x008597CC", "device-probe", r"\\.\SIWVID", "call eax", "high"),
        ("0x008598B5", "0x008598BC", "0x008598C2;0x00859A61", "0x008598B3", "device-probe", "", "inc eax / jne", "high"),
        ("0x008598C2", "0x008599FC", "0x008599FE", "0x008598BC", "device-probe", r"\\.\NTICE", "call eax", "high"),
        ("0x008599FE", "0x0085A005", "0x0085A00B;0x00859A61", "0x008599FC", "device-probe", "", "inc eax / jne", "high"),
        ("0x0085A00B", "0x0085A018", "0x00859B8C", "0x0085A005", "protector-state", "", "", "high"),
        ("0x00859BC0", "0x00859C0B", "0x00859C0B", "0x00859B8C", "protector-state", "flag slots 0x0081BAB5 and 0x008191F1", "skipped internal calls when both are zero", "medium"),
        ("0x00859C0B", "0x00859C1F", "0x00859CE9", "0x00859BC0", "protector-state", "", "jmp over the registry call block", "high"),
        ("0x00859CE9", "0x00859CED", "0x0085A36E", "0x00859C1F", "protector-state", "Software\\WinLicense not reached", "jmp 0x0085A36E", "high"),
        ("0x0085A36E", "0x0085A3FE", "0x0085A404", "0x00859CE9", "resolver", "", "call [slot 0x0081C245] x5", "medium"),
        ("0x0085A410", "0x0085A4E9", "0x0085A518;0x0085A4EF", "0x0085A404", "self-decode", "5977 dwords", "pop dword ptr [ebx+esi]", "high"),
        ("0x0085A530", "0x0085A5D4", "0x0085A5D9", "0x0085A4EF", "protector-state", "/getwlstatus /bugcheck /nosplash", "decoded command-line table", "high"),
        ("0x0085A9B6", "0x0085AA3F", "0x0085AA45", "0x0085A986", "self-decode", "5958 dwords", "pop dword ptr [edx]", "high"),
        ("0x0085AA45", "0x0085B400", "0x0085EBD5", "0x0085AA3F", "memory-materializer", "embedded LE/VxD at 0x0085B405", "self-patch then jmp", "high"),
        ("0x00859A61", "0x00859A64", "", "0x0085977A;0x008598BC;0x0085A005", "device-probe", "shared detection edge", "mov ebx, eax / dec ebx", "high"),
    ]
    with (result / "normal-probe-path-cfg.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["start_rva", "end_rva", "successor", "predecessor", "semantic_class", "string_or_data", "api_or_resolver", "confidence"])
        writer.writerows(cfg)

    sequence = [
        (r"\\.\SICE", "0x00859757", "call eax / CreateFileA", "0x00859779 inc eax; 0x0085977A jne 0x00859A61", "0x00859780", "0x00859A61", "0x00859882 SIWVID", "high"),
        (r"\\.\SIWVID", "0x008598B3", "call eax / same CreateFileA recipe", "0x008598BB inc eax; 0x008598BC jne 0x00859A61", "0x008598C2", "0x00859A61", "0x008599BF NTICE", "high"),
        (r"\\.\NTICE", "0x008599FC", "call eax / same CreateFileA recipe", "0x0085A004 inc eax; 0x0085A005 jne 0x00859A61", "0x0085A00B", "0x00859A61", "0x0085A36E resolver then self-decode", "high"),
        ("HKCU\\Software\\WinLicense", "", "registry cluster not on this edge", "", "not reached", "", "jumped over at 0x00859CE9", "high"),
        (r"\\.\oreans32", "", "string loaded but callsite unresolved", "", "", "", "inside second decode at 0x0085ECB8", "medium"),
    ]
    with (result / "normal-probe-sequence.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["probe_target", "callsite", "api", "return_test", "normal_edge", "detection_edge", "downstream", "confidence"])
        writer.writerows(sequence)

    events = [
        ("E1", "", "", "", "", "not observed", "Tail A 0x002CE000-0x007EA000", "", "", "high"),
        ("E2", "", "", "0x005FC19F;0x005FC1B0;0x005FC1C1", "", "not observed", "ZtlTaskMem slots", "", "", "high"),
        ("E3", "", "", "", "", "not observed", "execute outside Tail B", "", "", "high"),
        ("E4", "", "", "", "", "not observed", "new executable region", "", "", "high"),
        ("E5", "0x0085A4C2", "in-place Tail B", "0x0085A530-0x00860293", "0x5D64", "captured probe window", "self-decode", "", "4ddbdf0e304328b837c2142b3a49064381491ec3edd20fa544d09ab1c8f4ff47", "high"),
        ("E5", "0x0085AA35", "in-place Tail B", "0x0085AA4B-0x00860762", "0x5D18", "output of the first loop plus the bytes above it", "self-decode / embedded LE", "2.648", "d6cfe6b9e933a59ce97291e38325ebd1f75084ba804aaf78682c9220bb0e4172", "high"),
    ]
    with (result / "task011-materialization-events.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["event", "producer_rva", "source", "destination", "length", "raw_backing", "classification", "entropy", "buffer_sha256", "confidence"])
        writer.writerows(events)

    anchors = [
        ("not-reached", "none", "", "AES key absent from probe window and both decoded spans", "not-observed"),
        ("not-reached", "none", "", "IV prefix absent", "not-observed"),
        ("not-reached", "none", "", "IV seed F2 53 50 C6 absent", "not-observed"),
        ("not-reached", "none", "", "List.wz / .wz absent", "not-observed"),
        ("not-reached", "none", "", "WS2_32 / WSAStartup / socket absent", "not-observed"),
        ("not-reached", "none", "", ".?AV / .?AU / vtable cluster absent", "not-observed"),
        ("second-decode", "Tail B", "0x0085B405", "MZ/LE VxD image, not a game RTTI block", "high"),
        ("second-decode", "Tail B", "0x0085ECB8", r"\\.\oreans32 string, driver setup, not Winsock", "high"),
    ]
    with (result / "task011-game-anchor-hits.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["first_seen_stage", "region", "rva", "evidence", "confidence"])
        writer.writerows(anchors)

    symbols = [
        ("CClientSocket", "", "", "unmatched", "no game-like block"),
        ("CClientSocket::SendPacket", "", "", "unmatched", "no game-like block"),
        ("CInPacket", "", "", "unmatched", "no game-like block"),
        ("COutPacket", "", "", "unmatched", "no game-like block"),
        ("CWvsContext", "", "", "unmatched", "no game-like block"),
        ("CWvsApp", "", "", "unmatched", "no game-like block"),
        ("CLogin", "", "", "unmatched", "no game-like block"),
        ("SendLoginPacket", "", "", "unmatched", "no game-like block"),
        ("SetWorldInfo", "", "", "unmatched", "no game-like block"),
    ]
    with (result / "task011-symbol-correlation.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["symbol", "cms079_rva", "evidence", "confidence", "note"])
        writer.writerows(symbols)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--emit", type=Path)
    args = parser.parse_args()
    digest = client_hash()
    if digest != EXPECTED:
        raise SystemExit(f"client hash changed: {digest}")
    blob = bytearray(load_window())
    # SIWVID and NTICE callsites are call eax. The access immediate decodes to GENERIC_READ|GENERIC_WRITE.
    if blob[0x8598B3 - BASE : 0x8598B5 - BASE] != bytes.fromhex("ffd0"):
        raise SystemExit("SIWVID call eax missing")
    if blob[0x8599FC - BASE : 0x8599FE - BASE] != bytes.fromhex("ffd0"):
        raise SystemExit("NTICE call eax missing")
    if (ACCESS_ADD[0] + ACCESS_ADD[1]) & 0xFFFFFFFF != 0xC0000000:
        raise SystemExit("SICE access decode mismatch")
    if ACCESS_XOR[0] ^ ACCESS_XOR[1] != 0xC0000000:
        raise SystemExit("device access decode mismatch")
    if (FLAGS_ADD[0] + FLAGS_ADD[1]) & 0xFFFFFFFF != 0x80:
        raise SystemExit("flags decode mismatch")
    decode(blob)
    if b"oreans32.sys" not in blob or b"SecureEngine" not in blob:
        raise SystemExit("decoded driver strings missing")
    if blob[0x85B405 - BASE : 0x85B407 - BASE] != b"MZ":
        raise SystemExit("embedded MZ missing")
    if blob[0x85B4B5 - BASE : 0x85B4B7 - BASE] != b"LE":
        raise SystemExit("embedded LE signature missing")
    print("client", digest)
    print("siwvid", "0x8598b3", "ntice", "0x8599fc", "le", "0x85b405")
    if args.emit:
        emit(args.emit)
        print("emitted", args.emit)


if __name__ == "__main__":
    main()
