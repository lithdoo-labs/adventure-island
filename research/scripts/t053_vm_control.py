"""Windows-native QEMU control (replaces container t025-vm.sh for Task 053).
Monitor over TCP: sendkey / screendump / info / loadvm / savevm / pmemsave.
Usage: python t053-vm.py <cmd> [args]
Commands: mon 'text' | key <key> | type <text> | shot <name> | launch | alive
"""
import socket, subprocess, sys, io, os, time, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

QEMU = r'E:\qemu\qemu-system-i386.exe'
VMDIR = r'E:\vm-store\task-024-vm'
QCOW = os.path.join(VMDIR, 'win7x86.qcow2')
MON_PORT = 45454
SHOTS = r'.work\task-053\shots'
os.makedirs(SHOTS, exist_ok=True)

def mon(cmd, wait=0.3):
    s = socket.socket()
    s.settimeout(5)
    try:
        s.connect(('127.0.0.1', MON_PORT))
        time.sleep(0.1)
        try:
            s.recv(4096)
        except Exception:
            pass
        s.sendall((cmd + '\n').encode())
        time.sleep(wait)
        out = b''
        try:
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    break
                out += chunk
                if len(chunk) < 4096:
                    break
        except socket.timeout:
            pass
        return out.decode('utf-8', 'replace')
    finally:
        s.close()

KEYMAP = {' ': 'spc', '.': 'dot', ',': 'comma', '-': 'minus', '_': 'shift-minus',
          '/': 'slash', ';': 'semicolon', ':': 'shift-semicolon', "'": 'apostrophe',
          '=': 'equal', '[': 'bracket_left', ']': 'bracket_right',
          '\t': 'tab', '\n': 'ret', '\b': 'backspace'}

def send_text(text, delay=0.12):
    for ch in text:
        if ch.islower() or ch.isdigit():
            key = ch
        elif ch.isupper():
            key = 'shift-' + ch.lower()
        else:
            key = KEYMAP.get(ch)
        if key:
            mon(f'sendkey {key}', 0.15)
            time.sleep(delay)
        else:
            print('NOKEY:', repr(ch))

def launch(extra=()):
    if os.path.exists(os.path.join(VMDIR, 'qemu-w32.pid')):
        try:
            os.kill(int(open(os.path.join(VMDIR, 'qemu-w32.pid')).read().strip()), 0)
            print('already running')
            return
        except Exception:
            pass
    iso = r'E:\vm-store\raw\cn_windows_7_professional_with_sp1_x86_dvd_622569.iso'
    cmd = [QEMU, '-name', 'win7x86', '-machine', 'pc,accel=tcg', '-m', '2048',
           '-smp', '2', '-cpu', 'coreduo',
           '-drive', f'file={QCOW},if=ide,index=0,media=disk,format=qcow2',
           '-boot', 'order=c', '-nic', 'user',
           '-vga', 'std', '-display', 'none', '-usb', '-device', 'usb-tablet',
           '-monitor', f'tcp:127.0.0.1:{MON_PORT},server,nowait',
           '-serial', f'file:{VMDIR}\\serial-w32.log',
           '-pidfile', f'{VMDIR}\\qemu-w32.pid', '-daemonize'] + list(extra)
    r = subprocess.run(cmd, capture_output=True, text=True)
    print('launch rc=', r.returncode, r.stderr[:200])

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'mon':
        print(mon(sys.argv[2]))
    elif cmd == 'key':
        mon(f'sendkey {sys.argv[2]}')
    elif cmd == 'type':
        send_text(sys.argv[2])
    elif cmd == 'shot':
        mon(f'screendump "{SHOTS}\\{sys.argv[2]}.ppm"', 1.2)
        p = os.path.join(SHOTS, sys.argv[2] + '.ppm')
        print('shot:', p, os.path.getsize(p) if os.path.exists(p) else 'MISSING')
    elif cmd == 'launch':
        launch()
    elif cmd == 'alive':
        print(mon('info status'))
    elif cmd == 'dump':
        # full-memory ELF dump (036-lineage authorized capture)
        out = sys.argv[2] if len(sys.argv) > 2 else r'.work\task-053\captures\t053-mem.elf'
        os.makedirs(os.path.dirname(out), exist_ok=True)
        print(mon(f'dump-guest-memory "{out}"', 5.0))
        time.sleep(10)
        print('dump size:', os.path.getsize(out) if os.path.exists(out) else 'MISSING')
