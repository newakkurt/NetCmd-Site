#!/usr/bin/env python3
"""data/enrich_*.json doğrulayıcı. Kullanım: python3 -I tools/check_enrich.py data/enrich_1.json [giriş.json]"""
import json, re, sys
LANGS = ("tr", "en", "ar")
def main(path, src=None):
    d = json.load(open(path, encoding="utf-8"))
    errs = []
    want = [x["slug"] for x in json.load(open(src, encoding="utf-8"))] if src else list(d)
    for sl in want:
        if sl not in d:
            errs.append(f"{sl}: eksik"); continue
        e = d[sl]
        for v in ("juniper", "mikrotik"):
            if e.get(v) is None: continue
            x = e[v]
            if not isinstance(x.get("mode"), str) or not x["mode"].strip(): errs.append(f"{sl}.{v}.mode")
            if not isinstance(x.get("cmds"), list) or not x["cmds"] or not all(isinstance(c, str) and c.strip() for c in x["cmds"]):
                errs.append(f"{sl}.{v}.cmds")
        det = e.get("details", {})
        for l in LANGS:
            t = det.get(l)
            if not t: errs.append(f"{sl}.details.{l} eksik"); continue
            ps = t.get("params")
            if not isinstance(ps, list) or not (1 <= len(ps) <= 6): errs.append(f"{sl}.{l}.params 1-6 olmalı")
            else:
                for p in ps:
                    if not (isinstance(p.get("p"), str) and p["p"].strip() and isinstance(p.get("d"), str) and len(p["d"]) >= 8): errs.append(f"{sl}.{l}.params öğesi")
            ex = t.get("example")
            if not isinstance(ex, str) or not (40 <= len(ex) <= 600): errs.append(f"{sl}.{l}.example uzunluk 40-600")
            ms = t.get("mistakes")
            if not isinstance(ms, list) or not (2 <= len(ms) <= 4) or not all(isinstance(m, str) and len(m) >= 15 for m in ms): errs.append(f"{sl}.{l}.mistakes 2-4 öğe")
        if l == "ar":
            pass
        if re.search(r"[؀-ۿ]", det.get("tr", {}).get("example", "")): errs.append(f"{sl}: tr içinde Arapça")
        if not re.search(r"[؀-ۿ]", det.get("ar", {}).get("example", "x")): errs.append(f"{sl}: ar içinde Arapça yok")
    extra = [k for k in d if k not in want]
    if extra: errs.append(f"fazla slug: {extra}")
    print("\n".join(errs) if errs else f"OK: {len(want)} komut")
    sys.exit(1 if errs else 0)
main(*sys.argv[1:3])
