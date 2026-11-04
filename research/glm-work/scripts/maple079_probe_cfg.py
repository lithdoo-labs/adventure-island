"""Static CFG and call-site recovery for the CMS079 protector probe cluster.

Normalized from .work/task-011/cfg_follow.py (Task 011 starter) following the
repo script conventions (client hash self-check, capture validation).

What it does
------------
1. Verifies the main client SHA-256 and the probe-window capture.
2. Walks the static control flow of the already-materialized probe window
   (.work/task-009/probe-window.bin, RVA 0x00856000, len 0xC000) from the
   SICE ordinary-system miss edge 0x00859780 forward, and from the shared
   detection edge 0x00859A61, following only direct transfers:
   jmp imm / call imm (local gadget) / ret via tracked stack.
   Conditional branches that merely skip one junk byte are not splits.
   No branch is chosen for execution; both sides are recorded.
3. Enumerates the WinLicense registry cluster units inside the block that the
   normal path jumps over (0x00859CED-0x0085A36D): per-unit key, value name,
   and every indirect call with its slot and argument shape.
4. Decodes the five resolver calls at 0x0085A36E-0x0085A3FE and maps their
   destination slots onto the registry cluster slots.

What it never does
------------------
- no debugger, no process, no execution of the sample
- no patching of bytes, branches, flags, or registers
- no invented CreateFileA / registry / resolver return values
- outputs CSV + stdout summary only (no binary blobs)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from capstone.x86 import X86_OP_IMM, X86_OP_MEM, X86_OP_REG

ROOT = Path(__file__).resolve().parents[2]
CLIENT_DIR = ROOT / ".work" / "task-001" / "extracted"
WINDOW = ROOT / ".work" / "task-009" / "probe-window.bin"
EXPECTED_SHA = "5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d"

BASE = 0x856000
IMAGE = 0x400000
POP = 0x81C6CF          # stage-2 pop site: formed(disp) = POP + disp - SUB
SUB = 0x074436BB
GATE_SLOT = 0x81A361    # export-walker first-character gate

SICE_CALL = 0x859757
SIWVID_CALL = 0x8598B3
NTICE_CALL = 0x8599FC
NORMAL_ROOT = 0x859780
DETECT_ROOT = 0x859A61

REG_HEAD = 0x859CED     # first byte after the jmp-over at 0x859CE9
REG_TAIL = 0x85A36E     # first byte after the cluster (jmp target)
STRINGS_RVA = 0x859C24  # WinLicense string table

blob = b""
END = 0
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


# ---------------------------------------------------------------- helpers


def client_sha() -> str:
    exe = next(CLIENT_DIR.rglob("MapleStory.exe"))
    return hashlib.sha256(exe.read_bytes()).hexdigest()


def formed(disp: int) -> int:
    return (POP + disp - SUB) & 0xFFFFFFFF


def strings() -> dict[int, str]:
    out: dict[int, str] = {}
    run = bytearray()
    start = 0
    for index, byte in enumerate(blob):
        if 32 <= byte < 127:
            if not run:
                start = index
            run.append(byte)
        else:
            if len(run) >= 4:
                out[BASE + start] = run.decode("ascii")
            run = bytearray()
    if len(run) >= 4:
        out[BASE + start] = run.decode("ascii")
    return out


STRINGS: dict[int, str] = {}


def one(rva: int):
    if not (BASE <= rva < END):
        return None
    found = list(md.disasm(blob[rva - BASE : rva - BASE + 16], rva, count=1))
    return found[0] if found else None


def slot_comment(insn) -> str:
    for op in insn.operands:
        if op.type == X86_OP_MEM and insn.reg_name(op.mem.base) == "ebp" and op.mem.disp:
            target = formed(op.mem.disp)
            text = STRINGS.get(target)
            return f"slot {target:#x}" + (f" ({text!r})" if text else "")
    return ""


# ---------------------------------------------------------------- walker


class Walker:
    """Concrete-stack static walker. Follows direct transfers only.

    A conditional whose target is insn.next + 1 only skips a junk byte and is
    not treated as a split (same policy as the Task 011 starter script).
    """

    def __init__(self) -> None:
        self.blocks: list[dict] = []
        self.calls: list[dict] = []
        self.seen: set[int] = set()

    def run(self, roots: list[tuple[int, str]]) -> None:
        work: list[tuple[int, list, dict, str]] = [
            (rva, [], {n: None for n in ("eax", "ebx", "ecx", "edx", "esi", "edi")}, origin)
            for rva, origin in roots
        ]
        steps = 0
        while work and steps < 500:
            eip, stack, regs, origin = work.pop(0)
            if eip in self.seen:
                # merge predecessor info only
                for blk in self.blocks:
                    if blk["start"] == eip and origin not in blk["preds"]:
                        blk["preds"].append(origin)
                continue
            self.seen.add(eip)
            steps += 1
            block_start = eip
            notes: list[str] = []
            kind = "straight"
            successors: list[int] = []
            guard = 0
            while guard < 120:
                guard += 1
                insn = one(eip)
                if insn is None:
                    kind = "leave-window"
                    break
                mnem = insn.mnemonic
                nxt = insn.address + insn.size
                com = slot_comment(insn)
                if com and mnem in ("lea", "mov", "cmp", "push", "call"):
                    notes.append(f"{mnem} {com} @ {insn.address:#x}")

                if mnem == "lea":
                    op0, op1 = insn.operands[0], insn.operands[1]
                    if op0.type == X86_OP_REG and op1.type == X86_OP_MEM:
                        target = formed(op1.mem.disp)
                        regs[insn.reg_name(op0.reg)] = target
                elif mnem == "push":
                    op = insn.operands[0]
                    if op.type == X86_OP_IMM:
                        stack.append(op.imm & 0xFFFFFFFF)
                    elif op.type == X86_OP_REG:
                        stack.append(regs.get(insn.reg_name(op.reg)))
                    else:
                        stack.append(None)
                    eip = nxt
                    continue
                elif mnem == "pop":
                    op = insn.operands[0]
                    value = stack.pop() if stack else None
                    if op.type == X86_OP_REG:
                        regs[insn.reg_name(op.reg)] = value
                    eip = nxt
                    continue
                elif mnem == "call":
                    op = insn.operands[0]
                    if op.type == X86_OP_IMM:
                        stack.append(nxt)
                        eip = op.imm
                        continue
                    callee = None
                    if op.type == X86_OP_REG:
                        callee = regs.get(insn.reg_name(op.reg))
                    elif op.type == X86_OP_MEM and insn.reg_name(op.mem.base) == "ebp":
                        callee = formed(op.mem.disp)
                    args = list(reversed(stack[-8:]))
                    self.calls.append(
                        {
                            "rva": insn.address,
                            "form": insn.op_str,
                            "callee": callee,
                            "slot": None if not isinstance(callee, int) or callee > BASE and callee < END and False else callee,
                            "args": ["-" if a is None else hex(a) for a in args],
                            "origin": origin,
                        }
                    )
                    kind = "call"
                    # stdcall cleanup for the 7-arg device recipe; local
                    # pushal units clean themselves (caller pops).
                    if op.type == X86_OP_REG and insn.reg_name(op.reg) == "eax" and len(stack) >= 7:
                        del stack[-7:]
                    regs["eax"] = None
                    successors = [nxt]
                    break
                elif mnem in ("ret", "retf"):
                    extra = insn.operands[0].imm if insn.operands else 0
                    value = stack.pop() if stack else None
                    del stack[: extra // 4]
                    if isinstance(value, int) and BASE <= value < END:
                        eip = value
                        continue
                    kind = "ret-outside" if value is not None else "ret-unknown"
                    notes.append(f"ret -> {None if value is None else hex(value)}")
                    break
                elif mnem == "jmp":
                    op = insn.operands[0]
                    if op.type == X86_OP_IMM:
                        eip = op.imm
                        continue
                    kind = "indirect-jmp"
                    notes.append(insn.op_str)
                    break
                elif mnem.startswith("j"):
                    op = insn.operands[0]
                    if op.type != X86_OP_IMM:
                        kind = "indirect-jcc"
                        break
                    target = op.imm
                    if target == nxt + 1:
                        eip = target
                        continue
                    kind = mnem
                    successors = [nxt, target]
                    notes.append(f"{mnem} fall {nxt:#x} take {target:#x}")
                    work.append((target, list(stack), dict(regs), f"{insn.address:#x}-take"))
                    work.append((nxt, list(stack), dict(regs), f"{insn.address:#x}-fall"))
                    break
                elif mnem in ("mov", "xchg"):
                    ops = insn.operands
                    if mnem == "xchg" and len(ops) == 2:
                        a, b = (insn.reg_name(o.reg) if o.type == X86_OP_REG else None for o in ops)
                        if a and b:
                            regs[a], regs[b] = regs.get(b), regs.get(a)
                    elif ops and ops[0].type == X86_OP_REG:
                        dest = insn.reg_name(ops[0].reg)
                        src = ops[1]
                        if src.type == X86_OP_REG:
                            regs[dest] = regs.get(insn.reg_name(src.reg))
                        elif src.type == X86_OP_IMM:
                            regs[dest] = src.imm & 0xFFFFFFFF
                        else:
                            regs[dest] = None
                    elif ops and ops[0].type == X86_OP_MEM and len(ops) > 1:
                        # stack-slot write: mov [esp+N], reg/imm  (gadget ret-target builder)
                        op0, op1 = ops[0], ops[1]
                        if insn.reg_name(op0.mem.base) == "esp" and stack:
                            idx = op0.mem.disp // 4
                            if 0 <= idx < len(stack):
                                if op1.type == X86_OP_REG:
                                    stack[-(idx + 1)] = regs.get(insn.reg_name(op1.reg))
                                elif op1.type == X86_OP_IMM:
                                    stack[-(idx + 1)] = op1.imm & 0xFFFFFFFF
                elif mnem in ("inc", "dec") and insn.op_str in regs and isinstance(regs[insn.op_str], int):
                    regs[insn.op_str] = (regs[insn.op_str] + (1 if mnem == "inc" else -1)) & 0xFFFFFFFF
                elif mnem == "xor" and insn.operands[0].type == X86_OP_MEM:
                    op0, op1 = insn.operands[0], insn.operands[1]
                    if (
                        insn.reg_name(op0.mem.base) == "esp"
                        and op1.type == X86_OP_IMM
                        and stack
                        and 0 <= op0.mem.disp // 4 < len(stack)
                        and isinstance(stack[-(op0.mem.disp // 4 + 1)], int)
                    ):
                        stack[-(op0.mem.disp // 4 + 1)] ^= op1.imm & 0xFFFFFFFF
                elif mnem in ("add", "sub") and insn.operands[0].type == X86_OP_MEM:
                    op0, op1 = insn.operands[0], insn.operands[1]
                    if (
                        insn.reg_name(op0.mem.base) == "esp"
                        and op1.type == X86_OP_IMM
                        and stack
                        and 0 <= op0.mem.disp // 4 < len(stack)
                        and isinstance(stack[-(op0.mem.disp // 4 + 1)], int)
                    ):
                        idx = -(op0.mem.disp // 4 + 1)
                        delta = op1.imm if mnem == "add" else -op1.imm
                        stack[idx] = (stack[idx] + delta) & 0xFFFFFFFF
                elif mnem == "mov" and insn.operands[0].type == X86_OP_MEM and len(insn.operands) > 1:
                    op0, op1 = insn.operands[0], insn.operands[1]
                    if insn.reg_name(op0.mem.base) == "esp" and op1.type == X86_OP_REG and stack:
                        idx = op0.mem.disp // 4
                        if 0 <= idx < len(stack):
                            stack[-(idx + 1)] = regs.get(insn.reg_name(op1.reg))
                    elif insn.reg_name(op0.mem.base) == "esp" and op1.type == X86_OP_IMM and stack:
                        idx = op0.mem.disp // 4
                        if 0 <= idx < len(stack):
                            stack[-(idx + 1)] = op1.imm & 0xFFFFFFFF
                elif mnem == "add" and insn.operands[0].type == X86_OP_REG and insn.operands[1].type == X86_OP_IMM:
                    dest = insn.reg_name(insn.operands[0].reg)
                    if dest in regs and isinstance(regs[dest], int):
                        regs[dest] = (regs[dest] + insn.operands[1].imm) & 0xFFFFFFFF
                elif mnem == "stosd" or mnem.startswith("lod"):
                    pass
                eip = nxt
            self.blocks.append(
                {
                    "start": block_start,
                    "end": eip if kind in ("leave-window", "indirect-jmp", "indirect-jcc") else (insn.address if insn else eip),
                    "kind": kind,
                    "successors": successors,
                    "preds": [origin],
                    "notes": notes,
                }
            )
            if kind == "call":
                nxt_addr = successors[0]
                if nxt_addr not in self.seen:
                    work.append((nxt_addr, list(stack), dict(regs), f"ret@{block_start:#x}"))

    def linear_ret(self, start: int, limit: int = 40):
        """Decode a local unit linearly (with direct jmp following) until ret."""
        out = []
        eip = start
        for _ in range(limit):
            insn = one(eip)
            if insn is None:
                out.append((eip, "<outside>", ""))
                break
            out.append((insn.address, f"{insn.mnemonic} {insn.op_str}", slot_comment(insn)))
            if insn.mnemonic == "ret":
                break
            if insn.mnemonic == "jmp" and insn.operands[0].type == X86_OP_IMM:
                eip = insn.operands[0].imm
                continue
            eip = insn.address + insn.size
        return out


# ------------------------------------------------------- registry cluster


OPEN_CALL = bytes.fromhex("ff95d10c4807")     # call dword [ebp+0x7480cd1] -> slot 0x859CE5
DATA_MOV = bytes.fromhex("8985c50c4807")      # mov [ebp+0x7480cc5],eax  -> data slot 0x859CD9


def registry_units() -> list[dict]:
    """Enumerate registry units by anchoring on the open-call byte pattern."""
    units = []
    region = blob[REG_HEAD - BASE : REG_TAIL - BASE]
    anchor = 0
    while True:
        off = region.find(OPEN_CALL, anchor)
        if off < 0:
            break
        anchor = off + 1
        open_site = REG_HEAD + off
        # unit head = the 'mov [data slot],eax' right before the two
        # lea/push pairs and push 0x80000001; optionally preceded by pushal.
        pro = blob[open_site - BASE - 0x20 : open_site - BASE]
        head = None
        pos = pro.rfind(DATA_MOV)
        if pos >= 0:
            head = open_site - 0x20 + pos
        else:
            # variant units (e.g. the Software\WLkt one) start at their first
            # lea of the hkey slot instead
            pos = pro.rfind(bytes.fromhex("8d85"))
            if pos >= 0:
                head = open_site - 0x20 + pos
                head = None if open_site - (open_site - 0x20 + pos) > 0x1A else head
        units.append({"open": open_site, "head": head})
    return units


def decode_unit(unit: dict) -> dict:
    """Decode one registry unit with a bounded BFS over its straight code.

    Follows unconditional jmps, continues past conditional branches on BOTH
    sides (collect-only; no branch is chosen), stops at ret. Records key and
    value-name strings, root/type/cb immediates, data operand form, return
    tests, and every indirect call with its slot.
    """
    out = {
        "head": unit["head"],
        "open": unit["open"],
        "key": None,
        "value": None,
        "root": None,
        "type_imm": None,
        "cb": None,
        "data_form": None,
        "tests_return": False,
        "cond_gates": [],
        "calls": [],
    }
    if unit["head"] is None:
        return out
    seen: set[int] = set()
    work = [unit["head"]]
    imm_pushes: list[int] = []
    budget = 80
    while work and budget > 0:
        eip = work.pop(0)
        for _ in range(30):
            if budget <= 0:
                break
            insn = one(eip)
            if insn is None or eip in seen:
                break
            seen.add(eip)
            budget -= 1
            mnem = insn.mnemonic
            if mnem == "ret":
                break
            if mnem == "lea":
                op0, op1 = insn.operands
                if op0.type == X86_OP_REG and op1.type == X86_OP_MEM and insn.reg_name(op1.mem.base) == "ebp":
                    target = formed(op1.mem.disp)
                    if target in STRINGS:
                        if out["key"] is None and target <= STRINGS_RVA + 0x20:
                            out["key"] = (target, STRINGS[target])
                        elif out["value"] is None:
                            out["value"] = (target, STRINGS[target])
                    elif target == 0x859CD9 and out["data_form"] is None:
                        out["data_form"] = "lea &slot (dword pointer)"
            elif mnem == "push":
                op = insn.operands[0]
                if op.type == X86_OP_IMM:
                    imm = op.imm & 0xFFFFFFFF
                    imm_pushes.append(imm)
                    if imm in (0x80000001, 0x80000002):
                        out["root"] = imm
                elif op.type == X86_OP_MEM and insn.reg_name(op.mem.base) == "ebp":
                    if formed(op.mem.disp) == 0x859CD9 and out["data_form"] is None:
                        out["data_form"] = "slot value (string pointer)"
            elif mnem in ("or", "test") and insn.op_str.replace("ptr", "").strip() == "eax, eax":
                out["tests_return"] = True
            elif mnem == "cmp" and insn.operands[0].type == X86_OP_MEM:
                op0 = insn.operands[0]
                if insn.reg_name(op0.mem.base) == "ebp" and insn.operands[1].type == X86_OP_IMM and insn.operands[1].imm == 0:
                    out["cond_gates"].append((insn.address, formed(op0.mem.disp)))
            elif mnem == "call":
                op = insn.operands[0]
                if op.type == X86_OP_MEM and insn.reg_name(op.mem.base) == "ebp":
                    out["calls"].append((insn.address, formed(op.mem.disp)))
            nxt = insn.address + insn.size
            if mnem == "jmp" and insn.operands[0].type == X86_OP_IMM:
                eip = insn.operands[0].imm
                continue
            if mnem.startswith("j") and insn.operands and insn.operands[0].type == X86_OP_IMM:
                work.append(insn.operands[0].imm)
            eip = nxt
    # derive (type, cb) from the immediate-push sequence
    if 0x19 in imm_pushes:
        out["type_imm"], out["cb"] = 1, 0x19
    elif imm_pushes.count(4) >= 2:
        out["type_imm"], out["cb"] = 4, 4
    out["calls"].sort()
    return out


def resolver_fills() -> list[dict]:
    """Decode 0x85A36E-0x85A40A: five resolver calls and their slot stores."""
    out = []
    eip = 0x85A36E
    current: dict | None = None
    for _ in range(60):
        insn = one(eip)
        if insn is None or insn.address >= 0x85A40C:
            break
        mnem = insn.mnemonic
        com = slot_comment(insn)
        if mnem == "mov" and insn.operands[0].type == X86_OP_MEM and "byte" in insn.op_str and com.startswith(f"slot {GATE_SLOT:#x}"):
            if current:
                out.append(current)
            current = {"gate_write": (insn.address, insn.operands[1].imm)}
        elif mnem == "push" and insn.operands[0].type == X86_OP_IMM and current is not None:
            current["imm"] = insn.operands[0].imm & 0xFFFFFFFF
        elif mnem == "call" and current is not None:
            current["call"] = insn.address
            current["slot"] = formed(insn.operands[0].mem.disp) if insn.operands[0].type == X86_OP_MEM else None
        elif mnem == "mov" and insn.operands[0].type == X86_OP_MEM and current is not None and "eax" in insn.op_str:
            op0 = insn.operands[0]
            if op0.mem.base and insn.reg_name(op0.mem.base) == "ebp":
                current["stores_eax_to"] = formed(op0.mem.disp)
                out.append(current)
                current = None
        if mnem == "jmp" and insn.operands[0].type == X86_OP_IMM:
            eip = insn.operands[0].imm
            continue
        eip = insn.address + insn.size
    if current:
        out.append(current)
    return out


# ---------------------------------------------------------------- output


def classify_call(rec: dict) -> tuple[str, str, str]:
    """(semantic tendency, executed-on-normal-path, confidence)."""
    rva = rec["rva"]
    slot = rec["slot"] if isinstance(rec["slot"], int) else None
    if rva in (SICE_CALL, SIWVID_CALL, NTICE_CALL):
        return "device-probe CreateFileA recipe (7 args)", "yes", "high"
    if slot == 0x859CE5:
        return "registry open-shape (root,subkey,phkey) / RegOpenKeyA family, name unresolved", "no (cluster jumped over)", "high"
    if slot == 0x81A829:
        return (
            "registry value write-shape (hkey,name,reserved=0,type,data,cb; exact type/cb per unit row) / RegSetValueExA family, name unresolved",
            "no (cluster jumped over)",
            "medium",
        )
    if slot in (0x859CE1, 0x8191E9):
        return "registry close-shape (hkey only) / RegCloseKey family, name unresolved", "no (cluster jumped over)", "medium"
    if slot == 0x81C245:
        return "resolver call (module base + name descriptor), fills registry-cluster API slots", "yes", "high"
    return "unknown / unresolved", "unknown", "low"


def classify_block(start: int, kind: str) -> tuple[str, str, str]:
    """(semantic_class, edge, confidence) by address and kind."""
    if start == 0x859A61 or 0x859A61 <= start < 0x859780:
        pass
    if start >= 0x85A3FE or (start >= 0x85A404):
        return "self-decode (in-place dword decoder loop / its tail)", "normal", "high"
    if 0x859C1B <= start <= 0x85A3F8 or kind == "call" and start >= 0x85A36E:
        return "resolver (walker gate 'R', fills registry-cluster API slots)", "normal", "high"
    if start in (0x859BD2, 0x859BF4):
        return "protector-state conditional thunk call (call ebx into cluster/thunk)", "normal-conditional", "high"
    if 0x859A0B <= start <= 0x859C17:
        return "protector-state (flag compare dispatch on slots 0x81BAB5 / 0x8191F1)", "normal", "high"
    if 0x859780 <= start <= 0x859A05:
        return "device-probe (SIWVID / NTICE CreateFileA recipe and inc/jne test)", "normal", "high"
    if 0x859A61 <= start <= 0x859B84:
        return "device-present detection edge (handle saved, walker gate 'C', internal dispatch)", "detection", "medium"
    return "unknown", "normal", "medium"


def main() -> None:
    global blob, END, STRINGS
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    args = parser.parse_args()

    digest = client_sha()
    if digest != EXPECTED_SHA:
        raise SystemExit(f"client hash changed: {digest}")
    blob = WINDOW.read_bytes()
    if len(blob) != 0xC000:
        raise SystemExit("unexpected window length")
    for site in (SICE_CALL, SIWVID_CALL, NTICE_CALL):
        if blob[site - BASE : site - BASE + 2] != bytes.fromhex("ffd0"):
            raise SystemExit(f"call eax missing at {site:#x}")
    END = BASE + len(blob)
    STRINGS = strings()

    walker = Walker()
    walker.run([(NORMAL_ROOT, "normal-root"), (DETECT_ROOT, "detection-root")])

    units = [decode_unit(u) for u in registry_units()]
    fills = resolver_fills()

    args.out.mkdir(parents=True, exist_ok=True)

    with (args.out / "probe-window-cfg.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["start_rva", "end_rva", "successors", "predecessors", "block_kind", "semantic_class", "edge", "notes", "confidence"])
        for blk in walker.blocks:
            sem, edge, conf = classify_block(blk["start"], blk["kind"])
            notes = "; ".join(blk["notes"])[:200]
            w.writerow(
                [
                    f"0x{blk['start']:08X}",
                    f"0x{blk['end']:08X}",
                    ";".join(f"0x{s:08X}" for s in blk["successors"]),
                    ";".join(blk["preds"])[:120],
                    blk["kind"],
                    sem,
                    edge,
                    notes,
                    conf,
                ]
            )
        # SICE edge (the call itself precedes the walk root; recorded statically)
        w.writerow(["0x00859757", "0x00859757", "0x00859759", "pre-stop (replay)", "call eax",
                    "device-probe (SICE CreateFileA recipe; result tested by 0x859779 inc eax / 0x85977A jne 0x859A61)",
                    "pre-normal-root", "evidence: result/softice-probe-boundary.md; window bytes ffd0", "high"])
        # registry-cluster sub-blocks (jumped over by the normal path)
        for unit in units:
            if unit["head"] is None:
                continue
            end = unit["calls"][-1][0] if unit["calls"] else unit["open"]
            entries = []
            if unit["head"] - 1 == 0x85A307 or unit["head"] in (0x85A308,):
                entries.append("call ebx @0x859BE7 (slot 0x81BAB5 != 0)")
            if unit["head"] == 0x859FF2:
                entries.append("slot 0x81AC3D <- 0x859FF1 @0x85A40A")
            w.writerow(
                [
                    f"0x{unit['head']:08X}",
                    f"0x{end:08X}",
                    "ret",
                    "; ".join(entries) or "no in-window predecessor (blind spot)",
                    "straight+ret",
                    f"registry-cluster unit: key={unit['key'][1] if unit['key'] else None} value={unit['value'][1] if unit['value'] else None} root={unit['root'] and hex(unit['root'])} type={unit['type_imm']} cb={unit['cb'] and hex(unit['cb'])} data={unit['data_form']} tests_return={unit['tests_return']} cond_gates={[hex(s) for _, s in unit['cond_gates']]}",
                    "skipped-cluster",
                    "; ".join(f"call@0x{a:X}->slot 0x{s:X}" for a, s in unit["calls"]),
                    "high",
                ]
            )
        w.writerow(["0x00859EBE", "0x00859ED6", "ret", "call ebx @0x859C07 (slot 0x8191F1 != 0)", "straight+ret",
                    "protector-state thunk: if [slot 0x81997D]!=0 then mov [[0x81997D]+0x50], eax (eax=0x40F from caller)", "skipped-cluster",
                    "not a registry unit; writes EAX into a runtime structure", "high"])
        w.writerow(["0x00859C24", "0x00859CD3", "-", "data", "data",
                    "WinLicense string table: Software\\WinLicense; Software\\WLkt; 14 value names", "data",
                    "evidence: result/winlicense-registry-cluster.md", "high"])

    with (args.out / "probe-call-sites.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "callsite_rva",
                "call_form",
                "slot_or_callee",
                "args_tracked",
                "semantic_tendency",
                "executed_on_normal_path",
                "confidence",
            ]
        )
        # SICE call: statically identical recipe, from Task 009 record + bytes
        seen_calls: set = set()
        w.writerow(
            [
                "0x00859757",
                "call eax",
                "kernel32!CreateFileA (EAX from replay stop; result/resolved-api-map.csv)",
                "lpFileName=0x00C59507 (\\.\\.SICE); access=0xC0000000 (0xBFB099AC+0x004F6654); share=3; sa=0; disp=3 (OPEN_EXISTING); flags=0x80; template=0",
                "device-probe CreateFileA recipe; tested by inc eax / jne 0x00859A61 at 0x00859779/0x0085977A",
                "pre-root (call itself already answered by replay stop)",
                "high",
            ]
        )
        for rec in walker.calls:
            key = (rec["rva"], rec["form"], tuple(rec["args"]))
            if key in seen_calls:
                continue
            seen_calls.add(key)
            sem, onpath, conf = classify_call(rec)
            if rec["rva"] in (0x859B03, 0x859B4E):
                sem = "detection-edge internal dispatch (call eax; tracked target is a Tail B slot address outside the window; unresolved)"
                onpath, conf = "no (detection edge only)", "low"
            if rec["rva"] in (0x859BE7, 0x859C07):
                sem = (
                    "conditional thunk call: 0x0085A307 pushal+CheckOUT unit"
                    if rec["rva"] == 0x859BE7
                    else "conditional thunk call: 0x00859EBE protector-state write thunk"
                )
                onpath, conf = "only when flag slot nonzero", "high"
            w.writerow(
                [
                    f"0x{rec['rva']:08X}",
                    rec["form"],
                    None if rec["callee"] is None else f"0x{rec['callee']:X}",
                    ";".join(rec["args"]),
                    sem,
                    onpath,
                    conf,
                ]
            )
        for unit in units:
            for site, slot in unit["calls"]:
                sem, onpath, conf = classify_call({"rva": site, "slot": slot})
                detail = []
                if unit["key"]:
                    detail.append(f"key={unit['key'][1]}")
                if unit["value"]:
                    detail.append(f"value={unit['value'][1]}")
                if unit["root"]:
                    detail.append(f"root={'HKCU' if unit['root'] == 0x80000001 else 'HKLM'}")
                if unit["type_imm"]:
                    detail.append(f"type={unit['type_imm']}")
                if unit["cb"]:
                    detail.append(f"cb={unit['cb']:#x}")
                if unit["data_form"]:
                    detail.append(f"data={unit['data_form']}")
                w.writerow(
                    [
                        f"0x{site:08X}",
                        "call dword [ebp+disp]",
                        f"0x{slot:08X}",
                        "; ".join(detail),
                        sem,
                        onpath,
                        conf,
                    ]
                )

    summary = {
        "blocks": len(walker.blocks),
        "walker_calls": len(walker.calls),
        "registry_units": len(units),
        "resolver_fills": [
            {
                "gate": f"0x{f.get('gate_write', (0, 0))[0]:X}='{chr(f.get('gate_write', (0, 0))[1])}'",
                "imm": f"0x{f.get('imm', 0):X}" if f.get("imm") is not None else None,
                "call": f"0x{f['call']:X}" if f.get("call") else None,
                "through_slot": f"0x{f['slot']:X}" if f.get("slot") else None,
                "stores_eax_to": f"0x{f['stores_eax_to']:X}" if f.get("stores_eax_to") else None,
            }
            for f in fills
        ],
        "unit_list": [
            {
                "head": f"0x{u['head']:X}" if u["head"] else None,
                "open": f"0x{u['open']:X}",
                "key": u["key"],
                "value": u["value"],
                "root": hex(u["root"]) if u["root"] else None,
                "type": u["type_imm"],
                "cb": hex(u["cb"]) if u["cb"] else None,
                "data_form": u["data_form"],
                "tests_return": u["tests_return"],
                "cond_gates": [(f"0x{a:X}", f"0x{s:X}") for a, s in u["cond_gates"]],
                "calls": [(f"0x{a:X}", f"0x{s:X}") for a, s in u["calls"]],
            }
            for u in units
        ],
    }
    (args.out / "probe-cfg-summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print("client", digest)
    print("blocks", len(walker.blocks), "walker calls", len(walker.calls), "units", len(units))
    print("resolver fills:")
    for f in summary["resolver_fills"]:
        print(" ", f)
    print("registry units:")
    for u in summary["unit_list"]:
        print(" ", u)
    print("walker calls:")
    for rec in walker.calls:
        print(f"  0x{rec['rva']:08X} {rec['form']} -> {rec['callee']} args {rec['args']}")


if __name__ == "__main__":
    main()
