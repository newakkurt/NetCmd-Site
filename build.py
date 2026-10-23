#!/usr/bin/env python3
"""
NetCmd static site generator (Python stdlib only, zero dependency).

Üretir:
  - index.html
  - /komut/<slug>/        : tek komut, 3 vendor yan yana
  - /<src>-<dst>/<slug>/  : "Cisco X komutunun Huawei karşılığı" (6 yön x N komut)
  - /kategori/<cat>/      : kategori listeleri
  - sitemap.xml, robots.txt, 404.html, .nojekyll

Ortam değişkenleri:
  BASE_URL          Tam site adresi (örn. https://kullanici.github.io/netcmd-site)
  ADSENSE_CLIENT    ca-pub-XXXXXXXXXXXXXXXX (boşsa reklam kodu eklenmez)
  SITE_NAME         Site adı (varsayılan: NetCmd)
"""
import html
import json
import logging
import os
import re
import shutil
import sys
from datetime import date
from itertools import permutations
from pathlib import Path
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("build")

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "commands.json"
OUT = ROOT / "dist"

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
BASE_PATH = urlparse(BASE_URL).path.rstrip("/")  # GitHub Pages project site: /repo
ADSENSE = os.environ.get("ADSENSE_CLIENT", "").strip()
SITE = os.environ.get("SITE_NAME", "NetCmd")
TODAY = date.today().isoformat()

VENDORS = {
    "cisco": {"name": "Cisco", "os": "IOS / IOS-XE"},
    "huawei": {"name": "Huawei", "os": "VRP"},
    "aruba": {"name": "Aruba", "os": "AOS-S / AOS-CX"},
}

CSS = """
:root{--bg:#fff;--fg:#14202b;--mut:#5b6b7a;--bd:#dde4ea;--ac:#0b6bcb;--code:#0f1b26;--codefg:#d7e6f5;--card:#f6f9fc}
@media(prefers-color-scheme:dark){:root{--bg:#0e141a;--fg:#e4ecf3;--mut:#93a4b4;--bd:#243240;--ac:#5aa8ff;--code:#070b0f;--codefg:#d7e6f5;--card:#131c25}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--ac)}header,main,footer{max-width:980px;margin:0 auto;padding:0 16px}
header{display:flex;justify-content:space-between;align-items:center;padding-top:14px;padding-bottom:14px;border-bottom:1px solid var(--bd)}
header a.logo{font-weight:700;font-size:1.2rem;text-decoration:none;color:var(--fg)}header nav a{margin-left:14px;text-decoration:none}
h1{font-size:1.7rem;line-height:1.25;margin:1.2rem 0 .4rem}h2{font-size:1.2rem;margin:1.6rem 0 .5rem}
.crumbs{font-size:.85rem;color:var(--mut);margin-top:12px}.lead{color:var(--mut)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px 14px}.card a{font-weight:600;text-decoration:none}
.vend{border:1px solid var(--bd);border-radius:10px;margin:12px 0;overflow:hidden}
.vend h3{margin:0;padding:8px 14px;background:var(--card);font-size:1rem;display:flex;justify-content:space-between}
.vend h3 small{color:var(--mut);font-weight:400}
pre{margin:0;padding:12px 14px;background:var(--code);color:var(--codefg);overflow-x:auto;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid var(--bd);padding:8px 10px;text-align:left;vertical-align:top;font-size:.93rem}th{background:var(--card)}
td code{font:13px ui-monospace,Menlo,Consolas,monospace}
.note{border-left:4px solid var(--ac);background:var(--card);padding:10px 14px;border-radius:0 8px 8px 0;margin:14px 0}
.tag{display:inline-block;font-size:.75rem;border:1px solid var(--bd);border-radius:99px;padding:0 8px;color:var(--mut)}
.ad{margin:18px 0;min-height:90px}footer{padding:24px 16px 40px;color:var(--mut);font-size:.85rem;border-top:1px solid var(--bd);margin-top:32px}
"""


def esc(s):
    return html.escape(str(s), quote=True)


def slugify(s):
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    s = s.translate(tr).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def url(path):
    """Site içi mutlak yol (BASE_PATH dahil)."""
    return f"{BASE_PATH}/{path.lstrip('/')}" if path else f"{BASE_PATH}/"


def full(path):
    return f"{BASE_URL}/{path.lstrip('/')}"


def code_block(cmds):
    return "<pre><code>" + esc("\n".join(cmds)) + "</code></pre>"


