"""Task 027 faithful offline full-path replay of the protected MapleStory client.

Continues the validated entry/stage-2 replay (Tasks 006-012c) PAST the
SoftICE/SIWVID/NTICE probes by answering environment queries with the
TRUTHFUL values of the actual Win7 SP1 x86 guest used at runtime:

- guest system DLLs (extracted from the install ISO, index 4) mapped at the
  guest-observed bases (kernel32 0x76180000, ntdll 0x77660000, ...), with
  base relocations applied;
- absent devices (SICE etc.), absent files/registry keys -> failure returns
  (the real OS answers); IsDebuggerPresent -> FALSE; TEB/PEB synthesized
  (SEH chain end 0xFFFFFFFF, BeingDebugged 0, NtGlobalFlag 0);
- client files (ijl15.dll, iloveaki.dat) mapped from the real client dir
  when LoadLibrary'd; MessageBox -> recorded, returns IDOK (models the
  authorized single OK click only);
- the runtime #UD/#GP-exception-driven control flow (illegal instructions
  at RVA 0x862E76/0x862FB0 with handlers inside the decoded 0x862000+
  region) is reproduced by delegating to the REAL ntdll
  KiUserExceptionDispatcher with a correctly laid-out CONTEXT.

Task 027 reached: probes -> GetCommandLine/GetVersionEx/RegOpenKey ->
#UD trap at 0x862E76 -> SEH handler 0x862F19 -> ZwContinue(0x862E7A) ->
winmm!timeGetTime timing phase -> Themida error-reporter decision
(the emulation-detectable boundary; the real guest never shows this box).

Usage:
  python scripts/maple079_full_replay.py --exe <MapleStory.exe> \
      --guest-dir <dir with guest Win7 x86 DLLs> \
      --client-dir <client directory> [--budget N] [--dump-image out.bin]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import pefile
import unicorn.x86_const as unicorn_x86_const
from capstone import CS_ARCH_X86, CS_MODE_32, Cs
from unicorn import (Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE,
                     UC_HOOK_MEM_INVALID, UC_HOOK_MEM_WRITE, UC_HOOK_MEM_READ)
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX,
                               UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EDX,
                               UC_X86_REG_EIP, UC_X86_REG_EFLAGS,
                               UC_X86_REG_ESI, UC_X86_REG_ESP,
                               UC_X86_REG_FS_BASE)

IMAGE = 0x400000
STACK = 0x00100000
STACK_SIZE = 0x00200000
TAIL_A = (0x002CE000, 0x007EA000)
TAIL_B = (0x00819000, 0x00912000)
ZTL = (0x005FC19F, 0x005FC1B0, 0x005FC1C1)

# guest-observed module bases (T27F1 module-first-seen.csv + T25/T26 runs)
GUEST_BASES = {
    "kernel32.dll": 0x76180000,
    "ntdll.dll": 0x77660000,
    "user32.dll": 0x75E40000,
    "advapi32.dll": 0x75D90000,
    "kernelbase.dll": 0x75A60000,
    "apphelp.dll": 0x755F0000,
    "gdi32.dll": 0x76270000,
    "lpk.dll": 0x75E30000,
    "usp10.dll": 0x760E0000,
    "msvcrt.dll": 0x766C0000,
    "imm32.dll": 0x75AB0000,
    "msctf.dll": 0x767A0000,
    "sechost.dll": 0x77870000,
    "rpcrt4.dll": 0x76520000,
    "winmm.dll": 0x6F5E0000,
    "version.dll": 0x75AF0000,
}
IAT_SLOT = 0x81802B          # FirstThunk slot of GetLocalTime
GETLOCALTIME_RVA = 0x4A90E   # guest kernel32 (install ISO index 4)

PROBE_DEVICES = ("sice", "siwvid", "ntice", "siwvidstart", "iceext")


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def entropy(b: bytes) -> float:
    if not b:
        return 0.0
    c = [0] * 256
    for x in b:
        c[x] += 1
    n = len(b)
    return -sum((k / n) * math.log2(k / n) for k in c if k)


class Replay:
    def __init__(self, exe: Path, guest_dir: Path, client_dir: Path):
        self.exe = exe
        self.guest_dir = guest_dir
        self.client_dir = client_dir
        self.uc = Uc(UC_ARCH_X86, UC_MODE_32)
        self.modules = {}        # base -> {label, path, exports{va:name}, name2va}
        self.api_stubs = {}      # va -> handler
        self.log = []
        self.state = {
            "count": 0, "why": None, "eip": None, "recent": [],
            "tail_a_writes": 0, "tail_a_first": None, "tail_a_spans": [],
            "tail_b_writes": 0, "ztl_writes": [],
            "writes_elsewhere": 0, "exec_pages": set(),
            "apis": [], "probes": [], "files": [], "reg": [],
            "next_handle": 0x1000, "handles": {},
            "arena": 0x30000000, "messageboxes": [],
            "region1_done": False,
        }
        self.md = Cs(CS_ARCH_X86, CS_MODE_32)
        self.md.detail = False
        # ---- Task 028 additions ----
        self.apilog = []          # uncapped compact API/env event stream
        self.tracer = None        # selective corridor tracer (opt-in)
        self.tracer_closed = False
        self.corridor_n = None    # instruction count at corridor start
        self.ck2_dir = None       # checkpoint v2 target dir
        self.ck2_tag = None       # marker tag for checkpoint v2
        self.ck2_saved = False
        self.ck2_save_mode = False
        self.resume_ckpt = None   # tag to resume from (v2)
        self.trace_dir = None     # opt-in trace output dir
        self.trace_from = "corridor"
        self.trace_max = 4_000_000
        self.trace_log_reads = False
        REGNAMES = ("eax", "ebx", "ecx", "edx", "esi", "edi", "ebp", "esp")
        self.REGCONSTS = {n: getattr(unicorn_x86_const,
                                     f"UC_X86_REG_{n.upper()}") for n in REGNAMES}

    # ---------- memory ----------
    def map_pe(self, path: Path, base: int) -> int:
        pe = pefile.PE(str(path), fast_load=True)
        size = (int(pe.OPTIONAL_HEADER.SizeOfImage) + 0xFFF) & ~0xFFF
        blob = path.read_bytes()
        try:
            self.uc.mem_map(base, size)
        except Exception:
            pass
        self.uc.mem_write(base, blob[: int(pe.OPTIONAL_HEADER.SizeOfHeaders)])
        for s in pe.sections:
            raw = blob[s.PointerToRawData: s.PointerToRawData + s.SizeOfRawData]
            if raw:
                self.uc.mem_write(base + s.VirtualAddress, raw)
        # apply base relocations when mapped at a non-preferred base
        delta = base - int(pe.OPTIONAL_HEADER.ImageBase)
        if delta:
            pe.parse_data_directories(
                directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_BASERELOC"]])
            for entry in getattr(pe, "DIRECTORY_ENTRY_BASERELOC", []):
                for rel in entry.entries:
                    if rel.type == 0:
                        continue
                    addr = base + rel.rva
                    try:
                        val = int.from_bytes(bytes(self.uc.mem_read(addr, 4)), "little")
                        self.uc.mem_write(addr, (val + delta).to_bytes(4, "little"))
                    except Exception:
                        pass
        return size

    def remember_module(self, base: int, path: Path, label: str):
        if base in self.modules:
            return
        pe = pefile.PE(str(path), fast_load=True)
        pe.parse_data_directories(
            directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_EXPORT"]])
        name2va, va2name = {}, {}
        try:
            for sym in pe.DIRECTORY_ENTRY_EXPORT.symbols:
                if sym.name and sym.address:
                    n = sym.name.decode("ascii", "replace")
                    name2va[n] = base + sym.address
                    va2name[base + sym.address] = n
        except Exception:
            pass
        self.modules[base] = {"label": label, "path": str(path),
                              "name2va": name2va, "va2name": va2name}

    def api_va(self, module_label: str, api: str):
        for base, info in self.modules.items():
            if info["label"].lower() == module_label.lower():
                va = info["name2va"].get(api)
                if va:
                    return va
        return None

    # ---------- helpers ----------
    def read_cstr(self, addr: int, max_len=512) -> str:
        try:
            raw = bytes(self.uc.mem_read(addr, max_len))
        except Exception:
            return ""
        return raw.split(b"\x00", 1)[0].decode("ascii", "replace")

    def read_wstr(self, addr: int, max_len=512) -> str:
        try:
            raw = bytes(self.uc.mem_read(addr, max_len * 2))
        except Exception:
            return ""
        out = []
        for i in range(0, len(raw), 2):
            if raw[i] == 0 and raw[i + 1] == 0:
                break
            out.append(chr(raw[i] | (raw[i + 1] << 8)))
        return "".join(out)

    def dword(self, addr: int) -> int:
        return int.from_bytes(bytes(self.uc.mem_read(addr, 4)), "little")

    def stdcall(self, nargs: int, value: int):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ret = self.dword(esp)
        self.uc.reg_write(UC_X86_REG_EAX, value & 0xFFFFFFFF)
        self.uc.reg_write(UC_X86_REG_ESP, esp + 4 + 4 * nargs)
        self.uc.reg_write(UC_X86_REG_EIP, ret)

    def note(self, kind: str, **fields):
        fields["n"] = self.state["count"]
        try:
            fields["eip"] = self.uc.reg_read(UC_X86_REG_EIP)
        except Exception:
            pass
        self.log.append({"kind": kind, **fields})
        if len(self.log) > 20000:
            self.log = self.log[-10000:]
        # uncapped compact stream for signature / fidelity audit
        keep = []
        for k in ("name", "key", "value", "t", "ms", "ret", "code", "eip",
                  "resume_eip", "exists", "base", "device"):
            if k in fields:
                v = fields[k]
                keep.append((k, v if isinstance(v, (int, bool)) else str(v)))
        self.apilog.append((kind, self.state["count"], tuple(keep)))

    # ---------- API implementation (truthful guest answers) ----------
    def resolve_module_file(self, name: str) -> Path | None:
        n = name.lower().replace("\\", "/").split("/")[-1]
        for cand in (self.guest_dir / n, self.client_dir / n):
            if cand.exists():
                return cand
        if n in GUEST_BASES:
            return self.guest_dir / n
        return None

    def stub_LoadLibrary(self, wide: bool):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ptr = self.dword(esp + 4)
        name = self.read_wstr(ptr) if wide else self.read_cstr(ptr)
        base = next((b for b, i in self.modules.items()
                     if i["label"].lower() == name.lower()), None)
        if base is None:
            path = self.resolve_module_file(name)
            if path is None:
                self.note("LoadLibrary-miss", name=name)
                self.stdcall(1, 0)
                return
            base = GUEST_BASES.get(Path(name).name.lower())
            if base is None:
                base = self.state["arena"]
                self.state["arena"] += 0x1000000
            self.map_pe(path, base)
            self.remember_module(base, path, Path(name).name)
            self.register_apis(base)
        self.note("LoadLibrary", name=name, base=hex(base))
        self.stdcall(1, base)

    def stub_GetProcAddress(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        module = self.dword(esp + 4)
        name_ptr = self.dword(esp + 8)
        info = self.modules.get(module)
        if info is None:
            self.note("gpa-badmodule", module=hex(module))
            self.stdcall(2, 0)
            return
        name = self.read_cstr(name_ptr) if name_ptr > 0xFFFF else str(self.dword(name_ptr))
        va = info["name2va"].get(name)
        if va is None:
            self.note("gpa-miss", module=info["label"], name=name)
            self.stdcall(2, 0)
            return
        self.note("GetProcAddress", module=info["label"], name=name, va=hex(va))
        self.stdcall(2, va)

    def stub_GetModuleHandle(self, wide: bool):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ptr = self.dword(esp + 4)
        if ptr == 0:
            self.stdcall(1, IMAGE)
            return
        name = self.read_wstr(ptr) if wide else self.read_cstr(ptr)
        base = next((b for b, i in self.modules.items()
                     if i["label"].lower() == name.lower()), None)
        self.note("GetModuleHandle", name=name, base=hex(base or 0))
        self.stdcall(1, base or 0)

    def stub_CreateFile(self, wide: bool):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ptr = self.dword(esp + 4)
        name = (self.read_wstr(ptr) if wide else self.read_cstr(ptr))
        low = name.lower()
        base = None
        if low.startswith("\\\\.\\"):
            dev = low[4:]
            hit = any(d in dev for d in PROBE_DEVICES) or "oreans" in dev
            self.state["probes"].append({"device": name, "n": self.state["count"]})
            self.note("probe-device", name=name, present=False)
            self.stdcall(7, 0xFFFFFFFF)  # INVALID_HANDLE_VALUE, device absent
            return
        # real file? map from client dir only if it exists there
        path = self.resolve_module_file(name)
        if path is not None and path.parent == self.client_dir:
            h = self.state["next_handle"]; self.state["next_handle"] += 4
            self.state["handles"][h] = {"path": str(path)}
            self.state["files"].append({"name": name, "handle": h, "n": self.state["count"]})
            self.note("CreateFile", name=name, handle=h)
            self.stdcall(7, h)
            return
        self.note("CreateFile-miss", name=name)
        self.stdcall(7, 0xFFFFFFFF)

    def stub_GetFileSize(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        h = self.dword(esp + 4)
        info = self.state["handles"].get(h)
        size = Path(info["path"]).stat().st_size if info else 0
        self.stdcall(2, size)

    def stub_ReadFile(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        h = self.dword(esp + 4)
        buf = self.dword(esp + 8)
        to_read = self.dword(esp + 12)
        out_len = self.dword(esp + 20)
        info = self.state["handles"].get(h)
        if not info:
            self.stdcall(5, 0)
            return
        data = Path(info["path"]).read_bytes()
        pos = info.get("pos", 0)
        chunk = data[pos:pos + to_read]
        info["pos"] = pos + len(chunk)
        self.uc.mem_write(buf, chunk)
        self.uc.mem_write(out_len, len(chunk).to_bytes(4, "little"))
        self.note("ReadFile", name=info["path"], n_bytes=len(chunk))
        self.stdcall(5, 1)

    def stub_SetFilePointer(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        h = self.dword(esp + 4)
        info = self.state["handles"].get(h)
        if info:
            info["pos"] = self.dword(esp + 8)
        self.stdcall(4, self.dword(esp + 8) if info else 0xFFFFFFFF)

    def stub_CloseHandle(self):
        self.stdcall(1, 1)

    def stub_VirtualAlloc(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        addr = self.dword(esp + 4)
        size = (max(self.dword(esp + 8), 0x1000) + 0xFFF) & ~0xFFF
        base = (addr & ~0xFFF) if addr else self.state["arena"]
        if not addr:
            self.state["arena"] += size + 0x10000
        try:
            self.uc.mem_map(base, size)
        except Exception:
            pass
        self.note("VirtualAlloc", base=hex(base), size=hex(size))
        self.stdcall(4, base)

    def stub_VirtualProtect(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        old = self.dword(esp + 16)
        try:
            self.uc.mem_write(old, (0x40).to_bytes(4, "little"))
        except Exception:
            pass
        self.stdcall(4, 1)

    def stub_VirtualFree(self):
        self.stdcall(3, 1)

    def stub_IsDebuggerPresent(self):
        # truthful: no debugger in this emulation
        self.stdcall(0, 0)

    def stub_GetLocalTime(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        dest = self.dword(esp + 4)
        # guest clock at snapshot restore, as observed in every run
        # (wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMs)
        st = (2026, 10, 2, 13, 1, 51,
              self.state.get("glt_sec", 30), self.state.get("glt_ms", 0))
        self.uc.mem_write(dest, b"".join(x.to_bytes(2, "little") for x in st))
        self.state.setdefault("api_watch", []).append(
            ("GetLocalTime", dest, 16, self.state["count"]))
        self.stdcall(1, 0)

    def stub_GetVersion(self):
        self.stdcall(0, 0x1DB10106)  # 6.1.7601

    def stub_GetVersionEx(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        info = self.dword(esp + 4)
        size = self.dword(info)
        # OSVERSIONINFOA(W) exact layout (MSDN):
        #   DWORD dwOSVersionInfoSize, dwMajorVersion, dwMinorVersion,
        #         dwBuildNumber, dwPlatformId;
        #   TCHAR szCSDVersion[128];
        #   WORD  wServicePackMajor, wServicePackMinor, wSuiteMask;
        #   BYTE  wProductType, wReserved;
        # Guest truth (result/24-win7-x86-sp1-natural-runtime.md):
        #   Win7 Professional SP1 6.1.7601, ServicePackMajorVersion=1.
        csd = "Service Pack 1"
        wide = getattr(self, "_gvx_wide", False)
        csd_raw = (csd.encode("utf-16le") + b"\x00\x00" if wide
                   else csd.encode("ascii") + b"\x00")
        # strict: the real API writes exactly the caller-declared struct size
        # (148 = OSVERSIONINFOA; 156+ = OSVERSIONINFOEXA adds the SP fields)
        blob = bytearray(min(size, 156))
        def put32(off, v):
            if off + 4 <= len(blob):
                blob[off:off + 4] = (v & 0xFFFFFFFF).to_bytes(4, "little")
        put32(0, size)
        put32(4, 6)          # dwMajorVersion
        put32(8, 1)          # dwMinorVersion
        put32(12, 7601)      # dwBuildNumber
        put32(16, 1)         # dwPlatformId = VER_PLATFORM_WIN32_NT
        if len(blob) >= 148:
            blob[20:148] = csd_raw.ljust(128, b"\x00")[:128]
        if size >= 156:
            blob[148:150] = (1).to_bytes(2, "little")     # wServicePackMajor
            blob[150:152] = (0).to_bytes(2, "little")     # wServicePackMinor
            blob[152:154] = (0x0100).to_bytes(2, "little")  # wSuiteMask (Pro:
            # VER_SUITE_SINGLEUSERUI; guest-truth probe pending for exact bits)
            blob[154] = 1        # wProductType = VER_NT_WORKSTATION
            blob[155] = 0        # wReserved
        self.uc.mem_write(info, bytes(blob))
        self.state.setdefault("api_watch", []).append(
            ("GetVersionExA", info, min(size, 148), self.state["count"]))
        self.stdcall(1, 1)

    def stub_GetVersionEx_W(self):
        self._gvx_wide = True
        return self.stub_GetVersionEx()

    def stub_RegOpenKey(self, wide, nargs=3):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        sub = self.dword(esp + 8)
        name = self.read_wstr(sub) if wide else self.read_cstr(sub)
        if name == "":
            # empty subkey = open the root hive itself: succeeds on Windows
            # (returns a DUPLICATE handle). Real duplicates are ordinary small
            # kernel handles, NOT predefined-hive constants (>= 0x80000000).
            out = self.dword(esp + 8 + 4) if nargs == 3 else self.dword(esp + 16)
            self.state["reg_handle_seq"] = self.state.get("reg_handle_seq", 0) + 1
            h = 0x000000A8 + 4 * self.state["reg_handle_seq"]
            try:
                self.uc.mem_write(out, h.to_bytes(4, "little"))
            except Exception:
                pass
            self.state.setdefault("api_watch", []).append(
                ("RegOpenKeyA", out, 4, self.state["count"]))
            self.state["reg"].append({"op": "open-root", "n": self.state["count"]})
            self.note("RegOpenKey", key="(root)", exists=True)
            self.stdcall(nargs, 0)
            return
        self.state["reg"].append({"op": "open", "key": name, "n": self.state["count"]})
        self.note("RegOpenKey", key=name, exists=False)
        self.stdcall(nargs, 2)  # ERROR_FILE_NOT_FOUND

    def stub_RegQueryValueEx(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        name_ptr = self.dword(esp + 8)
        name = self.read_cstr(name_ptr)
        self.note("RegQueryValueEx", value=name, exists=False)
        self.stdcall(6, 2)

    def stub_MessageBox(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        text_ptr = self.dword(esp + 8)
        title_ptr = self.dword(esp + 12)
        text = self.read_wstr(text_ptr) if wide else self.read_cstr(text_ptr)
        title = self.read_wstr(title_ptr) if wide else self.read_cstr(title_ptr)
        self.state["messageboxes"].append(
            {"title": title, "text": text, "n": self.state["count"]})
        self.note("MessageBox", title=title, text=text, answer="IDOK (authorized click)")
        self.stdcall(4, 1)  # IDOK


    def stub_GetDriveType(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        root = self.dword(esp + 4)
        name = self.read_cstr(root)
        r = 2  # DRIVE_REMOVABLE for the USB client drive (truthful)
        if name.upper().startswith("C:"):
            r = 3
        self.note("GetDriveType", root=name, ret=r)
        self.stdcall(1, r)

    def stub_GetVolumeInformation(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        root = self.dword(esp + 4)
        name = self.read_wstr(root) if wide else self.read_cstr(root)
        # client disk = FAT32 USB (as built), system disk = NTFS
        fat = not name.upper().startswith("C:")
        vol = "CLIENT" if fat else "System"
        if wide:
            self.uc.mem_write(self.dword(esp + 8), vol.encode("utf-16le") + b"\x00\x00")
        else:
            self.uc.mem_write(self.dword(esp + 8), vol.encode("ascii") + b"\x00")
        for slot, val in ((12, 0x0004),):  # maximum component length
            try:
                self.uc.mem_write(self.dword(esp + slot * 4) if False else esp + slot, b"")
            except Exception:
                pass
        self.note("GetVolumeInformation", root=name, fstype="FAT32" if fat else "NTFS")
        self.stdcall(8, 1)

    def stub_GetModuleFileName(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        buf = self.dword(esp + 8)
        size = self.dword(esp + 12)
        path = "F:\\MapleStory.exe"  # the observed launch layout
        raw = path.encode("utf-16le") + b"\x00\x00" if wide else path.encode("ascii") + b"\x00"
        self.uc.mem_write(buf, raw[:size * (2 if wide else 1)])
        self.note("GetModuleFileName", path=path)
        self.stdcall(3, len(path))

    def stub_GetCurrentDirectory(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        buf = self.dword(esp + 8)
        path = "F:\\"
        raw = path.encode("utf-16le") + b"\x00\x00" if wide else path.encode("ascii") + b"\x00"
        self.uc.mem_write(buf, raw)
        self.stdcall(2, len(path))

    def stub_GetCommandLine(self, wide=False):
        # Real guest launch (T025OBS.PS1 -> Start-Process): the WMI-captured
        # exact command line of the gate-bearing runs (result/task025-launch-
        # matrix.csv, A1R2) is the QUOTED form "F:\MapleStory.exe".
        variants = getattr(self, "cmdline_variants", None) or ['"F:\\MapleStory.exe"']
        path = variants[self.state.get("cmdline_idx", 0) % len(variants)]
        if not hasattr(self, "_cmdline_buf"):
            self._cmdline_buf = 0x003F0000
            try:
                self.uc.mem_map(self._cmdline_buf & ~0xFFF, 0x2000)
            except Exception:
                pass
            self.uc.mem_write(self._cmdline_buf, path.encode("ascii") + b"\x00")
            self.uc.mem_write(self._cmdline_buf + 0x1000,
                              path.encode("utf-16le") + b"\x00\x00")
        self.state.setdefault("api_watch", []).append(
            ("GetCommandLineA", self._cmdline_buf, len(path) + 1,
             self.state["count"]))
        self.note("GetCommandLine", line=path)
        self.stdcall(0, self._cmdline_buf + (0x1000 if wide else 0))

    def stub_GetEnvironmentVariable(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        name_ptr = self.dword(esp + 4)
        buf = self.dword(esp + 8)
        size = self.dword(esp + 12)
        name = self.read_wstr(name_ptr) if wide else self.read_cstr(name_ptr)
        table = {
            "systemdrive": "C:",
            "systemroot": "C:\\Windows",
            "windir": "C:\\Windows",
            "temp": "C:\\Users\\game\\AppData\\Local\\Temp",
            "tmp": "C:\\Users\\game\\AppData\\Local\\Temp",
            "path": "C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem",
            "username": "game",
            "computername": "WIN7X86",
            "programfiles": "C:\\Program Files",
            "userprofile": "C:\\Users\\game",
            "allusersprofile": "C:\\ProgramData",
            "os": "Windows_NT",
            "processor_architecture": "x86",
            "number_of_processors": "2",
        }
        val = table.get(name.lower())
        if val is None:
            self.note("GetEnvironmentVariable", name=name, exists=False)
            self.stdcall(3, 0)
            return
        raw = (val.encode("utf-16le") + b"\x00\x00") if wide else (val.encode("ascii") + b"\x00")
        if buf and size:
            self.uc.mem_write(buf, raw[:size])
        self.note("GetEnvironmentVariable", name=name, value=val)
        self.stdcall(3, len(val))

    def stub_GetSystemDirectory(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        buf = self.dword(esp + 4)
        path = "C:\\Windows\\system32"
        raw = (path.encode("utf-16le") + b"\x00\x00") if wide else (path.encode("ascii") + b"\x00")
        self.uc.mem_write(buf, raw)
        self.note("GetSystemDirectory", path=path)
        self.stdcall(2, len(path))

    def stub_GetWindowsDirectory(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        buf = self.dword(esp + 4)
        path = "C:\\Windows"
        raw = (path.encode("utf-16le") + b"\x00\x00") if wide else (path.encode("ascii") + b"\x00")
        self.uc.mem_write(buf, raw)
        self.note("GetWindowsDirectory", path=path)
        self.stdcall(2, len(path))

    def stub_GetStartupInfo(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        info = self.dword(esp + 4)
        self.uc.mem_write(info, b"\x00" * 68)
        self.uc.mem_write(info, (68).to_bytes(4, "little"))
        self.note("GetStartupInfo")
        self.stdcall(1, 0)

    def stub_GetStdHandle(self):
        self.stdcall(1, 0)

    def stub_lstrlen(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ptr = self.dword(esp + 4)
        s = self.read_wstr(ptr) if wide else self.read_cstr(ptr)
        self.stdcall(1, len(s))

    def stub_lstrcpy(self, wide):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        dst = self.dword(esp + 4)
        src = self.dword(esp + 8)
        s = self.read_wstr(src) if wide else self.read_cstr(src)
        raw = (s.encode("utf-16le") + b"\x00\x00") if wide else (s.encode("ascii") + b"\x00")
        self.uc.mem_write(dst, raw)
        self.stdcall(2, dst)

    def stub_HeapAlloc(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        size = self.dword(esp + 8)
        base = self.state["arena"]
        self.state["arena"] += (size + 0xFFFF) & ~0xFFFF
        try:
            self.uc.mem_map(base, (size + 0xFFFF) & ~0xFFFF)
        except Exception:
            pass
        self.note("HeapAlloc", size=size, base=hex(base))
        self.stdcall(3, base)

    def stub_GetProcessHeap(self):
        self.stdcall(0, 0x00500000)

    def stub_ExitProcess(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        code = self.dword(esp + 4)
        self.state["why"] = f"ExitProcess({code})"
        self.state["eip"] = self.uc.reg_read(UC_X86_REG_EIP)
        self.note("ExitProcess", code=code)
        self.uc.emu_stop()

    def stub_NtQueryInformationProcess(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        cls = self.dword(esp + 8)
        buf = self.dword(esp + 12)
        self.note("NtQueryInformationProcess", cls=cls)
        if cls == 0x07:      # ProcessDebugPort: 0 = not debugged (truthful)
            self.uc.mem_write(buf, (0).to_bytes(4, "little"))
            self.stdcall(5, 0)
        elif cls == 0x1E:    # ProcessDebugObjectHandle: not set (truthful)
            self.uc.mem_write(buf, (0).to_bytes(4, "little"))
            self.stdcall(5, 0xC0000353)  # STATUS_PORT_NOT_SET
        elif cls == 0x1F:    # ProcessDebugFlags: 1 = not debugged (truthful)
            self.uc.mem_write(buf, (1).to_bytes(4, "little"))
            self.stdcall(5, 0)
        elif cls == 0x00:    # ProcessBasicInformation
            info = bytearray(24)
            info[4:8] = (self.peb).to_bytes(4, "little")  # PebBaseAddress
            self.uc.mem_write(buf, bytes(info))
            self.stdcall(5, 0)
        elif cls == 0x22:    # ProcessExecuteFlags: DEP disabled + dispatch
            # bits enabled (truthful for this non-NX_COMPAT image under the
            # Win7 default OptIn policy: DISABLE|ATL7_THUNK_EMULATION|
            # EXECUTE_DISPATCH_ENABLE|IMAGE_DISPATCH_ENABLE = 0x36)
            self.uc.mem_write(buf, (0x36).to_bytes(4, "little"))
            self.stdcall(5, 0)
        elif cls == 0x1D or cls == 0x1C:  # cookie / heap
            self.uc.mem_write(buf, (0x7C040000).to_bytes(4, "little"))
            self.stdcall(5, 0)
        else:
            self.stdcall(5, 0xC0000003)  # invalid info class

    def stub_NtQuerySystemInformation(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        cls = self.dword(esp + 4)
        buf = self.dword(esp + 8)
        self.note("NtQuerySystemInformation", cls=cls)
        if cls == 0x23:  # SystemKernelDebuggerInformation
            self.uc.mem_write(buf, bytes([0, 0, 1, 0]))  # disabled, not present
            self.stdcall(5, 0)
        else:
            self.stdcall(5, 0xC0000003)

    def stub_VirtualProtect_nt(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        old = self.dword(esp + 20)
        try:
            self.uc.mem_write(old, (0x40).to_bytes(4, "little"))
        except Exception:
            pass
        self.stdcall(5, 0)

    def stub_NtQueryVirtualMemory(self):
        uc = self.uc
        esp = uc.reg_read(UC_X86_REG_ESP)
        base_addr = self.dword(esp + 8)
        cls = self.dword(esp + 12)
        info = self.dword(esp + 16)
        if cls == 0:  # MemoryBasicInformation
            state, protect, rsize = 0x10000, 0x1, 0
            for begin, end, perms in uc.mem_regions():
                b, e = int(begin), int(end)
                if b <= base_addr <= e:
                    state = 0x1000  # MEM_COMMIT
                    protect = 0x40 if perms & 0x4 else (0x04 if perms & 0x2 else 0x02)
                    if perms & 0x4:
                        protect = 0x40
                    rsize = e - base_addr + 1
                    break
            out = bytearray(28)
            out[0:4] = state.to_bytes(4, "little")
            out[8:12] = protect.to_bytes(4, "little")
            out[12:16] = rsize.to_bytes(4, "little")
            out[16:20] = (0x20000).to_bytes(4, "little")  # MEM_PRIVATE
            uc.mem_write(info, bytes(out))
            self.note("NtQueryVirtualMemory", base=hex(base_addr), state=hex(state))
            self.stdcall(6, 0)
        else:
            self.stdcall(6, 0xC0000003)

    def stub_ZwContinue(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ctx = self.dword(esp + 4)
        R = {0x9C: UC_X86_REG_EDI, 0xA0: UC_X86_REG_ESI, 0xA4: UC_X86_REG_EBX,
             0xA8: UC_X86_REG_EDX, 0xAC: UC_X86_REG_ECX, 0xB0: UC_X86_REG_EAX,
             0xB4: UC_X86_REG_EBP, 0xB8: UC_X86_REG_EIP, 0xC4: UC_X86_REG_ESP}
        eip = self.dword(ctx + 0xB8)
        new_esp = self.dword(ctx + 0xC4)
        for off, reg in R.items():
            if reg != UC_X86_REG_EIP and reg != UC_X86_REG_ESP:
                self.uc.reg_write(reg, self.dword(ctx + off))
        self.note("ZwContinue", ctx=hex(ctx), resume_eip=hex(eip), esp=hex(new_esp))
        self.uc.reg_write(UC_X86_REG_EIP, eip)
        self.uc.reg_write(UC_X86_REG_ESP, new_esp)

    def vclock_ms(self) -> int:
        # virtual uptime model: base (ms since boot at emulation start) +
        # instruction-scaled time + slept time. The default base 1_200_000 is
        # the Task 027 calibration; --vclock-base overrides it with a measured
        # value (e.g. the guest boot->launch delta captured in Task 025 runs).
        return (int(self.state.get("vclock_base", 1_200_000))
                + int(self.state["count"] * self.clock_scale / 1_000_000)
                + self.state.get("sleep_ms", 0))

    def tgt_quantized(self) -> int:
        """Faithful winmm!timeGetTime: Win7 default system timer resolution
        is 15.625 ms (64 Hz) when timeBeginPeriod has not been called (it has
        not, per the replay API log). The tick count therefore only changes
        every 15.625 ms of virtual time."""
        t = self.vclock_ms()
        return int(t * 64 // 1000) * 1000 // 64

    def stub_timeGetTime(self):
        if self.state.get("tgt_faithful_resolution"):
            t = self.tgt_quantized()
        else:
            t = self.vclock_ms()
        self.note("timeGetTime", t=t)
        self.stdcall(0, t)

    def stub_QueryPerformanceCounter(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        buf = self.dword(esp + 4)
        t = 11_800_000 + (self.state["count"] * 3) // 10
        self.uc.mem_write(buf, t.to_bytes(8, "little"))
        self.note("QPC", t=t)
        self.stdcall(1, 1)

    def stub_GetTickCount(self):
        t = self.vclock_ms()
        self.note("GetTickCount", t=t)
        self.stdcall(0, t & 0xFFFFFFFF)

    def stub_Sleep(self):
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        ms = self.dword(esp + 4)
        self.state["sleep_ms"] = self.state.get("sleep_ms", 0) + ms
        self.note("Sleep", ms=ms)
        self.stdcall(1, 0)

    def stub_generic_zero(self, nargs):
        def h():
            self.stdcall(nargs, 0)
        return h

    def register_apis(self, base: int):
        """Register handlers for known VAs of a newly mapped module."""
        info = self.modules[base]
        table = {
            "LoadLibraryA": lambda: self.stub_LoadLibrary(False),
            "LoadLibraryW": lambda: self.stub_LoadLibrary(True),
            "LoadLibraryExA": lambda: self.stub_LoadLibrary(False),
            "LoadLibraryExW": lambda: self.stub_LoadLibrary(True),
            "GetProcAddress": self.stub_GetProcAddress,
            "GetModuleHandleA": lambda: self.stub_GetModuleHandle(False),
            "GetModuleHandleW": lambda: self.stub_GetModuleHandle(True),
            "CreateFileA": lambda: self.stub_CreateFile(False),
            "CreateFileW": lambda: self.stub_CreateFile(True),
            "GetFileSize": self.stub_GetFileSize,
            "ReadFile": self.stub_ReadFile,
            "SetFilePointer": self.stub_SetFilePointer,
            "CloseHandle": self.stub_CloseHandle,
            "VirtualAlloc": self.stub_VirtualAlloc,
            "VirtualProtect": self.stub_VirtualProtect,
            "VirtualFree": self.stub_VirtualFree,
            "IsDebuggerPresent": self.stub_IsDebuggerPresent,
            "GetLocalTime": self.stub_GetLocalTime,
            "GetVersion": self.stub_GetVersion,
                       "GetVersionExA": self.stub_GetVersionEx,
            "GetVersionExW": self.stub_GetVersionEx_W,
            "MessageBoxA": lambda: self.stub_MessageBox(False),
            "MessageBoxW": lambda: self.stub_MessageBox(True),
            "MessageBoxExA": lambda: self.stub_MessageBox(False),
            "Sleep": self.stub_Sleep,
            "GetDriveTypeA": self.stub_GetDriveType,
            "GetVolumeInformationA": lambda: self.stub_GetVolumeInformation(False),
            "GetModuleFileNameA": lambda: self.stub_GetModuleFileName(False),
            "GetModuleFileNameW": lambda: self.stub_GetModuleFileName(True),
            "GetCurrentDirectoryA": lambda: self.stub_GetCurrentDirectory(False),
            "GetCommandLineA": lambda: self.stub_GetCommandLine(False),
            "GetCommandLineW": lambda: self.stub_GetCommandLine(True),
            "GetEnvironmentVariableA": lambda: self.stub_GetEnvironmentVariable(False),
            "GetEnvironmentVariableW": lambda: self.stub_GetEnvironmentVariable(True),
            "GetSystemDirectoryA": lambda: self.stub_GetSystemDirectory(False),
            "GetSystemDirectoryW": lambda: self.stub_GetSystemDirectory(True),
            "GetWindowsDirectoryA": lambda: self.stub_GetWindowsDirectory(False),
            "GetWindowsDirectoryW": lambda: self.stub_GetWindowsDirectory(True),
            "GetStartupInfoA": self.stub_GetStartupInfo,
            "GetStartupInfoW": self.stub_GetStartupInfo,
            "GetStdHandle": self.stub_GetStdHandle,
            "lstrlenA": lambda: self.stub_lstrlen(False),
            "lstrlenW": lambda: self.stub_lstrlen(True),
            "lstrcpyA": lambda: self.stub_lstrcpy(False),
            "lstrcpyW": lambda: self.stub_lstrcpy(True),
            "HeapAlloc": self.stub_HeapAlloc,
            "GetProcessHeap": self.stub_GetProcessHeap,
            "ExitProcess": self.stub_ExitProcess,
            "RegOpenKeyA": lambda: self.stub_RegOpenKey(False, 3),
            "RegOpenKeyW": lambda: self.stub_RegOpenKey(True, 3),
            "RegOpenKeyExA": lambda: self.stub_RegOpenKey(False, 5),
            "RegOpenKeyExW": lambda: self.stub_RegOpenKey(True, 5),
            "RegQueryValueExA": self.stub_RegQueryValueEx,
            "RegQueryValueExW": self.stub_RegQueryValueEx,
            "RegCloseKey": self.stub_generic_zero(1),
            "RegCreateKeyA": lambda: self.stub_RegOpenKey(False),
            "RegCreateKeyW": lambda: self.stub_RegOpenKey(True),
            "GetLastError": self.stub_generic_zero(0),
            "SetLastError": self.stub_generic_zero(1),
            "GetCurrentProcessId": self.stub_generic_zero(0),
            "GetCurrentThreadId": self.stub_generic_zero(0),
            "GetCurrentProcess": lambda: self.stdcall(0, 0xFFFFFFFF),
            "ZwQueryInformationProcess": self.stub_NtQueryInformationProcess,
            "NtQueryInformationProcess": self.stub_NtQueryInformationProcess,
            "ZwQuerySystemInformation": self.stub_NtQuerySystemInformation,
            "NtQuerySystemInformation": self.stub_NtQuerySystemInformation,
            "ZwSetInformationThread": self.stub_generic_zero(3),
            "NtSetInformationThread": self.stub_generic_zero(3),
            "ZwQueryObject": self.stub_generic_zero(5),
            "NtQueryObject": self.stub_generic_zero(5),
            "ZwYieldExecution": self.stub_generic_zero(0),
            "NtYieldExecution": self.stub_generic_zero(0),
            "RtlAcquireSRWLockShared": self.stub_generic_zero(1),
            "RtlReleaseSRWLockShared": self.stub_generic_zero(1),
            "RtlReportException": self.stub_generic_zero(2),
            "RtlAcquireSRWLockExclusive": self.stub_generic_zero(1),
            "RtlReleaseSRWLockExclusive": self.stub_generic_zero(1),
            "RtlEnterCriticalSection": self.stub_generic_zero(1),
            "RtlLeaveCriticalSection": self.stub_generic_zero(1),
            "RtlTryEnterCriticalSection": lambda: self.stdcall(1, 1),
            "NtWaitForSingleObject": self.stub_generic_zero(3),
            "ZwWaitForSingleObject": self.stub_generic_zero(3),
            "RtlQueryPerformanceCounter": lambda: self.stdcall(1, 1),
            "ZwQueryVirtualMemory": self.stub_NtQueryVirtualMemory,
            "NtQueryVirtualMemory": self.stub_NtQueryVirtualMemory,
            "ZwContinue": self.stub_ZwContinue,
            "NtContinue": self.stub_ZwContinue,
            "timeGetTime": self.stub_timeGetTime,
            "timeBeginPeriod": self.stub_generic_zero(1),
            "timeEndPeriod": self.stub_generic_zero(1),
            "QueryPerformanceCounter": self.stub_QueryPerformanceCounter,
            "GetTickCount": self.stub_GetTickCount,
            "ZwRaiseException": lambda: self.stub_ExitProcess(),
            "ZwProtectVirtualMemory": lambda: self.stub_VirtualProtect_nt(),
            "NtProtectVirtualMemory": lambda: self.stub_VirtualProtect_nt(),
        }
        for name, handler in table.items():
            va = info["name2va"].get(name)
            if va:
                self.api_stubs[va] = handler

    # ---------- Task 028: selective tracer + checkpoint v2 ----------
    def api_name_at(self, address: int):
        for _b, _i in self.modules.items():
            nm = _i["va2name"].get(address)
            if nm:
                return nm
        return None

    def save_checkpoint_v2(self, tag: str):
        """Full-fidelity scratch checkpoint: memory regions + complete CPU and
        replay state, taken at a stable post-API-return point."""
        import zlib
        uc = self.uc
        regions = []
        for begin, end, perms in sorted(uc.mem_regions()):
            base, size = int(begin), int(end) - int(begin) + 1
            if 0 < size <= 0x4000000:
                regions.append((base, size))
        blob = bytearray()
        offsets = {}
        for base, size in regions:
            offsets[str(base)] = len(blob)
            blob += bytes(uc.mem_read(base, size))
        regs = {n: uc.reg_read(c) for n, c in self.REGCONSTS.items()}
        meta = {
            "version": 2, "tag": tag, "count": self.state["count"],
            "clock_scale": self.clock_scale,
            "arena": self.state["arena"],
            "sleep_ms": self.state.get("sleep_ms", 0),
            "next_handle": self.state["next_handle"],
            "seh_head": self.seh_head[0],
            "seh_dispatches": self.state.get("seh_dispatches", 0),
            "corridor_n": self.corridor_n,
            "eip": uc.reg_read(UC_X86_REG_EIP),
            "eflags": uc.reg_read(UC_X86_REG_EFLAGS),
            "regs": regs,
            "handles": self.state["handles"],
            "files": self.state["files"],
            "reg_ops": self.state["reg"],
            "probes": self.state["probes"],
            "modules": [[b, i["label"], i["path"]] for b, i in
                        self.modules.items()],
            "regions": regions, "offsets": offsets,
        }
        self.ck2_dir.mkdir(parents=True, exist_ok=True)
        (self.ck2_dir / f"{tag}.json").write_text(json.dumps(meta))
        (self.ck2_dir / f"{tag}.bin.z").write_bytes(
            zlib.compress(bytes(blob), 1))
        print(f"[ck2] saved '{tag}' at n={self.state['count']} "
              f"eip={hex(meta['eip'])} regions={len(regions)}")

    def load_checkpoint_v2(self, tag: str):
        import zlib
        uc = self.uc
        meta = json.loads((self.ck2_dir / f"{tag}.json").read_text())
        blob = zlib.decompress((self.ck2_dir / f"{tag}.bin.z").read_bytes())
        for base, size in meta["regions"]:
            off = meta["offsets"][str(base)]
            try:
                uc.mem_map(base, size)
            except Exception:
                pass
            uc.mem_write(base, blob[off:off + size])
        self.state["count"] = meta["count"]
        self.state["arena"] = meta["arena"]
        self.state["sleep_ms"] = meta["sleep_ms"]
        self.state["next_handle"] = meta["next_handle"]
        self.state["handles"] = meta["handles"]
        self.state["files"] = meta["files"]
        self.state["reg"] = meta["reg_ops"]
        self.state["probes"] = meta["probes"]
        self.seh_head = [meta["seh_head"]]
        self.state["seh_dispatches"] = meta["seh_dispatches"]
        self.corridor_n = meta["corridor_n"]
        # explicit CLI override wins over the checkpoint-saved scale
        self.clock_scale = getattr(self, "force_clock_scale", None) or meta["clock_scale"]
        for b, label, path in meta["modules"]:
            self.remember_module(b, Path(path), label)
            self.register_apis(b)
        for n, c in self.REGCONSTS.items():
            uc.reg_write(c, meta["regs"][n])
        uc.reg_write(UC_X86_REG_EFLAGS, meta["eflags"])
        uc.reg_write(UC_X86_REG_EIP, meta["eip"])
        print(f"[ck2] resumed '{tag}' at n={meta['count']} "
              f"eip={hex(meta['eip'])}")
        return meta["eip"]

    def write_signature(self, path: Path):
        """Normalized control-flow signature of the whole run."""
        api_seq = json.dumps(self.apilog, default=str)
        regs = {n: self.uc.reg_read(c) for n, c in self.REGCONSTS.items()}
        regs["eflags"] = self.uc.reg_read(UC_X86_REG_EFLAGS)
        try:
            img = bytes(self.uc.mem_read(IMAGE, self.image_size))
        except Exception:
            img = b""
        sig = {
            "count": self.state["count"],
            "why": self.state["why"],
            "eip": self.state["eip"],
            "apilog_len": len(self.apilog),
            "apilog_sha256": sha256(api_seq.encode()),
            "regs_sha256": sha256(json.dumps(regs).encode()),
            "image_sha256": sha256(img),
            "tail_a_writes": self.state["tail_a_writes"],
            "tail_b_writes": self.state["tail_b_writes"],
            "seh_dispatches": self.state.get("seh_dispatches", 0),
            "messageboxes": self.state["messageboxes"],
        }
        path.write_text(json.dumps(sig, indent=1, default=str))

    class _Tracer:
        """Selective dynamic tracer: Tier-1 branch/API events + Tier-2
        per-instruction detail (regs/flags/writes) as one ordered stream."""

        def __init__(self, rp, out_path: Path, max_insns: int):
            self.rp = rp
            self.fh = out_path.open("w", encoding="utf-8")
            self.max_insns = max_insns
            self.count = 0
            self.prev = None          # (addr, size, is_cflow, rec)
            self.writes = []          # memory writes of current instruction
            self.reads = []           # memory reads of current instruction
            self.read_map = {}        # (addr, value) -> read count
            self.log_reads = bool(getattr(rp, "trace_log_reads", False))
            self.blocks = {}          # block-start RVA (or VA) -> hits
            self.branch_stats = {}    # branch VA -> executions
            self.cflow_cache = {}     # (addr, bytes8) -> (size, kind)
            self.pending_branch = None

        # -- helpers --
        def _decode(self, addr):
            raw = bytes(self.rp.uc.mem_read(addr, 16))
            key = (addr, raw[:8])
            hit = self.cflow_cache.get(key)
            if hit is not None:
                return hit
            try:
                insn = next(self.rp.md.disasm(raw, addr))
                kind = None
                m = insn.mnemonic
                if m.startswith("j"):
                    kind = "jcc" if m != "jmp" else (
                        "ijmp" if "dword ptr" in insn.op_str or
                        "[" in insn.op_str or insn.op_str.strip() in
                        [r for r in ("eax", "ebx", "ecx", "edx", "esi",
                                     "edi", "ebp", "esp")] else "jmp")
                elif m == "call":
                    kind = "call" if "[" not in insn.op_str else "icall"
                elif m == "ret" or m.startswith("ret"):
                    kind = "ret"
                elif m == "loop" or m.startswith("loop"):
                    kind = "jcc"
                hit = (insn.size, kind, insn.mnemonic + " " + insn.op_str)
            except StopIteration:
                hit = (1, None, "?")
            self.cflow_cache[key] = hit
            return hit

        def _regs(self):
            uc = self.rp.uc
            return [uc.reg_read(c) for c in self.rp.REGCONSTS.values()]

        # -- called from on_code for every executed instruction --
        def step(self, addr: int):
            uc = self.rp.uc
            if self.prev is not None:
                paddr, psize, pkind, prec = self.prev
                succ = addr
                # block start detection
                if addr != paddr + psize or pkind is not None:
                    self.blocks[addr] = self.blocks.get(addr, 0) + 1
                if pkind in ("jcc", "jmp", "ijmp", "ret"):
                    taken = addr != paddr + psize
                    if pkind == "jcc":
                        self.branch_stats[paddr] = \
                            self.branch_stats.get(paddr, 0) + 1
                        self.fh.write(json.dumps({
                            "t": "b", "n": prec["n"], "e": paddr,
                            "d": prec["d"], "f": prec["f"],
                            "taken": taken,
                            "to": succ if taken else paddr + psize}) + "\n")
                # finalize previous instruction record
                prec["w"] = self.writes
                if self.log_reads and self.reads:
                    prec["rd"] = [(a, v) for a, s, v in self.reads]
                for ra, rs, rv in self.reads:
                    key = (ra, rv)
                    self.read_map[key] = self.read_map.get(key, 0) + 1
                self.reads = []
                self.writes = []
                self.fh.write(json.dumps(prec) + "\n")
                self.writes = []
            # start new record
            size, kind, disasm = self._decode(addr)
            rec = {"t": "i", "n": self.rp.state["count"], "e": addr,
                   "d": disasm, "r": self._regs(),
                   "f": uc.reg_read(UC_X86_REG_EFLAGS)}
            self.prev = (addr, size, kind, rec)
            self.count += 1
            if self.count > self.max_insns:
                self.fh.write(json.dumps({"t": "cap", "n": self.count}) + "\n")
                self.fh.close()
                self.rp.tracer_closed = True
                self.rp.tracer = None
                self.rp.state["why"] = "trace-cap"
                self.rp.state["eip"] = addr
                uc.emu_stop()
                return

        def event(self, kind: str, data: dict):
            data = {"t": kind, "n": self.rp.state["count"], **data}
            self.fh.write(json.dumps(data, default=str) + "\n")

        def api_event(self, name, ret):
            self.event("api", {"name": name, "ret": ret})

        def finalize(self):
            if self.prev is not None and not self.fh.closed:
                paddr, psize, pkind, prec = self.prev
                prec["w"] = self.writes
                self.fh.write(json.dumps(prec) + "\n")
                self.prev = None
            if not self.fh.closed:
                self.fh.write(json.dumps({"t": "end",
                                          "why": self.rp.state["why"]}) + "\n")
                self.fh.close()

    def tracer_maybe_start(self, addr: int):
        """Activate tracing at the corridor entry or a given count."""
        if self.tracer is not None:
            return
        mode = self.trace_from
        start = False
        if mode == "corridor" and self.corridor_n is not None:
            start = self.state["count"] >= self.corridor_n
        elif isinstance(mode, int):
            start = self.state["count"] >= mode
        if not start:
            return
        out = Path(self.trace_dir) / "corridor-trace.jsonl"
        self.tracer = self._Tracer(self, out, self.trace_max)
        print(f"[trace] start at n={self.state['count']} "
              f"addr={hex(addr)} -> {out}")


    def skip_seh(self, address: int) -> bool:
        raw = bytes(self.uc.mem_read(address, 8))
        if raw[0] != 0x64:
            return False
        kind = disp = None
        if raw[1:3] == b"\xff\x35":
            kind, disp = "push", int.from_bytes(raw[3:7], "little")
        elif raw[1:3] == b"\x89\x25":
            kind, disp = "store", int.from_bytes(raw[3:7], "little")
        elif raw[1:3] == b"\x8f\x05":
            kind, disp = "pop", int.from_bytes(raw[3:7], "little")
        if kind is None or disp != 0:
            self.state["why"] = "fs-beyond-seh-head"
            self.state["eip"] = address
            self.uc.emu_stop()
            return True
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        if kind == "push":
            esp -= 4
            self.uc.mem_write(esp, (0xFFFFFFFF).to_bytes(4, "little"))
            self.uc.reg_write(UC_X86_REG_ESP, esp)
        elif kind == "store":
            self.seh_head[0] = esp
        else:
            self.seh_head[0] = int.from_bytes(bytes(self.uc.mem_read(esp, 4)), "little")
            self.uc.reg_write(UC_X86_REG_ESP, esp + 4)
        self.state["fs0"] = self.state.get("fs0", 0) + 1
        self.uc.reg_write(UC_X86_REG_EIP, address + 7)
        return True

    def dispatch_seh_exception(self, eip: int, code: int) -> bool:
        """Delegate to the REAL ntdll!KiUserExceptionDispatcher with a
        correctly laid-out CONTEXT + EXCEPTION_RECORD (x86)."""
        uc = self.uc
        kued = self.api_va("ntdll.dll", "KiUserExceptionDispatcher")
        if not kued:
            self.state["why"] = "no-KiUserExceptionDispatcher"
            uc.emu_stop()
            return False
        esp = uc.reg_read(UC_X86_REG_ESP)
        ctx_addr = (esp - 0x2D0) & ~7
        record_addr = (ctx_addr - 0xA0) & ~7
        ctx = bytearray(0x2CC)
        def put(off, val):
            ctx[off:off + 4] = (val & 0xFFFFFFFF).to_bytes(4, "little")
        put(0x00, 0x0001003F)  # CONTEXT_FULL (x86)
        put(0x8C, 0x0023)      # SegGs? (selector values are mostly ignored)
        put(0x90, 0x0038)      # SegFs
        put(0x94, 0x0023)      # SegEs
        put(0x98, 0x0023)      # SegDs
        R = {"edi": UC_X86_REG_EDI, "esi": UC_X86_REG_ESI, "ebx": UC_X86_REG_EBX,
             "edx": UC_X86_REG_EDX, "ecx": UC_X86_REG_ECX, "eax": UC_X86_REG_EAX,
             "ebp": UC_X86_REG_EBP}
        put(0x9C, uc.reg_read(R["edi"]))
        put(0xA0, uc.reg_read(R["esi"]))
        put(0xA4, uc.reg_read(R["ebx"]))
        put(0xA8, uc.reg_read(R["edx"]))
        put(0xAC, uc.reg_read(R["ecx"]))
        put(0xB0, uc.reg_read(R["eax"]))
        put(0xB4, uc.reg_read(R["ebp"]))
        put(0xB8, eip)         # Eip
        put(0xBC, 0x001B)      # SegCs
        put(0xC0, uc.reg_read(UC_X86_REG_EFLAGS) if hasattr(uc, 'x') else 0x00246)
        put(0xC4, esp)         # Esp
        put(0xC8, 0x0023)      # SegSs
        uc.mem_write(ctx_addr, bytes(ctx))
        rec = bytearray(0x98)
        rec[0:4] = code.to_bytes(4, "little")
        rec[4:8] = (0).to_bytes(4, "little")
        rec[16:20] = eip.to_bytes(4, "little")
        uc.mem_write(record_addr, bytes(rec))
        # kernel-style call: push ctx, push rec, jump
        esp = record_addr
        esp -= 4
        uc.mem_write(esp, ctx_addr.to_bytes(4, "little"))
        esp -= 4
        uc.mem_write(esp, record_addr.to_bytes(4, "little"))
        uc.reg_write(UC_X86_REG_ESP, esp)
        uc.reg_write(UC_X86_REG_EIP, kued)
        self.state["seh_dispatches"] = self.state.get("seh_dispatches", 0) + 1
        if self.tracer is not None:
            self.tracer.event("seh", {"fault_eip": hex(eip), "code": hex(code),
                                      "kued": hex(kued)})
        head = self.dword(self.teb)
        try:
            self.note("seh-dispatch", eip=hex(eip), code=hex(code), via="ntdll",
                      teb0=hex(head),
                      frame0=hex(self.dword(head)) if 0 < head < 0x400000 else "?",
                      frame4=hex(self.dword(head + 4)) if 0 < head < 0x400000 else "?")
        except Exception:
            self.note("seh-dispatch", eip=hex(eip), code=hex(code), via="ntdll")
        if self.state.get("seh_dispatches", 0) == 1:
            self.state["seh_trace"] = []
        return True

    # ---------- main ----------
    def setup(self):
        uc = self.uc
        image_size = self.map_pe(self.exe, IMAGE)
        self.image_size = image_size
        uc.mem_map(STACK, STACK_SIZE)
        for name, base in GUEST_BASES.items():
            path = self.guest_dir / name
            self.map_pe(path, base)
            self.remember_module(base, path, name)
            self.register_apis(base)
        # synthetic TEB/PEB (Unicorn x86-32 has no FS base support, so
        # fs-prefixed instructions are emulated in on_code)
        self.teb = 0x7FFDE000
        self.peb = 0x7FFDD000
        try:
            uc.mem_map(self.peb, 0x2000)
        except Exception:
            pass
        teb = bytearray(0x1000)
        def w32(buf, off, val):
            buf[off:off + 4] = (val & 0xFFFFFFFF).to_bytes(4, "little")
        w32(teb, 0x00, 0xFFFFFFFF)         # SEH chain end sentinel
        w32(teb, 0x04, STACK + STACK_SIZE)   # StackBase
        w32(teb, 0x08, STACK)                # StackLimit
        w32(teb, 0x18, self.teb)             # self
        w32(teb, 0x30, self.peb)             # PEB
        w32(teb, 0x34, 0)                    # TLS pointer
        uc.mem_write(self.teb, bytes(teb))
        peb = bytearray(0x400)
        peb[0x02] = 0                        # BeingDebugged = FALSE (truthful)
        w32(peb, 0x68, 0)                    # NtGlobalFlag = 0 (truthful)
        w32(peb, 0x08, IMAGE)                # ImageBaseAddress
        uc.mem_write(self.peb, bytes(peb))
        # faithful IAT slot: guest kernel32 GetLocalTime
        uc.mem_write(IMAGE + IAT_SLOT,
                     (GUEST_BASES["kernel32.dll"] + GETLOCALTIME_RVA).to_bytes(4, "little"))
        self.seh_head = [0xFFFFFFFF]
        return image_size

    def sync_seh(self):
        self.uc.mem_write(self.teb, self.seh_head[0].to_bytes(4, "little"))

    def emulate_fs_insn(self, address: int) -> bool:
        """Handle an fs-prefixed instruction against the synthetic TEB."""
        uc = self.uc
        raw = bytes(uc.mem_read(address, 8))
        if raw[0] != 0x64:
            return False
        try:
            insn = next(self.md.disasm(raw, address))
        except StopIteration:
            return False
        op = insn.op_str.replace("fs:", "")
        esp = uc.reg_read(UC_X86_REG_ESP)
        R = {"eax": UC_X86_REG_EAX, "ebx": UC_X86_REG_EBX, "ecx": UC_X86_REG_ECX,
             "edx": UC_X86_REG_EDX, "esi": UC_X86_REG_ESI, "edi": UC_X86_REG_EDI,
             "ebp": UC_X86_REG_EBP, "esp": UC_X86_REG_ESP}
        note = f"{insn.mnemonic} {op}"
        # push/pop fs:[x] and other fs moves
        if insn.mnemonic in ("push", "pop") and op.startswith("dword ptr ["):
            try:
                disp = int(op.split("[")[1].rstrip("]"), 16)
            except ValueError:
                return False
            if insn.mnemonic == "push":
                val = self.dword(self.teb + disp)
                esp -= 4
                uc.mem_write(esp, val.to_bytes(4, "little"))
                uc.reg_write(UC_X86_REG_ESP, esp)
            else:  # pop fs:[x]
                val = self.dword(esp)
                uc.mem_write(self.teb + disp, val.to_bytes(4, "little"))
                if disp == 0:
                    self.seh_head[0] = val
                uc.reg_write(UC_X86_REG_ESP, esp + 4)
            uc.reg_write(UC_X86_REG_EIP, address + insn.size)
            self.note("fs", insn=note, value=hex(val))
            return True
        # mov REG, fs:[disp]  / mov fs:[disp], REG
        if insn.mnemonic == "mov" and "," in op:
            lhs, rhs = (part.strip() for part in op.split(",", 1))
            def memdisp(token):
                if token.startswith("dword ptr [") and token.endswith("]"):
                    try:
                        return int(token.split("[", 1)[1].rstrip("]"), 16)
                    except ValueError:
                        return None
                return None
            if memdisp(rhs) is not None and lhs in R:      # reg <- fs:[disp]
                disp = memdisp(rhs)
                if disp == 0 and lhs == "esp":
                    pass
                val = self.dword(self.teb + disp)
                uc.reg_write(R[lhs], val)
                uc.reg_write(UC_X86_REG_EIP, address + insn.size)
                self.note("fs", insn=note, value=hex(val))
                return True
            if memdisp(lhs) is not None and rhs in R:      # fs:[disp] <- reg
                disp = memdisp(lhs)
                val = uc.reg_read(R[rhs])
                uc.mem_write(self.teb + disp, val.to_bytes(4, "little"))
                if disp == 0:
                    self.seh_head[0] = val
                uc.reg_write(UC_X86_REG_EIP, address + insn.size)
                self.note("fs", insn=note, wrote=hex(val))
                return True
        return False

    def run(self, budget: int):
        uc = self.uc
        entry = IMAGE + 0x9D8000
        ck_path = Path(".work/task-027/static-main/probe-checkpoint.bin")
        ck_meta = Path(".work/task-027/static-main/probe-checkpoint.json")
        start_at_probe = False
        if getattr(self, "resume_ckpt", None):
            entry = self.load_checkpoint_v2(self.resume_ckpt)
            start_at_probe = True  # suppress the task027 probe checkpoint
        elif getattr(self, "resume_mode", False) and ck_path.exists() and ck_meta.exists():
            meta = json.loads(ck_meta.read_text())
            blob = ck_path.read_bytes()
            for region in meta["regions"]:
                base, size = region
                data = blob[meta["offsets"][str(base)]:meta["offsets"][str(base)] + size]
                try:
                    uc.mem_map(base, size)
                except Exception:
                    pass
                uc.mem_write(base, data)
            self.seh_head = [0xFFFFFFFF]
            self.state["count"] = meta["count"]
            self.state["arena"] = meta["arena"]
            for b, label, path in meta["modules"]:
                self.remember_module(b, Path(path), label)
                self.register_apis(b)
            start_at_probe = True
            entry = meta["resume_eip"]
            uc.reg_write(UC_X86_REG_ESP, meta["esp_before"] + 4 + 28)
            uc.reg_write(UC_X86_REG_EAX, 0xFFFFFFFF)
            RN = {"eax": UC_X86_REG_EAX, "ebx": UC_X86_REG_EBX, "ecx": UC_X86_REG_ECX,
                  "edx": UC_X86_REG_EDX, "esi": UC_X86_REG_ESI, "edi": UC_X86_REG_EDI,
                  "ebp": UC_X86_REG_EBP}
            for name, val in meta["regs"].items():
                uc.reg_write(RN[name], val)
            print(f"resumed from probe checkpoint at {hex(entry)} (n={meta['count']})")

        def save_checkpoint(address):
            regions = []
            offsets = {}
            buf = bytearray()
            for begin, end, perms in sorted(uc.mem_regions()):
                base = int(begin); size = int(end) - int(begin) + 1
                if size <= 0 or size > 0x4000000:
                    continue
                regions.append((base, size))
            for base, size in regions:
                offsets[str(base)] = len(buf)
                buf += bytes(uc.mem_read(base, size))
            ck_path.write_bytes(buf)
            regs = {}
            for r, name in ((UC_X86_REG_EAX, "eax"), (UC_X86_REG_EBX, "ebx"),
                            (UC_X86_REG_ECX, "ecx"), (UC_X86_REG_EDX, "edx"),
                            (UC_X86_REG_ESI, "esi"), (UC_X86_REG_EDI, "edi"),
                            (UC_X86_REG_EBP, "ebp")):
                regs[name] = uc.reg_read(r)
            ck_meta.write_text(json.dumps({
                "count": self.state["count"], "resume_eip": address,
                "esp_before": uc.reg_read(UC_X86_REG_ESP),
                "regs": regs,
                "arena": self.state["arena"],
                "regions": regions, "offsets": offsets,
                "modules": [[b, i["label"], i["path"]] for b, i in self.modules.items()],
            }))
            print(f"checkpoint saved at first probe (n={self.state['count']})")

        def on_code(_uc, address, size, _u):
            self.state["count"] += 1
            self.state["recent"].append(address)
            if len(self.state["recent"]) > 400:
                del self.state["recent"][0]
            if self.state.get("seh_trace") is not None and len(self.state["seh_trace"]) < 400:
                try:
                    self.state["seh_trace"].append((
                        hex(address),
                        hex(_uc.reg_read(UC_X86_REG_EAX)), hex(_uc.reg_read(UC_X86_REG_EBX)),
                        hex(_uc.reg_read(UC_X86_REG_ECX)), hex(_uc.reg_read(UC_X86_REG_EDX)),
                        hex(_uc.reg_read(UC_X86_REG_ESI)), hex(_uc.reg_read(UC_X86_REG_EDI))))
                except Exception:
                    self.state["seh_trace"].append(hex(address))
            if self.state["count"] > budget:
                self.state["why"] = "budget"
                self.state["eip"] = address
                _uc.emu_stop()
                return
            # ---- Task 028 selective tracing ----
            if self.tracer is None and self.trace_dir:
                self.tracer_maybe_start(address)
            if self.tracer is not None:
                self.tracer.step(address)
            # ---- Task 031 all-VM dispatch logging ----
            vds = getattr(self, "vm_dispatch_sites", None)
            if vds and address in vds:
                dl = self.state.setdefault("vm_dispatches", [])
                if len(dl) < 600000:
                    eax, ebx, ecx, edx, esi, edi, ebp, esp = \
                        _uc.reg_read(UC_X86_REG_EAX), _uc.reg_read(UC_X86_REG_EBX), \
                        _uc.reg_read(UC_X86_REG_ECX), _uc.reg_read(UC_X86_REG_EDX), \
                        _uc.reg_read(UC_X86_REG_ESI), _uc.reg_read(UC_X86_REG_EDI), \
                        _uc.reg_read(UC_X86_REG_EBP), _uc.reg_read(UC_X86_REG_ESP)
                    dl.append((self.state["count"], address - IMAGE,
                               edi, eax & 0xFF, esi, ebx & 0xFF))
            raw0 = bytes(_uc.mem_read(address, 1))
            if raw0[0] == 0x64:
                if self.emulate_fs_insn(address):
                    return
                self.state["why"] = f"unhandled-fs-insn at {hex(address)}"
                self.state["eip"] = address
                _uc.emu_stop()
                return
            if address in self.api_stubs:
                handler = self.api_stubs[address]
                name = self.api_name_at(address)
                self.note("api", name=name or hex(address))
                # Task 028 corridor marker: first timeGetTime call
                if name == "timeGetTime" and self.corridor_n is None:
                    self.corridor_n = self.state["count"]
                    print(f"[corridor] first timeGetTime at n={self.corridor_n}")
                if name == "CreateFileA" and not start_at_probe and not self.state.get("ck_saved"):
                    # checkpoint right before the first probe is answered
                    try:
                        esp0 = uc.reg_read(UC_X86_REG_ESP)
                        ret0 = self.dword(esp0)
                        self.state["ck_saved"] = True
                        save_checkpoint(ret0)
                    except Exception as exc:
                        print("checkpoint failed:", exc)
                handler()
                if self.tracer is not None and name:
                    try:
                        ret = _uc.reg_read(UC_X86_REG_EAX)
                    except Exception:
                        ret = None
                    self.tracer.api_event(name, ret)
                # Task 028 corridor checkpoint: after the first timeGetTime
                # stub has fully returned (stable post-API point)
                if (name == "timeGetTime" and self.ck2_save_mode
                        and not self.ck2_saved):
                    self.ck2_saved = True
                    try:
                        self.save_checkpoint_v2(self.ck2_tag or "corridor")
                    except Exception as exc:
                        print("[ck2] save failed:", exc)
                return
            # entering real system DLL code: intercept only at export entry
            # points; internal code (e.g. ntdll SEH dispatcher) runs for real
            EXEC_OK = {"KiUserExceptionDispatcher", "RtlUnwind", "RtlUnwindEx",
                       "RtlRaiseException", "RtlCaptureContext", "RtlRestoreContext",
                       "memcmp", "memcpy", "memset", "memmove"}
            for base, info in self.modules.items():
                if base <= address < base + 0x200000 and info["label"] != "MapleStory.exe":
                    if address in info["va2name"]:
                        name = info["va2name"][address]
                        if name in EXEC_OK:
                            return  # execute this one for real
                        self.state["why"] = f"unhandled-api {info['label']}!{name}"
                        self.state["eip"] = address
                        _uc.emu_stop()
                        return
                    return  # internal address: allow execution
            rva = address - IMAGE
            if 0 <= rva < self.image_size:
                self.state["exec_pages"].add(rva & ~0xFFF)

        def on_write(_uc, _a, address, s, value, _u):
            if self.tracer is not None:
                self.tracer.writes.append((address, s, value))
            cws = getattr(self, "cell_watch_set", None)
            if cws and address in cws and len(self.state.get("cell_writes", [])) < 400000:
                self.state.setdefault("cell_writes", []).append(
                    (self.state["count"], address, s, value))
            rva = address - IMAGE
            if TAIL_A[0] <= rva < TAIL_A[1]:
                if self.state["tail_a_first"] is None:
                    self.state["tail_a_first"] = {"rva": rva, "n": self.state["count"]}
                self.state["tail_a_writes"] += 1
                self.state["tail_a_spans"].append((rva, s))
                if len(self.state.get("tail_a_prov", [])) < 8192:
                    try:
                        eip = _uc.reg_read(UC_X86_REG_EIP)
                    except Exception:
                        eip = None
                    self.state.setdefault("tail_a_prov", []).append({
                        "rva": rva, "size": s, "value": value,
                        "producer_eip": eip, "n": self.state["count"]})
            elif TAIL_B[0] <= rva < TAIL_B[1]:
                self.state["tail_b_writes"] += 1
                if len(self.state.get("tail_b_prov", [])) < 4096:
                    try:
                        eip = _uc.reg_read(UC_X86_REG_EIP)
                    except Exception:
                        eip = None
                    self.state.setdefault("tail_b_prov", []).append(
                        {"rva": rva, "size": s, "producer_eip": eip,
                         "n": self.state["count"]})
            elif rva in ZTL:
                self.state["ztl_writes"].append({"rva": rva, "n": self.state["count"]})
            elif not (0 <= rva < self.image_size):
                self.state["writes_elsewhere"] += 1

        def on_invalid(_uc, access, address, s, _v, _u):
            if not self.state["why"]:
                self.state["why"] = f"unmapped:{address:#x}"
                try:
                    eip = _uc.reg_read(UC_X86_REG_EIP)
                    self.state["eip"] = eip
                    self.state["crash_dump"] = {
                        "bytes_at_eip": bytes(_uc.mem_read(eip, 16)).hex(),
                        "bytes_before": bytes(_uc.mem_read(max(eip - 24, 1), 24)).hex(),
                        "eax": hex(_uc.reg_read(UC_X86_REG_EAX)),
                        "ebx": hex(_uc.reg_read(UC_X86_REG_EBX)),
                        "ecx": hex(_uc.reg_read(UC_X86_REG_ECX)),
                        "edx": hex(_uc.reg_read(UC_X86_REG_EDX)),
                        "esi": hex(_uc.reg_read(UC_X86_REG_ESI)),
                        "edi": hex(_uc.reg_read(UC_X86_REG_EDI)),
                        "ebp": hex(_uc.reg_read(UC_X86_REG_EBP)),
                        "esp": hex(_uc.reg_read(UC_X86_REG_ESP)),
                        "stack_top": [hex(self.dword(_uc.reg_read(UC_X86_REG_ESP) + 4 * i)) for i in range(8)],
                    }
                except Exception:
                    pass
            _uc.emu_stop()
            return False

        def on_insn_invalid(_uc, _u):
            """The protector uses deliberate #UD/#GP as control flow (SEH).
            Synthesize the SEH dispatch: build CONTEXT + EXCEPTION_RECORD and
            transfer to the current handler from the emulated fs:[0] chain."""
            eip = _uc.reg_read(UC_X86_REG_EIP)
            self.note("insn-invalid", eip=hex(eip), seh=True)
            return self.dispatch_seh_exception(eip, 0xC000001D)  # STATUS_ILLEGAL_INSTRUCTION

        def on_read(_uc, _a, address, s, value, _u):
            rd = self.state.setdefault("read_pages", {})
            rd[(address >> 12) << 12] = rd.get((address >> 12) << 12, 0) + 1
            if self.tracer is not None:
                self.tracer.reads.append((address, s, value))
            # Task 030: watch-list provenance for pre-corridor API outputs
            watch = self.state.get("api_watch")
            if watch and len(self.state.get("watch_hits", [])) < 60000:
                for wname, waddr, wsize, wn in watch:
                    if waddr <= address < waddr + wsize and self.state["count"] > wn:
                        self.state.setdefault("watch_hits", []).append(
                            (self.state["count"], wname, address, s))
                        break
            # targeted external-read log (kernel32 range) for slice analysis
            if GUEST_BASES["kernel32.dll"] <= address < GUEST_BASES["kernel32.dll"] + 0x200000:
                self.state.setdefault("k32_reads", []).append(
                    (self.state["count"], address, s))

        uc.hook_add(UC_HOOK_CODE, on_code)
        uc.hook_add(UC_HOOK_MEM_WRITE, on_write)
        uc.hook_add(UC_HOOK_MEM_READ, on_read)
        uc.hook_add(UC_HOOK_MEM_INVALID, on_invalid)
        try:
            from unicorn import UC_HOOK_INSN_INVALID
            uc.hook_add(UC_HOOK_INSN_INVALID, on_insn_invalid)
        except Exception:
            pass
        if not start_at_probe:
            uc.reg_write(UC_X86_REG_ESP, STACK + STACK_SIZE - 0x1000)
            uc.reg_write(UC_X86_REG_EBP, 0)
            for r in (UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX,
                      UC_X86_REG_ESI, UC_X86_REG_EDI):
                uc.reg_write(r, 0)
        try:
            uc.emu_start(entry, 0, count=budget - self.state["count"] if start_at_probe else budget)
            if not self.state["why"]:
                self.state["why"] = "emu-return"
                self.state["eip"] = uc.reg_read(UC_X86_REG_EIP)
        except Exception as exc:
            err = getattr(exc, "errno", None)
            handled = False
            if err is not None and not self.state["why"]:
                try:
                    eip_now = uc.reg_read(UC_X86_REG_EIP)
                except Exception:
                    eip_now = self.state["eip"]
                # privileged instruction / gp-fault style errors -> SEH too
                if str(exc).find("EXCEPTION") >= 0 or str(exc).find("PRIV") >= 0 or err == 15:
                    self.note("cpu-exception", eip=hex(eip_now), err=str(exc))
                    if self.dispatch_seh_exception(eip_now, 0xC0000096):
                        handled = True
                        try:
                            uc.emu_start(uc.reg_read(UC_X86_REG_EIP), 0, count=budget - self.state["count"])
                            handled = True
                        except Exception as exc2:
                            self.state.setdefault("why2", str(exc2))
            if not self.state["why"] and not handled:
                self.state["why"] = f"error:{exc.__class__.__name__}:{exc}"
                try:
                    self.state["eip"] = uc.reg_read(UC_X86_REG_EIP)
                except Exception:
                    pass
        finally:
            if self.tracer is not None:
                self.tracer.finalize()

    def summary(self) -> dict:
        st = dict(self.state)
        st.pop("recent", None)
        st["exec_pages"] = len(st.pop("exec_pages"))
        st["tail_a_spans"] = len(st["tail_a_spans"])
        st.pop("handles", None)
        rp = st.pop("read_pages", {})
        st["read_pages_count"] = len(rp)
        st["read_pages_detail"] = {hex(k): v for k, v in
                                   sorted(rp.items(), key=lambda x: -x[1])[:64]}
        st["api_watch"] = self.state.get("api_watch", [])
        wh = self.state.get("watch_hits", [])
        st["watch_hits_count"] = len(wh)
        st["watch_hits_head"] = wh[:40]
        st["watch_hits_tail"] = wh[-40:]
        ta = bytes(self.uc.mem_read(IMAGE + TAIL_A[0], min(0x10000, TAIL_A[1] - TAIL_A[0])))
        st["tail_a_first_page_nonzero"] = any(ta)
        ztl = {hex(z): bytes(self.uc.mem_read(IMAGE + z, 16)).hex() for z in ZTL}
        st["ztl_slots"] = ztl
        st["recent_eip"] = [hex(a) for a in self.state["recent"]]
        st["apis_used"] = {}
        for entry in self.log:
            k = entry["kind"]
            st["apis_used"][k] = st["apis_used"].get(k, 0) + 1
        st["apilog_len"] = len(self.apilog)
        st["corridor_n"] = self.corridor_n
        st["probes"] = self.state["probes"]
        st["messageboxes"] = self.state["messageboxes"]
        st["files"] = self.state["files"]
        st["crash_dump"] = self.state.get("crash_dump")
        st["seh_dispatches"] = self.state.get("seh_dispatches", 0)
        st["seh_trace"] = self.state.get("seh_trace")
        st["log_tail"] = self.log[-60:]
        st["eip_history_tail"] = [hex(a) for a in self.state["recent"][-400:]]
        if self.tracer is not None:
            st["tracer_blocks"] = len(self.tracer.blocks)
            st["tracer_branch_sites"] = len(self.tracer.branch_stats)
            st["tracer_insns"] = self.tracer.count
            st["tracer_read_sites"] = len(self.tracer.read_map)
        st["read_pages"] = len(self.state.get("read_pages", {}))
        return st

def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--exe", type=Path, required=True)
    p.add_argument("--guest-dir", type=Path, required=True)
    p.add_argument("--client-dir", type=Path, required=True)
    p.add_argument("--budget", type=int, default=200_000_000)
    p.add_argument("--resume", action="store_true",
                   help="resume from probe checkpoint instead of full run")
    p.add_argument("--dump-image", type=Path, default=None,
                   help="write the emulated image to this file at stop")
    p.add_argument("--clock-scale", type=float, default=227.0,
                   help="virtual ms per 1M instructions (default 227 = TCG-calibrated)")
    p.add_argument("--json-out", type=Path)
    # ---- Task 028 ----
    p.add_argument("--sig-out", type=Path, default=None,
                   help="write normalized run signature (hashes) to this file")
    p.add_argument("--apilog-out", type=Path, default=None,
                   help="write the full uncapped API event log to this file")
    p.add_argument("--save-ck", type=Path, default=None, metavar="DIR",
                   help="save a v2 scratch checkpoint into DIR at --ck-at")
    p.add_argument("--ck-at", default="corridor",
                   choices=["corridor"],
                   help="checkpoint marker (corridor = after first timeGetTime)")
    p.add_argument("--resume-ck", type=Path, default=None, metavar="DIR",
                   help="resume from a v2 checkpoint dir (uses corridor tag)")
    p.add_argument("--trace-dir", type=Path, default=None,
                   help="enable selective tracing, JSONL written into this dir")
    p.add_argument("--trace-from", default="corridor",
                   help="'corridor' or an instruction count N")
    p.add_argument("--trace-max", type=int, default=4_000_000,
                   help="max traced instructions (fail-safe cap)")
    p.add_argument("--trace-log-reads", action="store_true",
                   help="persist per-instruction memory reads in the trace")
    p.add_argument("--tgt-15ms", action="store_true",
                   help="faithful timeGetTime 15.625ms quantization (Win7 default)")
    p.add_argument("--cmdline", default='"F:\\MapleStory.exe"',
                   help="command line returned by GetCommandLineA/W "
                        "(default: WMI-captured exact form of run A1R2)")
    p.add_argument("--vclock-base", type=int, default=1_200_000,
                   help="virtual uptime (ms) at emulation start; override "
                        "with measured boot->launch deltas for fidelity tests")
    p.add_argument("--write-log", type=Path, default=None,
                   help="file of hex addresses (one per line); all writes to "
                        "these addresses are logged and dumped to "
                        "<trace-dir or cwd>/cell-writes.json")
    p.add_argument("--vm-dispatch-log", action="store_true",
                   help="log every VM dispatch at the known dispatch sites "
                        "(movzx sites RVA 0x82208B/0x84A89A/0x8574D6) to "
                        "vm-dispatches.json with n, site, edi, index, esi, bl")
    p.add_argument("--glt-sec", type=int, default=30,
                   help="GetLocalTime wSecond override (diagnostic sweep)")
    p.add_argument("--glt-ms", type=int, default=0,
                   help="GetLocalTime wMilliseconds override (diagnostic sweep)")
    args = p.parse_args(argv)

    rp = Replay(args.exe, args.guest_dir, args.client_dir)
    rp.clock_scale = args.clock_scale
    rp.force_clock_scale = args.clock_scale
    rp.cmdline_variants = [args.cmdline]
    rp.state.setdefault("vclock_base", args.vclock_base)
    rp.state["glt_sec"] = args.glt_sec
    rp.state["glt_ms"] = args.glt_ms
    if args.tgt_15ms:
        rp.state["tgt_faithful_resolution"] = True
    if args.resume:
        rp.resume_mode = True
    if args.save_ck:
        rp.ck2_dir = args.save_ck
        rp.ck2_tag = args.ck_at
        rp.ck2_save_mode = True
    if args.resume_ck:
        rp.resume_ckpt = "corridor"
        rp.ck2_dir = args.resume_ck
    if args.trace_dir:
        args.trace_dir.mkdir(parents=True, exist_ok=True)
        rp.trace_dir = args.trace_dir
        tf = args.trace_from
        rp.trace_from = tf if tf == "corridor" else int(tf)
        rp.trace_max = args.trace_max
        rp.trace_log_reads = args.trace_log_reads
    if args.vm_dispatch_log:
        rp.vm_dispatch_sites = {0x400000 + 0x82208B, 0x400000 + 0x84A89A,
                                0x400000 + 0x8574D6}
        rp.state["vm_dispatches"] = []
    if args.write_log:
        rp.cell_watch_set = set()
        for line in args.write_log.read_text().split():
            line = line.strip()
            if line:
                rp.cell_watch_set.add(int(line, 16))
        rp.state["cell_writes"] = []
    rp.setup()
    if args.resume_ck:
        # memory already restored by load_checkpoint_v2 during run(); setup()
        # re-mapped DLLs first, which is harmless (same bases, then overwritten)
        pass
    t0 = time.time()
    rp.run(args.budget)
    if args.trace_dir and rp.tracer is not None:
        (args.trace_dir / "readmap.json").write_text(json.dumps(
            {f"{a:08x}={v:08x}" if isinstance(v, int) else f"{a:08x}":
             c for (a, v), c in rp.tracer.read_map.items()}, default=str))
    if args.trace_dir and rp.state.get("k32_reads"):
        (args.trace_dir / "k32_reads.json").write_text(json.dumps(
            rp.state["k32_reads"]))
    if args.write_log and rp.state.get("cell_writes"):
        outp = (args.trace_dir / "cell-writes.json") if args.trace_dir \
            else Path("cell-writes.json")
        outp.write_text(json.dumps(rp.state["cell_writes"]))
        print(f"cell-writes ({len(rp.state['cell_writes'])}) -> {outp}")
    if args.vm_dispatch_log and rp.state.get("vm_dispatches"):
        outp = (args.trace_dir / "vm-dispatches.json") if args.trace_dir \
            else Path("vm-dispatches.json")
        outp.write_text(json.dumps(rp.state["vm_dispatches"]))
        print(f"vm-dispatches ({len(rp.state['vm_dispatches'])}) -> {outp}")
    if args.dump_image:
        data = bytes(rp.uc.mem_read(IMAGE, rp.image_size))
        args.dump_image.write_bytes(data)
        print(f"image dumped to {args.dump_image} ({len(data)} bytes)")
    out = rp.summary()
    out["seconds"] = round(time.time() - t0, 1)
    text = json.dumps(out, indent=2, default=str)
    print(text[:8000])
    if args.json_out:
        args.json_out.write_text(text, encoding="utf-8")
    if args.sig_out:
        rp.write_signature(args.sig_out)
        print(f"signature written to {args.sig_out}")
    if args.apilog_out:
        args.apilog_out.write_text(json.dumps(rp.apilog, default=str))
        print(f"apilog ({len(rp.apilog)} events) written to {args.apilog_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
