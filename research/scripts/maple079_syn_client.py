"""CMS079 synthetic client (loopback-only) — full protocol chain.

Task 033 edition. Derives ONLY from the local server implementation (JAR
bytecode + live loopback exchanges). Never from protected client code.

Proven chain (see result/task033-protocol-chain.md):
  login 9555: hello(server-first) -> LOGIN_PASSWORD(0x01) ->
    SERVERLIST(0x02) -> CHARLIST(0x09, bb+int) -> CHAR_SELECT(0x0A, int)
    -> SERVER_IP redirect {ip, port, charid} -> CLOSE the login socket
  channel 7575: hello(same format) -> PLAYER_LOGGEDIN(0x0B, int+8B)
    -> 18-packet in-channel burst (charinfo/inventory/skills/...)

Authoritative c2s opcode values (server dispatch, Task 033 live probe):
  0x00 PONG, 0x01 LOGIN_PASSWORD, 0x02 SERVERLIST_REQUEST,
  0x03 LICENSE_REQUEST, 0x04 SET_GENDER, 0x05 SERVERSTATUS_REQUEST,
  0x09 CHARLIST_REQUEST, 0x0A CHAR_SELECT, 0x0B PLAYER_LOGGEDIN,
  0x0C CHECK_CHAR_NAME, 0x11 CREATE_CHAR, 0x12 DELETE_CHAR
(NOTE: this build RENUMBERS the odinms-standard values — anti-bot measure.)

Wire format (Task 032 live matrix):
  server-first 15B hello: 0D 00 4F 00 00 00 <iv1:4> <iv2:4> 04
  client encrypts c2s with word 0x4F00 + iv=hello[6:10]
  client decrypts s2c with word 0xB0FF + iv=hello[10:14]
  body = MapleCustomEncryption.shuffle(AES-OFB(plain)); IVs roll per packet.
"""
from __future__ import annotations

import argparse
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maple079_packet as _mp
from maple079_packet import encrypt_packet, decrypt_packet, get_packet_length

# keep the module codec untouched; pin the empirically proven words here
VERSION_WORD_C2S = 0x4F00
VERSION_WORD_S2C = 0xB0FF
_orig_version_word = _mp.version_word
_mp.version_word = lambda direction: (
    VERSION_WORD_C2S if direction == "c2s" else
    VERSION_WORD_S2C if direction == "s2c" else
    _orig_version_word(direction))

C2S = {"PONG": 0x0000, "LOGIN_PASSWORD": 0x0001, "SERVERLIST_REQUEST": 0x0002,
       "LICENSE_REQUEST": 0x0003, "SET_GENDER": 0x0004,
       "SERVERSTATUS_REQUEST": 0x0005, "CHARLIST_REQUEST": 0x0009,
       "CHAR_SELECT": 0x000A, "PLAYER_LOGGEDIN": 0x000B,
       "CHECK_CHAR_NAME": 0x000C, "CREATE_CHAR": 0x0011,
       "DELETE_CHAR": 0x0012}
# s2c values observed live (this build renumbers s2c too)
S2C = {0x0000: "LOGIN_ACCOUNT_INFO", 0x0001: "LOGIN_STATUS",
       0x0005: "SERVERSTATUS", 0x0009: "SERVERLIST", 0x000A: "CHARLIST",
       0x000B: "SERVER_IP_REDIRECT", 0x0041: "SERVERMESSAGE",
       0x0081: "CHARINFO", 0x00A2: "INVENTORY", 0x016F: "SKILLS"}


def maple_str(text: str) -> bytes:
    raw = text.encode("ascii")
    return len(raw).to_bytes(2, "little") + raw


class Session:
    """One encrypted CMS079 socket session (server-first hello)."""

    def __init__(self, port: int, host: str = "127.0.0.1"):
        self.sock = socket.create_connection((host, port), timeout=6)
        self.sock.settimeout(6.0)
        hello = b""
        while len(hello) < 15:
            chunk = self.sock.recv(64)
            if not chunk:
                raise ConnectionError("no server hello")
            hello += chunk
        self.hello = hello
        self.version = int.from_bytes(hello[2:4], "little")
        self.c2s_iv = hello[6:10]     # client encrypts with this (proven)
        self.s2c_iv = hello[10:14]    # client decrypts with this (proven)

    def send(self, plain: bytes):
        pkt, self.c2s_iv = encrypt_packet(plain, self.c2s_iv, "c2s")
        self.sock.sendall(pkt)

    def drain(self, seconds: float = 3.0):
        replies, buf = [], b""
        deadline = time.time() + seconds
        while time.time() < deadline:
            try:
                chunk = self.sock.recv(4096)
            except OSError:
                break
            if not chunk:
                break
            buf += chunk
            while len(buf) >= 4:
                try:
                    need = 4 + get_packet_length(buf[:4])
                except Exception:
                    break
                if len(buf) < need:
                    break
                try:
                    res = decrypt_packet(buf[:need], self.s2c_iv, "s2c")
                    replies.append(res)
                    self.s2c_iv = bytes.fromhex(res["next_iv"])
                except Exception:
                    pass
                buf = buf[need:]
            time.sleep(0.05)
        return replies

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def parse_redirect(plaintext_hex: str):
    """SERVER_IP redirect body: ..(2) ip(4) port(2) charid(4) flag(1) key(4)."""
    b = bytes.fromhex(plaintext_hex)
    ip = ".".join(str(x) for x in b[4:8])
    port = int.from_bytes(b[8:10], "little")
    charid = int.from_bytes(b[10:14], "little")
    return ip, port, charid