def ad_slot():
    return '<div class="ad" aria-hidden="true"></div>' if ADSENSE else ""


def page(title, desc, path, body, jsonld=None):
    canonical = full(path)
    ads = (
        f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={esc(ADSENSE)}" crossorigin="anonymous"></script>'
        if ADSENSE
        else ""
    )
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ""
    return f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="article"><meta property="og:url" content="{esc(canonical)}">
<style>{CSS}</style>{ads}{ld}</head><body>
<header><a class="logo" href="{url('')}">{esc(SITE)}</a>
<nav><a href="{url('')}">Tüm komutlar</a></nav></header>
<main>{body}</main>
<footer>{esc(SITE)} · Komutlar yazılım sürümüne göre değişebilir; üretimde uygulamadan önce lab ortamında doğrulayın.
Son güncelleme: {TODAY}</footer></body></html>"""


def write(path, content):
    p = OUT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def load():
    try:
        items = json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        log.error("Veri okunamadı: %s", e)
        sys.exit(1)
    seen = set()
    for it in items:
        for k in ("slug", "title", "cat", "note", *VENDORS):
            if k not in it:
                log.error("Eksik alan %s: %s", k, it.get("slug"))
                sys.exit(1)
        for v in VENDORS:
            if not it[v].get("cmds"):
                log.error("Boş komut: %s/%s", it["slug"], v)
                sys.exit(1)
        if it["slug"] in seen:
            log.error("Tekrarlı slug: %s", it["slug"])
            sys.exit(1)
        seen.add(it["slug"])
    return items


def related(items, cur, n=6):
    same = [i for i in items if i["cat"] == cur["cat"] and i["slug"] != cur["slug"]]
    rest = [i for i in items if i["cat"] != cur["cat"]]
    return (same + rest)[:n]


def build_command(it, items, urls):
    path = f"komut/{it['slug']}/"
    vend_html = ""
    rows = ""
    for v, meta in VENDORS.items():
        d = it[v]
        vend_html += (
            f'<div class="vend"><h3>{meta["name"]} <small>{esc(meta["os"])} · {esc(d["mode"])}</small></h3>'
            f"{code_block(d['cmds'])}</div>"
        )
        rows += f"<tr><th>{meta['name']}</th><td><code>{esc(' ; '.join(d['cmds']))}</code></td><td>{esc(d['mode'])}</td></tr>"
    pair_links = " · ".join(
        f'<a href="{url_(f"{a}-{b}/{it["slug"]}/")}">{VENDORS[a]["name"]} → {VENDORS[b]["name"]}</a>'
        for a, b in permutations(VENDORS, 2)
    )
    rel = "".join(
        f'<div class="card"><a href="{url_("komut/" + r["slug"] + "/")}">{esc(r["title"])}</a></div>' for r in related(items, it)
    )
    title = f"{it['title']}: Cisco, Huawei ve Aruba Komutları"
    desc = f"{it['title']} için Cisco {it['cisco']['cmds'][0]}, Huawei {it['huawei']['cmds'][0]} ve Aruba {it['aruba']['cmds'][0]} komutlarının karşılaştırması."
    body = f"""<div class="crumbs"><a href="{url('')}">Ana sayfa</a> › <a href="{url_('kategori/' + slugify(it['cat']) + '/')}">{esc(it['cat'])}</a></div>
<h1>{esc(it['title'])}: Cisco / Huawei / Aruba</h1>
<p class="lead"><span class="tag">{esc(it['cat'])}</span> Üç platformda aynı işin komut karşılıkları.</p>
{ad_slot()}{vend_html}
<h2>Karşılaştırma tablosu</h2>
<table><tr><th>Vendor</th><th>Komut</th><th>Mod</th></tr>{rows}</table>
<div class="note"><strong>Not:</strong> {esc(it['note'])}</div>
<h2>Vendor çevirisi</h2><p>{pair_links}</p>
<h2>İlgili komutlar</h2><div class="grid">{rel}</div>"""
    ld = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": title,
        "description": desc,
        "inLanguage": "tr",
        "dateModified": TODAY,
    }
    write(path + "index.html", page(title, desc, path, body, ld))
    urls.append(path)


def build_pair(it, a, b, items, urls):
    path = f"{a}-{b}/{it['slug']}/"
    A, B = VENDORS[a], VENDORS[b]
    da, db = it[a], it[b]
    title = f"{A['name']} {da['cmds'][0]} Komutunun {B['name']} Karşılığı"
    desc = f"{A['name']} {A['os']} üzerindeki '{da['cmds'][0]}' komutunun {B['name']} {B['os']} karşılığı: {db['cmds'][0]}."
    body = f"""<div class="crumbs"><a href="{url('')}">Ana sayfa</a> › <a href="{url_('komut/' + it['slug'] + '/')}">{esc(it['title'])}</a></div>
