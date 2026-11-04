# MapleStory CMS079 V5 packet codec.
# Algorithm source: result/protocol-crypto.md and result/protocol-handshake.md
# (server classes MapleAESOFB, MapleCustomEncryption, BitTools, LoginPacket.getHello).
"""Parse the V5 15-byte handshake and encrypt/decrypt one game packet."""

from __future__ import annotations

import argparse
import hashlib
import sys

from Crypto.Cipher import AES

AES_KEY = bytes((
    0x13, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0xB4, 0x00, 0x00, 0x00,
    0x1B, 0x00, 0x00, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x33, 0x00, 0x00, 0x00, 0x52, 0x00, 0x00, 0x00,
))
FUNNY_BYTES = bytes.fromhex("ec3f77a445d071bfb79820fc4be9b3e15c22f70c441b81bd638dd4c3f21019e0fba16e66eaaed6ce06184eeb7895dbbab6427a2a830b54676de865e72f07f3aa277b85b026fd8ba9fabea8d7cbcc92daf993602dddd2a29b395f82214c69f83187ee8ead8c6abcb56b5913f10400f65a3579488f15cd9757123e37ff9d4f51f5a370bb1475c2b872c0ed7d68c92e0d624617114d6cc47e53c125c79a1c88582c89dc026440015d38a5e2af55d5ef1a7ca75ba66f869f73e60ade2b994a479cdf09769e300ee4b294a03b341d280f36e323b403d890c83cfe5e3224501f3a438a964174ac5233f0d92980b116d3ab91b9847f611ecfc5d1563dcaf405c6e50849")
IV_SEED = bytes((0xF2, 0x53, 0x50, 0xC6))
HANDSHAKE_PREFIX = bytes.fromhex("0D004F00000046727A")

# Stored version words after MapleAESOFB's byte swap.
# C->S is checked by the server recv cipher, constructed with version 79.
# S->C is produced by the server send cipher, constructed with version -80.
VERSION_C2S = 0x4F00
VERSION_S2C = 0xB0FF


def parse_hex(text: str) -> bytes:
    cleaned = "".join(text.split())
    if cleaned.startswith("0x"):
        cleaned = cleaned[2:]
    if len(cleaned) % 2:
        raise ValueError("hex length must be even")
    return bytes.fromhex(cleaned)


def roll_left(value: int, count: int) -> int:
    tmp = value & 0xFF
    tmp = (tmp << (count % 8)) & 0xFFFFFFFF
    return ((tmp & 0xFF) | ((tmp >> 8) & 0xFF)) & 0xFF


def roll_right(value: int, count: int) -> int:
    tmp = value & 0xFF
    tmp = ((tmp << 8) & 0xFFFFFFFF) >> (count % 8)
    return ((tmp & 0xFF) | ((tmp >> 8) & 0xFF)) & 0xFF


def custom_encrypt(data: bytes) -> bytes:
    buf = bytearray(data)
    for round_index in range(6):
        remember = 0
        data_length = len(buf) & 0xFF
        if round_index % 2 == 0:
            for index in range(len(buf)):
                cur = roll_left(buf[index], 3)
                cur = (cur + data_length) & 0xFF
                cur ^= remember
                remember = cur
                cur = roll_right(cur, data_length)
                cur = (~cur) & 0xFF
                cur = (cur + 72) & 0xFF
                data_length = (data_length - 1) & 0xFF
                buf[index] = cur
        else:
            for index in range(len(buf) - 1, -1, -1):
                cur = roll_left(buf[index], 4)
                cur = (cur + data_length) & 0xFF
                cur ^= remember
                remember = cur
                cur ^= 0x13
                cur = roll_right(cur, 3)
                data_length = (data_length - 1) & 0xFF
                buf[index] = cur
    return bytes(buf)


