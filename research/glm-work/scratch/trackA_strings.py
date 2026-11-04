import json

d = json.load(open("glm-work/result/wizet-dll-inventory.json", encoding="utf-8"))
for info in d:
    for s in info.get("strings", []):
        refs = ";".join(f"{r}@{f}" for r, f in s["refs"][:4])
        print(f"{info['dll']:<14} {s['string'][:44]:<46} rva {s['rva']:<9} refs[{len(s['refs'])}] {refs}")
