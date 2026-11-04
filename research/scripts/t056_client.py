"""Task 056: Synthetic client v3 — with game actions (move, chat, emotion).
Based on the working v2 flow, adds:
- MOVE_PLAYER: slea.skip(33) + movement data
- FACE_EXPRESSION: readInt() = emotion ID
- GENERAL_CHAT: readMapleAsciiString() + readByte()
"""
import socket, struct, sys, io, time, os, subprocess, csv
sys.path.insert(0, 'scripts')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from maple079_packet import encrypt_packet, decrypt_packet, get_packet_length

MBIN = os.path.abspath('.work/task-002/server/079V5/mysql/MySQL/bin')
subprocess.run([os.path.join(MBIN, 'mysql.exe'), '-uroot', '-proot', '-e',
               'UPDATE `079v5`.accounts SET loggedin = 0, banned = 0;'],
               capture_output=True, timeout=15)

C2S = {r['name']: int(r['opcode']) for r in
       csv.DictReader(open(r'.work\task-055\c2s-opcodes-from-properties.csv', encoding='utf-8'))}
S2C = {int(r['opcode']): r['name'] for r in
       csv.DictReader(open(r'.work\task-055\s2c-opcodes-from-properties.csv', encoding='utf-8'))}

def mstr(s):
    b = s.encode('ascii') if isinstance(s, str) else s
    return len(b).to_bytes(2, 'little') + b

def drain(sock, s2c_iv, seconds):
    out = []
    buf = b''
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            c = sock.recv(65536)
        except OSError:
            break
        if not c:
            break
        buf += c
        while len(buf) >= 4:
            try:
                need = 4 + get_packet_length(buf[:4])
            except Exception:
                break
            if len(buf) < need:
                break
            try:
                res = decrypt_packet(buf[:need], s2c_iv, 's2c')
                out.append(res)
                s2c_iv = bytes.fromhex(res['next_iv'])
            except Exception as e:
                out.append({'err': str(e)})
            buf = buf[need:]
        time.sleep(0.05)
    return out, s2c_iv, buf

def show(replies, filter_ops=None):
    for r in replies:
        if 'opcode_dec' in r:
            op = r['opcode_dec']
            if filter_ops and op not in filter_ops:
                continue
            pt_hex = r.get('plaintext_hex', '')
            name = S2C.get(op, f'op{op:04X}')
            print(f'  < {name:26s} ({op:#06x}) len={len(pt_hex)//2:3d} {pt_hex[:40]}')

CHAR_ID = 25

# ===== LOGIN FLOW (from working v2) =====
s = socket.create_connection(('127.0.0.1', 9555), timeout=10)
hello = b''
while len(hello) < 15:
    c = s.recv(64)
    if not c: break
    hello += c
c2s_iv, s2c_iv = hello[6:10], hello[10:14]

def send(plain, label):
    global c2s_iv
    pkt, c2s_iv = encrypt_packet(plain, c2s_iv, 'c2s')
    s.sendall(pkt)
    print(f'  > {label}')

send(C2S['LOGIN_PASSWORD'].to_bytes(2, 'little') + mstr('fl1234') + mstr('123456') + bytes(6),
     'LOGIN_PASSWORD')
r, s2c_iv, _ = drain(s, s2c_iv, 5)

send(C2S['CHARLIST_REQUEST'].to_bytes(2, 'little') + bytes([0, 0]) + (0).to_bytes(4, 'little'),
     'CHARLIST')
r, s2c_iv, _ = drain(s, s2c_iv, 4)

send(C2S['CHAR_SELECT'].to_bytes(2, 'little') + struct.pack('<i', CHAR_ID) + bytes([0, 1]),
     f'CHAR_SELECT(id={CHAR_ID})')
r, s2c_iv, _ = drain(s, s2c_iv, 6)

# parse redirect
redirect = None
for res in r:
    if res.get('opcode_dec') == 0x0B:
        pt = bytes.fromhex(res.get('plaintext_hex', ''))
        if len(pt) >= 12:
            body = pt[2:]
            ip = '.'.join(str(b) for b in body[2:6])
            port = struct.unpack('<H', body[6:8])[0]
            redirect = (ip, port)