def custom_decrypt(data: bytes) -> bytes:
    buf = bytearray(data)
    for round_index in range(1, 7):
        remember = 0
        data_length = len(buf) & 0xFF
        if round_index % 2 == 0:
            for index in range(len(buf)):
                cur = (buf[index] - 72) & 0xFF
                cur = (~cur) & 0xFF
                cur = roll_left(cur, data_length)
                next_remember = cur
                cur ^= remember
                remember = next_remember
                cur = (cur - data_length) & 0xFF
                buf[index] = roll_right(cur, 3)
                data_length = (data_length - 1) & 0xFF
        else:
            for index in range(len(buf) - 1, -1, -1):
                cur = roll_left(buf[index], 3)
                cur ^= 0x13
                next_remember = cur
                cur ^= remember
                remember = next_remember
                cur = (cur - data_length) & 0xFF
                buf[index] = roll_right(cur, 4)
                data_length = (data_length - 1) & 0xFF
    return bytes(buf)


def funny_shit(input_byte: int, block: bytearray) -> None:
    elina = block[1]
    anna = input_byte & 0xFF
    moritz = FUNNY_BYTES[elina]
    moritz = (moritz - anna) & 0xFF
    block[0] = (block[0] + moritz) & 0xFF
    moritz = block[2] ^ FUNNY_BYTES[anna]
    elina = (elina - moritz) & 0xFF
    block[1] = elina
    original_b3 = block[3]
    elina = (original_b3 - block[0]) & 0xFF
    moritz = (FUNNY_BYTES[original_b3] + anna) & 0xFF
    block[2] = moritz ^ block[2]
    block[3] = (elina + FUNNY_BYTES[anna]) & 0xFF
    merry = (
        block[0]
        | (block[1] << 8)
        | (block[2] << 16)
        | (block[3] << 24)
    ) & 0xFFFFFFFF
    rotated = ((merry >> 29) | ((merry << 3) & 0xFFFFFFFF)) & 0xFFFFFFFF
    block[0] = rotated & 0xFF
    block[1] = (rotated >> 8) & 0xFF
    block[2] = (rotated >> 16) & 0xFF
    block[3] = (rotated >> 24) & 0xFF


def update_iv(old_iv: bytes) -> bytes:
    if len(old_iv) != 4:
        raise ValueError("IV must be 4 bytes")
    block = bytearray(IV_SEED)
    for value in old_iv:
        funny_shit(value, block)
    return bytes(block)


def aes_block(block16: bytes) -> bytes:
    if len(block16) != 16:
        raise ValueError("AES block must be 16 bytes")
    # Cipher.getInstance("AES") is AES/ECB/PKCS5Padding. doFinal on a full
    # block appends another padding block; MapleAESOFB keeps only the first 16.
    return AES.new(AES_KEY, AES.MODE_ECB).encrypt(block16)


def version_word(direction: str) -> int:
    if direction == "c2s":
        return VERSION_C2S
    if direction == "s2c":
        return VERSION_S2C
    raise ValueError("direction must be c2s or s2c")


def get_packet_header(iv: bytes, length: int, direction: str) -> bytes:
    stored = version_word(direction)
    iiv = ((iv[3] & 0xFF) | ((iv[2] << 8) & 0xFF00)) ^ (stored & 0xFFFF)
    iiv &= 0xFFFF
    swapped = ((length << 8) & 0xFF00) | ((length >> 8) & 0xFF)
    mixed = swapped ^ iiv
    return bytes((
        (iiv >> 8) & 0xFF,
        iiv & 0xFF,
        (mixed >> 8) & 0xFF,
        mixed & 0xFF,
    ))


def get_packet_length(header: bytes) -> int:
    if len(header) != 4:
        raise ValueError("header must be 4 bytes")
    packet_header = int.from_bytes(header, "big")
    mixed = ((packet_header >> 16) ^ (packet_header & 0xFFFF)) & 0xFFFF
    return ((mixed << 8) & 0xFF00) | ((mixed >> 8) & 0xFF)


