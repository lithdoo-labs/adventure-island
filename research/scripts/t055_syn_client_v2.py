"""Synthetic client v2.3 — same as v2.2 but with longer drain + raw dump."""
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
    total_raw = b''
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            c = sock.recv(65536)
        except OSError:
            break
        if not c:
            break
        total_raw += c
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
                out.append({'err': str(e), 'raw': buf[:need].hex()})
            buf = buf[need:]
        time.sleep(0.1)
    return out, s2c_iv, buf, total_raw

def show(replies):
    for r in replies:
        if 'opcode_dec' in r:
            op = r['opcode_dec']
            pt_hex = r.get('plaintext_hex', '')
            pt = bytes.fromhex(pt_hex) if pt_hex else b''
            name = S2C.get(op, f'op{op:04X}')
            print(f'  < {name:26s} ({op:#06x}) len={len(pt):3d} {pt_hex[:48]}')
        else:
            print(f'  < ERR: {str(r.get("err","?"))[:60]}')

s = socket.create_connection(('127.0.0.1', 9555), timeout=10)
hello = b''
while len(hello) < 15:
    c = s.recv(64)
    if not c: break
    hello += c
c2s_iv, s2c_iv = hello[6:10], hello[10:14]
print('hello', hello.hex())

def send(plain, label):
    global c2s_iv
    pkt, c2s_iv = encrypt_packet(plain, c2s_iv, 'c2s')
    s.sendall(pkt)
    print(f'  > {label}')

# 1) login — LONG drain
send(C2S['LOGIN_PASSWORD'].to_bytes(2, 'little') + mstr('fl1234') + mstr('123456') + bytes(6),
     'LOGIN_PASSWORD')
r, s2c_iv, _, raw = drain(s, s2c_iv, 8.0)
print(f'  [raw received: {len(raw)} bytes]')
show(r)

# 2) serverlist
send(C2S['SERVERLIST_REQUEST'].to_bytes(2, 'little'), 'SERVERLIST_REQUEST')
r, s2c_iv, _, _ = drain(s, s2c_iv, 4.0)
show(r)

# 3) charlist
send(C2S['CHARLIST_REQUEST'].to_bytes(2, 'little') + bytes([0, 0]) + (0).to_bytes(4, 'little'),
     'CHARLIST_REQUEST')
r, s2c_iv, _, raw_cl = drain(s, s2c_iv, 6.0)
print(f'  [charlist raw: {len(raw_cl)} bytes]')
show(r)

# 4) char select
send(C2S['CHAR_SELECT'].to_bytes(2, 'little') + struct.pack('<i', 25) + bytes([0, 1]),
     'CHAR_SELECT(id=25)')
r, s2c_iv, _, raw_cs = drain(s, s2c_iv, 8.0)
print(f'  [charselect raw: {len(raw_cs)} bytes, unprocessed buf: {len(s2c_iv)} iv]')
show(r)

# parse redirect from SERVER_IP
redirect = None
for res in r:
    op = res.get('opcode_dec')
    pt_hex = res.get('plaintext_hex', '')
    pt = bytes.fromhex(pt_hex) if pt_hex else b''
    if op == 0x0B and len(pt) >= 12:
        body = pt[2:]  # strip opcode: padding(2) + ip(4) + port(2) + chardata...
        ip = '.'.join(str(b) for b in body[2:6])
        port = struct.unpack('<H', body[6:8])[0]
        redirect = (ip, port)
        print(f'  >>> REDIRECT: {ip}:{port}')
        print(f'  raw: {pt_hex[:80]}')

if redirect:
    s.close()
    host = '127.0.0.1' if redirect[0] in ('127.0.0.1', '0.0.0.0') else redirect[0]
    print(f'\n=== CHANNEL {host}:{redirect[1]} ===')
    s2 = socket.create_connection((host, redirect[1]), timeout=10)
    hello2 = b''
    while len(hello2) < 15:
        c = s2.recv(64)
        if not c: break
        hello2 += c
    c2s_iv2, s2c_iv2 = hello2[6:10], hello2[10:14]
    print('channel hello', hello2.hex())

    def send2(plain, label):
        global c2s_iv2
        pkt, c2s_iv2 = encrypt_packet(plain, c2s_iv2, 'c2s')
        s2.sendall(pkt)
        print(f'  > {label}')

    send2(C2S['PLAYER_LOGGEDIN'].to_bytes(2, 'little') + struct.pack('<i', 25),
          'PLAYER_LOGGEDIN(25)')
    r2, s2c_iv2, _, raw_g = drain(s2, s2c_iv2, 8.0)
    print(f'  [game raw: {len(raw_g)} bytes]')
    show(r2)

    print('\n=== GAME LOOP ===')
    game_packets = []
    for i in range(10):
        r3, s2c_iv2, _, _ = drain(s2, s2c_iv2, 5.0)
        for res in r3:
            show([res])
            game_packets.append(res)
        if not r3:
            send2(C2S['PONG'].to_bytes(2, 'little') + bytes(4), 'PONG')

    print(f'\ntotal game packets: {len(game_packets)}')
    from collections import Counter
    for op, cnt in Counter(r.get('opcode_dec', 0) for r in game_packets).most_common(20):
        print(f'  {S2C.get(op, "?"):30s} ({op:#06x}) x{cnt}')

    s2.close()
else:
    print('\n(no redirect parsed)')
    for i in range(2):
        r4, s2c_iv, _, _ = drain(s, s2c_iv, 4.0)
        show(r4)
        if not r4:
            send(C2S['PONG'].to_bytes(2, 'little') + bytes(4), 'PONG')
    s.close()

print('\n=== DONE ===')