s.close()
if not redirect:
    print('NO REDIRECT — aborting')
    sys.exit(1)

# ===== CHANNEL =====
host = '127.0.0.1' if redirect[0] in ('127.0.0.1', '0.0.0.0') else redirect[0]
s = socket.create_connection((host, redirect[1]), timeout=10)
hello = b''
while len(hello) < 15:
    c = s.recv(64)
    if not c: break
    hello += c
c2s_iv, s2c_iv = hello[6:10], hello[10:14]

def send(plain, label):
    global c2s_iv
    pkt, c2s_iv = encrypt_packet(plain, c2s_iv, 'c2s')
    s.sendall(pkt)
    print(f'  > {label}')

send(C2S['PLAYER_LOGGEDIN'].to_bytes(2, 'little') + struct.pack('<i', CHAR_ID),
     f'PLAYER_LOGGEDIN({CHAR_ID})')
r, s2c_iv, _ = drain(s, s2c_iv, 8)
print(f'[initial game data: {len(r)} packets]')
show(r)

# ===== GAME ACTIONS =====
print('\n=== ACTION 1: FACE_EXPRESSION ===')
# FACE_EXPRESSION = readInt() = emotion id (1-7 = basic emotes)
send(C2S['FACE_EXPRESSION'].to_bytes(2, 'little') + struct.pack('<i', 1),
     'FACE_EXPRESSION(emote=1)')
r, s2c_iv, _ = drain(s, s2c_iv, 4)
show(r)

print('\n=== ACTION 2: GENERAL_CHAT ===')
# GENERAL_CHAT = readMapleAsciiString() + readByte()
send(C2S['GENERAL_CHAT'].to_bytes(2, 'little') + mstr('Hello from synthetic client!') + bytes([0]),
     'GENERAL_CHAT("Hello from synthetic client!")')
r, s2c_iv, _ = drain(s, s2c_iv, 4)
show(r)

print('\n=== ACTION 3: MOVE_PLAYER ===')
# MOVE_PLAYER: slea.skip(33) then movement data, then 13-26 bytes trailing
# Simplest valid movement: skip 33 bytes of position/state + minimal movement + 13 trailing
# Movement format: count(byte) + entries(type+x+y+...)
move_body = bytes(33)  # skip 33
move_body += bytes([1])  # 1 movement entry
move_body += bytes([0x0B])  # type 11 = absolute position
move_body += struct.pack('<hh', 100, 100)  # x=100, y=100
move_body += struct.pack('<hh', 0, 0)  # vx, vy
move_body += struct.pack('<H', 0)  # unknown
move_body += bytes(13)  # 13 trailing bytes
send(C2S['MOVE_PLAYER'].to_bytes(2, 'little') + move_body,
     'MOVE_PLAYER(x=100,y=100)')
r, s2c_iv, _ = drain(s, s2c_iv, 4)
show(r)

print('\n=== ACTION 4: PONG (keepalive) ===')
send(C2S['PONG'].to_bytes(2, 'little') + bytes(4), 'PONG')
r, s2c_iv, _ = drain(s, s2c_iv, 3)
show(r)

# ===== FINAL: count all packets received =====
print('\n=== SUSTAINED GAME LOOP (10 rounds) ===')
all_packets = []
for i in range(10):
    r, s2c_iv, _ = drain(s, s2c_iv, 4)
    all_packets.extend(r)
    if r:
        show(r)
    else:
        send(C2S['PONG'].to_bytes(2, 'little') + bytes(4), f'PONG({i})')

print(f'\n=== SUMMARY ===')
print(f'total packets in game session: {len(all_packets)}')
from collections import Counter
for op, cnt in Counter(r.get('opcode_dec', 0) for r in all_packets).most_common(20):
    print(f'  {S2C.get(op, "?"):30s} ({op:#06x}) x{cnt}')

s.close()
print('\n=== DONE ===')