def run_chain(user: str, password: str, charid: int, log=print):
    """The full proven chain: login leg -> redirect -> channel entry."""
    transcript = []

    ls = Session(9555)
    log(f"[login] hello {ls.hello.hex()} (version {ls.version})")
    ls.send(C2S["LOGIN_PASSWORD"].to_bytes(2, "little")
            + maple_str(user) + maple_str(password) + bytes(6))
    for r in ls.drain(3.0):
        nm = S2C.get(r.get("opcode_dec"), r.get("opcode_hex"))
        transcript.append(("login/s2c", nm, r.get("plaintext_hex", "")[:120]))
        log(f"[login] <- {nm} len={r.get('body_length')}")
    ls.send(C2S["SERVERLIST_REQUEST"].to_bytes(2, "little"))
    for r in ls.drain(2.0):
        nm = S2C.get(r.get("opcode_dec"), r.get("opcode_hex"))
        transcript.append(("login/s2c", nm, r.get("plaintext_hex", "")[:120]))
    ls.send(C2S["CHARLIST_REQUEST"].to_bytes(2, "little")
            + bytes([0, 0]) + (0).to_bytes(4, "little"))
    for r in ls.drain(2.5):
        nm = S2C.get(r.get("opcode_dec"), r.get("opcode_hex"))
        transcript.append(("login/s2c", nm, r.get("plaintext_hex", "")[:120]))
        log(f"[login] <- {nm} len={r.get('body_length')}")
    ls.send(C2S["CHAR_SELECT"].to_bytes(2, "little")
            + charid.to_bytes(4, "little"))
    redirect = None
    for r in ls.drain(3.5):
        if r.get("opcode_dec") == 0x000B:
            redirect = r
    if redirect is None:
        log("[login] no redirect — aborting channel leg")
        ls.close()
        return transcript, None
    ip, port, rid = parse_redirect(redirect["plaintext_hex"])
    log(f"[login] redirect: ip={ip} port={port} charid={rid}")
    transcript.append(("redirect", ip, port, rid))

    # CRITICAL (proven Task 033): the real client closes the login socket
    # after the redirect; the login server's session-close resets the
    # account state, which the channel's Loggedin check REQUIRES.
    ls.close()
    time.sleep(1.5)

    cs = Session(port, ip)
    log(f"[channel] hello {cs.hello.hex()}")
    cs.send(C2S["PLAYER_LOGGEDIN"].to_bytes(2, "little")
            + rid.to_bytes(4, "little") + bytes(8))
    burst = cs.drain(10.0)
    log(f"[channel] in-channel burst: {len(burst)} packets")
    for r in burst:
        nm = S2C.get(r.get("opcode_dec"), r.get("opcode_hex"))
        transcript.append(("channel/s2c", nm, r.get("plaintext_hex", "")[:120]))
    cs.close()
    return transcript, burst


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="CMS079 synthetic client (loopback only)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--user", default="fl1234")
    p.add_argument("--pass", dest="password", default="123456")
    p.add_argument("--charid", type=int, default=25)
    p.add_argument("--transcript", default="syn-transcript.txt")
    p.add_argument("--login-only", action="store_true",
                   help="stop after the login leg (no channel entry)")
    args = p.parse_args(argv)

    if args.login_only:
        ls = Session(9555, args.host)
        print(f"[login] hello {ls.hello.hex()}")
        ls.send(C2S["LOGIN_PASSWORD"].to_bytes(2, "little")
                + maple_str(args.user) + maple_str(args.password) + bytes(6))
        for r in ls.drain(4.0):
            nm = S2C.get(r.get("opcode_dec"), r.get("opcode_hex"))
            print(f"[login] <- {nm} len={r.get('body_length')} "
                  f"{r.get('plaintext_hex', '')[:80]}")
        ls.close()
        return 0

    transcript, burst = run_chain(args.user, args.password, args.charid)
    Path(args.transcript).write_text(
        "\n".join(str(t) for t in transcript), encoding="utf-8")
    print(f"[syn] transcript ({len(transcript)} entries) -> {args.transcript}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
