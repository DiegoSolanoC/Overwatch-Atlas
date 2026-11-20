import os
import json

root = os.path.expandvars(
    r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Storage\leveldb"
)
keys = [
    b"atlas.headerTitleBadge.tweak.v7",
    b"atlas.headerSides.tweak.v1",
    b"atlas.sidePanelsTrap.tweak.v2",
]
found = {k.decode(): None for k in keys}

for name in os.listdir(root):
    path = os.path.join(root, name)
    if not os.path.isfile(path):
        continue
    try:
        data = open(path, "rb").read()
    except OSError:
        continue
    for key in keys:
        idx = data.find(key)
        while idx != -1:
            start = data.find(b"{", idx)
            if start != -1 and start - idx < 80:
                depth = 0
                end = None
                for i in range(start, min(len(data), start + 200000)):
                    c = data[i]
                    if c == 0x7B:
                        depth += 1
                    elif c == 0x7D:
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                if end:
                    raw = data[start:end]
                    try:
                        obj = json.loads(raw.decode("utf-8"))
                        # Prefer longer/newer-looking payloads if multiple copies exist.
                        prev = found[key.decode()]
                        if prev is None or len(json.dumps(obj)) >= len(json.dumps(prev)):
                            found[key.decode()] = obj
                    except Exception:
                        pass
            idx = data.find(key, idx + 1)

payload = {
    "version": 1,
    "badge": found.get("atlas.headerTitleBadge.tweak.v7"),
    "sides": found.get("atlas.headerSides.tweak.v1"),
    "panels": found.get("atlas.sidePanelsTrap.tweak.v2"),
}
out = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "atlas-ui-tweaks-from-chrome.json",
)
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)

for k, v in found.items():
    print(k, "OK" if v else "MISSING", len(json.dumps(v)) if v else 0)
print("wrote", out)