def check_header(header: bytes, iv: bytes, direction: str) -> bool:
    stored = version_word(direction)
    return (
        ((header[0] ^ iv[2]) & 0xFF) == ((stored >> 8) & 0xFF)
        and ((header[1] ^ iv[3]) & 0xFF) == (stored & 0xFF)
    )


def crypt(data: bytes, iv: bytes) -> tuple[bytes, bytes]:
    """AES keystream XOR. Same function for both directions. Returns (data, next_iv).

    Matches the JAR's MapleAESOFB.crypt, not the CFR for-loop shape. The first
    chunk limit is 1456 and every later chunk limit is 1460. Remaining is reduced
    by the number of bytes just processed; the limit is raised to 1460 only after
    that subtraction. Subtracting 1460 first skips 4 bytes per chunk.
    """
    buf = bytearray(data)
    llength = 1456
    start = 0
    remaining = len(buf)
    while remaining > 0:
        my_iv = bytearray(iv[index % 4] for index in range(16))
        chunk = llength if remaining >= llength else remaining
        for offset in range(chunk):
            if offset % 16 == 0:
                my_iv = bytearray(aes_block(bytes(my_iv)))
            buf[start + offset] ^= my_iv[offset % 16]
        start += chunk
        remaining -= chunk
        llength = 1460
    return bytes(buf), update_iv(iv)


def encrypt_packet(plain: bytes, iv: bytes, direction: str) -> tuple[bytes, bytes]:
    header = get_packet_header(iv, len(plain), direction)
    body, next_iv = crypt(custom_encrypt(plain), iv)
    return header + body, next_iv


def decrypt_packet(packet: bytes, iv: bytes, direction: str) -> dict:
    if len(packet) < 4:
        raise ValueError("packet shorter than header")
    header = packet[:4]
    if not check_header(header, iv, direction):
        raise ValueError("header does not match IV and version")
    length = get_packet_length(header)
    if length < 2 or len(packet) < 4 + length:
        raise ValueError(f"need {length} body bytes, have {max(0, len(packet) - 4)}")
    body = packet[4:4 + length]
    transformed, next_iv = crypt(body, iv)
    plain = custom_decrypt(transformed)
    opcode = int.from_bytes(plain[:2], "little")
    return {
        "header": header.hex(),
        "body_length": length,
        "opcode_hex": f"0x{opcode:04X}",
        "opcode_dec": opcode,
        "plaintext_hex": plain.hex(),
        "next_iv": next_iv.hex(),
    }


def find_handshake(stream: bytes) -> int:
    return stream.find(HANDSHAKE_PREFIX)


def parse_handshake(blob: bytes) -> dict:
    index = find_handshake(blob)
    if index < 0 or len(blob) < index + 15:
        raise ValueError("handshake prefix not found or truncated")
    packet = blob[index:index + 15]
    version = int.from_bytes(packet[2:4], "little")
    locale = packet[14]
    return {
        "offset": index,
        "packet_hex": packet.hex(),
        "version": version,
        "locale": locale,
        "client_send_iv": packet[6:10].hex(),
        "client_recv_iv": packet[10:14].hex(),
    }


def format_result(result: dict) -> str:
    return "\n".join([
        f"header {result['header']}",
        f"body_length {result['body_length']}",
        f"opcode_hex {result['opcode_hex']}",
        f"opcode_dec {result['opcode_dec']}",
        f"plaintext_hex {result['plaintext_hex']}",
        f"next_iv {result['next_iv']}",
    ])


