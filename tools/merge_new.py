#!/usr/bin/env python3
"""Ajan çıktılarını (new_*.json) data/ altındaki üç dosyaya birleştirir.
Kullanım: python3 -I tools/merge_new.py <kaynak_klasör>
Üretir: data/commands_new.json, data/i18n_new.json, data/enrich_new.json (her çalıştırmada baştan yazılır)."""
import json, glob, os, sys
src = sys.argv[1]
CATS = {
 "QoS ve Trafik": ("QoS & Traffic", "جودة الخدمة وحركة المرور"),
 "Kablosuz (WLAN)": ("Wireless (WLAN)", "الشبكات اللاسلكية (WLAN)"),
 "Spanning Tree ve L2": ("STP & Layer 2", "STP والطبقة الثانية"),
 "BGP ve MPLS": ("BGP & MPLS", "BGP وMPLS"),
 "IPv6 ve Multicast": ("IPv6 & Multicast", "IPv6 والبث المتعدد"),
 "AAA ve Kimlik Doğrulama": ("AAA & Authentication", "AAA والمصادقة"),
 "İzleme ve Loglama": ("Monitoring & Logging", "المراقبة والسجلات"),
 "Ağ Hizmetleri": ("Network Services", "خدمات الشبكة"),
 "VPN ve Tünel": ("VPN & Tunnels", "VPN والأنفاق"),
 "Yazılım ve Yükseltme": ("Firmware & Upgrade", "البرمجيات والترقية"),
 "PoE ve Fiziksel Katman": ("PoE & Physical Layer", "PoE والطبقة الفيزيائية"),
 "Otomasyon ve API": ("Automation & API", "الأتمتة وواجهات API"),
}
base, i18n, enr, seen = [], {}, {}, set()
for f in sorted(glob.glob(os.path.join(src, "new_*.json"))):
    for e in json.load(open(f, encoding="utf-8"))["items"]:
        if e["slug"] in seen: continue
        seen.add(e["slug"])
        base.append({"slug": e["slug"], "title": e["tr"]["title"], "cat": e["cat"], "note": e["tr"]["note"],
                     "cisco": e["cisco"], "huawei": e["huawei"], "aruba": e["aruba"]})
        i18n[e["slug"]] = {"en": e["en"], "ar": e["ar"]}
        enr[e["slug"]] = {"juniper": e.get("juniper"), "mikrotik": e.get("mikrotik"), "details": e["details"]}
cats = {k: {"en": v[0], "ar": v[1]} for k, v in CATS.items()}
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
def w(n, o): json.dump(o, open(os.path.join(D, n), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
w("commands_new.json", base); w("i18n_new.json", {"cats": cats, "items": i18n}); w("enrich_new.json", enr)
print(len(base), "komut birleştirildi")
