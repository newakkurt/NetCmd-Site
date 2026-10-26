#!/usr/bin/env python3
"""Yeni komut dosyası doğrulayıcı.
Kullanım: python3 -I tools/check_new.py <dosya.json> [diğer_dosyaların_klasörü]
Biçim: {"items":[{slug,cat,tr:{title,note},en:{..},ar:{..},cisco,huawei,aruba:{mode,cmds[]},juniper|null,mikrotik|null,details:{tr,en,ar}}]}"""
import json, re, sys, glob, os
LANGS = ("tr", "en", "ar")
CATS = {"Görüntüleme","Sistem","VLAN / Port","L2 Güvenlik","Routing","Yönetim ve Erişim","Yönlendirme Protokolleri","Sorun Giderme",
        "Yedeklilik ve Stack","ACL ve Filtreleme","QoS ve Trafik","Kablosuz (WLAN)","Spanning Tree ve L2","BGP ve MPLS","IPv6 ve Multicast",
        "AAA ve Kimlik Doğrulama","İzleme ve Loglama","Ağ Hizmetleri","VPN ve Tünel","Yazılım ve Yükseltme","PoE ve Fiziksel Katman","Otomasyon ve API"}
AR = re.compile(r"[؀-ۿ]")
def existing(path, extra_dir):
    s = set()
    for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "commands*.json")):
        s |= {x["slug"] for x in json.load(open(f, encoding="utf-8"))}
    if extra_dir:
        for f in glob.glob(os.path.join(extra_dir, "*.json")):
            if os.path.abspath(f) == os.path.abspath(path): continue
            try: s |= {x["slug"] for x in json.load(open(f, encoding="utf-8"))["items"]}
            except Exception: pass
    return s
def vend(e, name, req, errs, sl):
    x = e.get(name)
    if x is None:
        if req: errs.append(f"{sl}.{name} zorunlu")
        return
    if not isinstance(x, dict) or not isinstance(x.get("mode"), str) or not x["mode"].strip(): errs.append(f"{sl}.{name}.mode"); return
    c = x.get("cmds")
    if not isinstance(c, list) or not c or len(c) > 6 or not all(isinstance(i, str) and i.strip() and len(i) < 200 for i in c): errs.append(f"{sl}.{name}.cmds (1-6 komut)")
def main(path, extra_dir=None):
    d = json.load(open(path, encoding="utf-8")); errs = []
    ex = existing(path, extra_dir); seen = set()
    for e in d["items"]:
        sl = e.get("slug", "?")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", sl): errs.append(f"{sl}: slug ascii-kebab olmalı")
        if sl in ex or sl in seen: errs.append(f"{sl}: slug çakışıyor")
        seen.add(sl)
        if e.get("cat") not in CATS: errs.append(f"{sl}: cat geçersiz: {e.get('cat')}")
        for l in LANGS:
            t = e.get(l) or {}
            if not (isinstance(t.get("title"), str) and 4 <= len(t["title"]) <= 90): errs.append(f"{sl}.{l}.title")
            if not (isinstance(t.get("note"), str) and 20 <= len(t["note"]) <= 300): errs.append(f"{sl}.{l}.note 20-300")
        if not AR.search(e.get("ar", {}).get("title", "")): errs.append(f"{sl}: ar.title Arapça değil")
        if AR.search(e.get("tr", {}).get("title", "") + e.get("en", {}).get("title", "")): errs.append(f"{sl}: tr/en içinde Arapça")
        for v in ("cisco", "huawei", "aruba"): vend(e, v, True, errs, sl)
        for v in ("juniper", "mikrotik"): vend(e, v, False, errs, sl)
        det = e.get("details", {})
        for l in LANGS:
            t = det.get(l)
            if not t: errs.append(f"{sl}.details.{l} eksik"); continue
            ps = t.get("params")
            if not isinstance(ps, list) or not (1 <= len(ps) <= 6): errs.append(f"{sl}.{l}.params 1-6")
            else:
                for p in ps:
                    if not (isinstance(p.get("p"), str) and p["p"].strip() and isinstance(p.get("d"), str) and len(p["d"]) >= 8): errs.append(f"{sl}.{l}.params öğesi")
            x = t.get("example")
            if not isinstance(x, str) or not (40 <= len(x) <= 600): errs.append(f"{sl}.{l}.example 40-600")
            m = t.get("mistakes")
            if not isinstance(m, list) or not (2 <= len(m) <= 4) or not all(isinstance(i, str) and len(i) >= 15 for i in m): errs.append(f"{sl}.{l}.mistakes 2-4")
        if AR.search(det.get("tr", {}).get("example", "")): errs.append(f"{sl}: tr.example içinde Arapça")
        if not AR.search(det.get("ar", {}).get("example", "x")): errs.append(f"{sl}: ar.example Arapça değil")
    print("\n".join(errs[:60]) if errs else f"OK: {len(d['items'])} komut")
    sys.exit(1 if errs else 0)
main(*sys.argv[1:3])