<h1>{esc(title)}</h1>
<p class="lead">{esc(it['title'])} işlemi için {A['name']} komutunun {B['name']} tarafındaki eşdeğeri.</p>
{ad_slot()}
<div class="vend"><h3>{A['name']} <small>{esc(A['os'])} · {esc(da['mode'])}</small></h3>{code_block(da['cmds'])}</div>
<div class="vend"><h3>{B['name']} <small>{esc(B['os'])} · {esc(db['mode'])}</small></h3>{code_block(db['cmds'])}</div>
<div class="note"><strong>Dikkat:</strong> {esc(it['note'])}</div>
<p>Üç vendor'ın tamamını görmek için: <a href="{url_('komut/' + it['slug'] + '/')}">{esc(it['title'])}</a></p>"""
    ld = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": title,
        "description": desc,
        "inLanguage": "tr",
        "dateModified": TODAY,
    }
    write(path + "index.html", page(title, desc, path, body, ld))
    urls.append(path)


def build_categories(items, urls):
    cats = {}
    for it in items:
        cats.setdefault(it["cat"], []).append(it)
    for cat, lst in cats.items():
        path = f"kategori/{slugify(cat)}/"
        cards = "".join(
            f'<div class="card"><a href="{url_("komut/" + i["slug"] + "/")}">{esc(i["title"])}</a>'
            f'<br><small>{esc(i["cisco"]["cmds"][0])} · {esc(i["huawei"]["cmds"][0])}</small></div>'
            for i in lst
        )
        title = f"{cat} Komutları: Cisco, Huawei, Aruba"
        desc = f"{cat} kategorisindeki {len(lst)} ağ komutunun Cisco, Huawei ve Aruba karşılıkları."
        body = f'<h1>{esc(cat)} komutları</h1><p class="lead">{len(lst)} komut.</p>{ad_slot()}<div class="grid">{cards}</div>'
        write(path + "index.html", page(title, desc, path, body))
        urls.append(path)
    return cats


def build_index(items, cats, urls):
    cat_links = " ".join(f'<a class="tag" href="{url_("kategori/" + slugify(c) + "/")}">{esc(c)} ({len(l)})</a>' for c, l in cats.items())
    cards = "".join(
        f'<div class="card"><a href="{url_("komut/" + i["slug"] + "/")}">{esc(i["title"])}</a><br><span class="tag">{esc(i["cat"])}</span></div>'
        for i in items
    )
    title = f"{SITE}: Cisco, Huawei ve Aruba Komut Karşılıkları"
    desc = "Cisco IOS, Huawei VRP ve Aruba AOS komutlarını yan yana karşılaştıran ağ mühendisi başvuru rehberi."
    body = f"""<h1>Cisco ↔ Huawei ↔ Aruba komut karşılıkları</h1>
<p class="lead">Çoklu vendor ağlarda çalışan mühendisler için hızlı komut rehberi.</p>
<p>{cat_links}</p>{ad_slot()}<div class="grid">{cards}</div>"""
    write("index.html", page(title, desc, "", body))
    urls.append("")


def url_(p):
    return url(p)


def write_meta(urls):
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        sm.append(f"<url><loc>{esc(full(u))}</loc><lastmod>{TODAY}</lastmod></url>")
    sm.append("</urlset>")
    write("sitemap.xml", "\n".join(sm))
    write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {BASE_URL}/sitemap.xml\n")
    write(
        "404.html",
        page("Sayfa bulunamadı", "Sayfa bulunamadı", "404.html", f'<h1>404</h1><p><a href="{url("")}">Ana sayfaya dön</a></p>'),
    )
    write(".nojekyll", "")
    if ADSENSE:
        pub = ADSENSE.replace("ca-", "")
        write("ads.txt", f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n")


def main():
    items = load()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    urls = []
    for it in items:
        build_command(it, items, urls)
        for a, b in permutations(VENDORS, 2):
            build_pair(it, a, b, items, urls)
    cats = build_categories(items, urls)
    build_index(items, cats, urls)
    write_meta(urls)
    log.info("Tamam: %d sayfa -> %s (BASE_URL=%s)", len(urls), OUT, BASE_URL)


if __name__ == "__main__":
    main()