def selftest() -> None:
    # JAR cross-check anchor. Lengths above 1456 used to drop 4 bytes per chunk.
    iv = bytes.fromhex("46727a11")
    short = bytes.fromhex("01000474657374")
    packet, next_iv = encrypt_packet(short, iv, "c2s")
    if packet.hex() != "35113211a28736ed5837d6" or next_iv.hex() != "71b25f7f":
        raise AssertionError("short packet no longer matches the JAR")
    expected_body = {
        1456: "cd723434f09b589193695c108c0f4d68c0d0a691076206a4ca26922a93510532",
        1457: "0f48ec178bfdcca41d8d28a9f640b28a9445ebf3673ff8f3d47917163f0f0a67",
        1460: "0d9033c7b4130fedc8e6e7ef5ba80de181fdf675b8abd98db3642cd5d1783cda",
        3000: "829bda5707b631d3f0ea3d317d5f7015211293dee3f4e294796d0000e8c40cd6",
    }
    for length, digest in expected_body.items():
        plain = bytes(index & 0xFF for index in range(length))
        body, _ = crypt(custom_encrypt(plain), iv)
        if hashlib.sha256(body).hexdigest() != digest:
            raise AssertionError(f"JAR body mismatch at {length}")
    sample = bytes.fromhex("0D004F00000046727A115230787A04")
    parsed = parse_handshake(sample)
    if parsed["version"] != 79 or parsed["locale"] != 4:
        raise AssertionError(parsed)
    if parsed["client_send_iv"] != "46727a11" or parsed["client_recv_iv"] != "5230787a":
        raise AssertionError(parsed)
    if len(update_iv(bytes.fromhex("46727a11"))) != 4:
        raise AssertionError("IV update length")
    for direction, iv_hex in (("c2s", parsed["client_send_iv"]), ("s2c", parsed["client_recv_iv"])):
        iv = bytes.fromhex(iv_hex)
        for plain in (
            bytes.fromhex("01000474657374000474657374aabbccddeeff"),
            bytes(index & 0xFF for index in range(1500)),
            bytes(index & 0xFF for index in range(3000)),
        ):
            packet, next_iv = encrypt_packet(plain, iv, direction)
            if len(next_iv) != 4:
                raise AssertionError("next iv")
            if get_packet_length(packet[:4]) != len(plain):
                raise AssertionError("length roundtrip")
            decoded = decrypt_packet(packet, iv, direction)
            if bytes.fromhex(decoded["plaintext_hex"]) != plain:
                raise AssertionError(f"roundtrip failed {direction} {len(plain)}")
            if decoded["next_iv"] != next_iv.hex():
                raise AssertionError("iv mismatch")
    print("selftest ok")
    print(f"handshake version {parsed['version']} locale {parsed['locale']}")
    print(f"client_send_iv {parsed['client_send_iv']}")
    print(f"client_recv_iv {parsed['client_recv_iv']}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="CMS079 V5 packet codec")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("selftest")
    handshake = sub.add_parser("handshake")
    handshake.add_argument("hex")
    decrypt = sub.add_parser("decrypt")
    decrypt.add_argument("--direction", choices=("c2s", "s2c"), required=True)
    decrypt.add_argument("--iv", required=True)
    decrypt.add_argument("--packet", required=True)
    encrypt = sub.add_parser("encrypt")
    encrypt.add_argument("--direction", choices=("c2s", "s2c"), required=True)
    encrypt.add_argument("--iv", required=True)
    encrypt.add_argument("--plain", required=True)
    args = parser.parse_args(argv)
    if args.cmd == "selftest":
        selftest()
        return 0
    if args.cmd == "handshake":
        parsed = parse_handshake(parse_hex(args.hex))
        print(f"version {parsed['version']}")
        print(f"locale {parsed['locale']}")
        print(f"client_send_iv {parsed['client_send_iv']}")
        print(f"client_recv_iv {parsed['client_recv_iv']}")
        print(f"packet_hex {parsed['packet_hex']}")
        return 0
    if args.cmd == "decrypt":
        print(format_result(decrypt_packet(parse_hex(args.packet), parse_hex(args.iv), args.direction)))
        return 0
    packet, next_iv = encrypt_packet(parse_hex(args.plain), parse_hex(args.iv), args.direction)
    print(f"packet_hex {packet.hex()}")
    print(f"next_iv {next_iv.hex()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as exc:
        print(f"error {exc}", file=sys.stderr)
        raise SystemExit(1)
