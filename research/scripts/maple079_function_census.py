"""Task 046: promote the function census script to scripts/ as a reusable tool."""
import struct, sys, os, csv, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = 0x400000

def main(image_path, output_dir='.'):
    img = open(image_path, 'rb').read()
    os.makedirs(output_dir, exist_ok=True)
    CODE_START = 0x1000
    CODE_END = 0x7EA000

    # function census
    functions = set()
    for i in range(CODE_START, CODE_END):
        if img[i:i+3] == b'\x55\x8b\xec':
            functions.add(i)
        elif img[i:i+5] == b'\x8b\xff\x55\x8b\xec':
            functions.add(i)
    for i in range(CODE_START, CODE_END - 5):
        if img[i] == 0xE8:
            rel = struct.unpack('<i', img[i+1:i+5])[0]
            tgt = i + 5 + rel
            if CODE_START <= tgt < CODE_END:
                functions.add(tgt)
    functions = sorted(functions)

    with open(os.path.join(output_dir, 'function-census.csv'), 'w', newline='') as fo:
        w = csv.writer(fo)
        w.writerow(['rva'])
        for fn in functions:
            w.writerow([hex(fn)])
    print(f'{len(functions)} functions -> function-census.csv')

if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(description='CMS079 function census')
    p.add_argument('image', help='path to the recovered game image')
    p.add_argument('-o', '--output', default='.', help='output directory')
    args = p.parse_args()
    main(args.image, args.output)
