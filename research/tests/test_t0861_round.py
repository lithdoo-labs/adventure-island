"""T086.1 round guards: evidence canonicalization (cross-platform hashes),
G08 avatar-key radix/formula regression, G17 ExternalCodeTableGetter
relative-form resolution regression."""
import hashlib
import os
import re
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "research" / "scripts"))
from evidence_canonical import canonical_bytes, canonical_sha256, is_text_bytes  # noqa: E402

JAR = REPO / ".work/task-063/server079.jar"
JAR_SHA = "49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360"


class CanonicalizationTests(unittest.TestCase):
    """T086.1 evidence canonical rule: text = CRLF->LF, binary = raw."""

    def test_lf_text_unchanged(self):
        raw = b"# header\nline2\nline3\n"
        self.assertEqual(canonical_bytes(raw), raw)

    def test_crlf_text_normalized_to_lf(self):
        raw = b"# header\r\nline2\r\nline3"
        self.assertEqual(canonical_bytes(raw), b"# header\nline2\nline3")
        # canonical hash equals the LF-variant hash (platform independence)
        lf = b"# header\nline2\nline3"
        self.assertEqual(hashlib.sha256(canonical_bytes(raw)).hexdigest(),
                         hashlib.sha256(lf).hexdigest())

    def test_bom_preserved(self):
        raw = b"\xef\xbb\xbf# header\r\nline2\r\n"
        self.assertEqual(canonical_bytes(raw), b"\xef\xbb\xbf# header\nline2\n")

    def test_trailing_newline_matters(self):
        # a missing/extra trailing newline is a CONTENT difference
        a = canonical_bytes(b"x\r\n")
        b = canonical_bytes(b"x\r\n\r\n")
        self.assertNotEqual(hashlib.sha256(a).hexdigest(), hashlib.sha256(b).hexdigest())
        c = canonical_bytes(b"x")  # no trailing newline
        self.assertNotEqual(hashlib.sha256(a).hexdigest(), hashlib.sha256(c).hexdigest())

    def test_lone_cr_is_content(self):
        # a lone CR (old-Mac) is NOT normalized
        raw = b"a\rb\n"
        self.assertEqual(canonical_bytes(raw), raw)

    def test_binary_not_normalized(self):
        # binary data containing 0D 0A pairs must keep them (EXE/DLL evidence)
        raw = b"\x00\x01\x0d\x0a\xff\x0d\x0a\x00"
        self.assertTrue(not is_text_bytes(raw))
        self.assertEqual(canonical_bytes(raw), raw)

    def test_utf16_treated_as_binary(self):
        raw = "# t\r\n".encode("utf-16-le")
        self.assertTrue(not is_text_bytes(raw))
        self.assertEqual(canonical_bytes(raw), raw)

    def test_canonical_sha256_matches_blob_equivalent(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "ev.txt"
            p.write_bytes(b"line1\r\nline2\r\n")
            self.assertEqual(canonical_sha256(p),
                             hashlib.sha256(b"line1\nline2\n").hexdigest())


class G08RadixTests(unittest.TestCase):
    """T086.1 WP0: the insertion-key base is 2^30 (0x40000000), not 2^31."""

    @staticmethod
    def key(layer, group, flag):
        return ((10 * (3000 * layer - group) - 0x40000000 + 29990 + 2 + (5 if flag else 0))
                & 0xFFFFFFFF)

    @staticmethod
    def as_i32(x):
        return x - (1 << 32) if x >= (1 << 31) else x

    def test_radix_identity(self):
        self.assertEqual(0x40000000, 1 << 30)
        self.assertNotEqual(0x40000000, 1 << 31)
        self.assertEqual(-0x40000000, -(2 ** 30))
        self.assertEqual(-0x40000000, -1073741824)

    def test_task_anchor_values(self):
        self.assertEqual(self.as_i32(self.key(0, 0, 0)), -1073711832)
        self.assertEqual(self.as_i32(self.key(0, 0, 1)), -1073711827)

    def test_disp32_encoding(self):
        # lea eax, [eax + edx*2 - 0x3FFF8ADA]; bytes 8d 84 50 26 75 00 c0
        disp = int.from_bytes(bytes.fromhex("267500c0"), "little", signed=True)
        self.assertEqual(disp, -0x3FFF8ADA)
        self.assertEqual(0x40000000 - 0x3FFF8ADA, 29990)  # base decomposes as -2^30 + 29990

    def test_negative_group_and_layers(self):
        self.assertEqual(self.as_i32(self.key(0, -5, 0)), -1073711832 + 50)
        self.assertEqual(self.as_i32(self.key(1, 0, 0)), -1073711832 + 30000)
        self.assertEqual(self.as_i32(self.key(149, 0, 0)), -1073711832 + 149 * 30000)
        self.assertEqual(self.as_i32(self.key(7, 500, 1)),
                         -2 ** 30 + 29997 + 10 * (7 * 3000 - 500))

    def test_i32_wraparound(self):
        # extreme layer wraps modulo 2^32 in the machine; formula mirrors it
        for layer in (35792, 100000, 250000):
            k = self.key(layer, 0, 0)
            self.assertTrue(0 <= k <= 0xFFFFFFFF)
        # mirror: straight python int for the unwrapped value, then i32-cast
        unwrapped = 10 * 3000 * 35792 - 2 ** 30 + 29992
        self.assertEqual(self.as_i32(self.key(35792, 0, 0)), self.as_i32(unwrapped & 0xFFFFFFFF))

    def test_key_minus_one_band(self):
        # 0x93E7F2-family applies dec (key-1) BEFORE the PUT wrapper
        self.assertEqual(self.as_i32(self.key(0, 0, 0)), -2 ** 30 + 29992)
        self.assertEqual(self.as_i32((self.key(0, 0, 0) - 1) & 0xFFFFFFFF), -2 ** 30 + 29991)
        self.assertEqual(self.as_i32((self.key(0, 0, 1) - 1) & 0xFFFFFFFF), -2 ** 30 + 29996)

    def test_tile_obj_bases_share_the_2p30_base(self):
        # C-001 tile / C-002 obj decimal baselines are -(2^30 - B)
        self.assertEqual(-(2 ** 30 - 19990), -1073721834)  # tile
        self.assertEqual(-(2 ** 30 - 2000), -1073739824)   # obj
        # the avatar band sits on the same base
        self.assertEqual(self.as_i32(self.key(0, 0, 0)), -(2 ** 30 - 29992))

    def test_ledger_radix_regression(self):
        # the authoritative G08/C-099 texts must not reintroduce "-2^31"
        for f in ("research/source-of-truth/gaps.csv", "research/source-of-truth/claims.csv"):
            txt = (REPO / f).read_text(encoding="utf-8")
            for m in re.finditer(r"2\^31", txt):
                ctx = txt[max(0, m.start() - 120):m.end() + 120]
                self.assertIn("T086", ctx, f"{f}: uncorrected 2^31 radix outside audit-history context")


PROP_RE = re.compile(r"^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$")


def parse_props(text):
    out = {}
    for line in text.splitlines():
        m = PROP_RE.match(line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def bytecode_getvalue(props, name, enum, def_=-2, depth=0):
    """Bytecode-faithful ExternalCodeTableGetter.getValue emulation."""
    if depth > 8:
        raise ValueError("depth")
    prop = props.get(name)
    if prop is None or len(prop) == 0:
        return def_
    args = prop.strip().split(" ")
    base = 0
    if len(args) == 2:
        if args[0] not in enum:
            raise KeyError(f"relative base {args[0]!r} not an enum constant (NPE in bytecode)")
        base = enum[args[0]]
        if base == def_:
            base = bytecode_getvalue(props, args[0], enum, def_, depth + 1)
        tok = args[1]
    else:
        tok = args[0]
    if len(tok) > 2 and tok[:2].lower() == "0x":
        return (int(tok[2:], 16) + base) & 0xFFFF
    return (int(tok) + base) & 0xFFFF


@unittest.skipUnless(JAR.exists(), "server079.jar not present on this machine")
class G17DojoResolutionTests(unittest.TestCase):
    """T086.1 WP1: DOJO_WARP_UP resolves to 0x00D1 via the shipped bytecode."""

    @classmethod
    def setUpClass(cls):
        import hashlib as _h
        assert _h.sha256(JAR.read_bytes()).hexdigest() == JAR_SHA
        with zipfile.ZipFile(JAR) as z:
            cls.send = parse_props(z.read("sendops.properties").decode("utf-8", "replace"))
            cls.recv = parse_props(z.read("recvops.properties").decode("utf-8", "replace"))

    def test_exactly_one_relative_line_and_base_present(self):
        rel = {k: v for k, v in self.send.items() if len(v.split(" ")) == 2}
        self.assertEqual(rel, {"DOJO_WARP_UP": "SHOW_ITEM_GAIN_INCHAT 1"})
        self.assertEqual(self.send.get("SHOW_ITEM_GAIN_INCHAT"), "0xD0")

    def test_dojo_resolves_0xd1_in_declaration_order(self):
        # send enum order verified by javap: SHOW_ITEM_GAIN_INCHAT(38) < DOJO_WARP_UP(39)
        enum = {"SHOW_ITEM_GAIN_INCHAT": 0xD0}          # populated first
        self.assertEqual(bytecode_getvalue(self.send, "DOJO_WARP_UP", enum), 0xD1)

    def test_dojo_resolves_0xd1_via_def_recursion(self):
        # even out of order: base still -2 (== def) triggers recursive resolve
        enum = {"SHOW_ITEM_GAIN_INCHAT": -2, "DOJO_WARP_UP": -2}
        self.assertEqual(bytecode_getvalue(self.send, "DOJO_WARP_UP", enum), 0xD1)

    def test_unknown_relative_base_raises(self):
        props = dict(self.send)
        props["X_TEST"] = "NOT_AN_ENUM_CONSTANT 1"
        with self.assertRaises(KeyError):
            bytecode_getvalue(props, "X_TEST", {})

    def test_corrupt_line_annotation_withdrawn(self):
        # the withdrawn reviewer annotation must not live as C-095's verdict
        claims = (REPO / "research/source-of-truth/claims.csv").read_text(encoding="utf-8")
        c95 = next(line for line in claims.splitlines() if line.startswith("C-095,"))
        self.assertIn("WITHDRAWN", c95)
        self.assertIn("0x00D1", c95)
        self.assertNotIn("is corrupt under the ExternalCodeTableGetter rule", c95)


if __name__ == "__main__":
    unittest.main()
