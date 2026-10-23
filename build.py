#!/usr/bin/env python3
"""
NetCmd static site generator (Python stdlib only).

Diller: tr, en, ar (RTL). Çıktı yapısı:
  /                      dil seçici (JS ile tarayıcı diline yönlendirir)
  /{lang}/               ana sayfa
  /{lang}/cmd/<slug>/    tek komut, 3 vendor
  /{lang}/<a>-<b>/<slug>/  vendor çevirisi (6 yön)
  /{lang}/category/<c>/  kategori
  /{lang}/projects/      projeler
  /{lang}/support/       destek ol (IBAN: data/site.json)
  /{lang}/signup|login|account/   Supabase Auth
  sitemap.xml (hreflang alternates), robots.txt, ads.txt (opsiyonel), 404.html

Ortam değişkenleri: BASE_URL, ADSENSE_CLIENT, SITE_NAME
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
DATA = ROOT / "data"
OUT = ROOT / "dist"

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
BASE_PATH = urlparse(BASE_URL).path.rstrip("/")
ADSENSE = os.environ.get("ADSENSE_CLIENT", "").strip()
SITE = os.environ.get("SITE_NAME", "NetCmd")
TODAY = date.today().isoformat()

LANGS = ["tr", "en", "ar"]
LANG_NAMES = {"tr": "Türkçe", "en": "English", "ar": "العربية"}
DIRS = {"tr": "ltr", "en": "ltr", "ar": "rtl"}

VENDORS = {
    "cisco": {"name": "Cisco", "os": "IOS / IOS-XE"},
    "huawei": {"name": "Huawei", "os": "VRP"},
    "aruba": {"name": "Aruba", "os": "AOS-S / AOS-CX"},
}

CSS = """
:root{--bg:#fff;--fg:#14202b;--mut:#5b6b7a;--bd:#dde4ea;--ac:#0b6bcb;--code:#0f1b26;--codefg:#d7e6f5;--card:#f6f9fc;--ok:#16794a;--err:#b3261e}
@media(prefers-color-scheme:dark){:root{--bg:#0e141a;--fg:#e4ecf3;--mut:#93a4b4;--bd:#243240;--ac:#5aa8ff;--code:#070b0f;--codefg:#d7e6f5;--card:#131c25;--ok:#5fd39a;--err:#ff8a80}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Tahoma,sans-serif}
a{color:var(--ac)}header,main,footer{max-width:980px;margin:0 auto;padding:0 16px}
header{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:space-between;align-items:center;padding-top:14px;padding-bottom:14px;border-bottom:1px solid var(--bd)}
header a.logo{font-weight:700;font-size:1.2rem;text-decoration:none;color:var(--fg)}
nav{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}nav a{text-decoration:none}
.langs{display:flex;gap:8px;font-size:.85rem}.langs a[aria-current]{font-weight:700;text-decoration:underline}
.btn{display:inline-block;background:var(--ac);color:#fff;border:0;border-radius:8px;padding:8px 16px;font:inherit;cursor:pointer;text-decoration:none}
.btn.sec{background:transparent;color:var(--ac);border:1px solid var(--ac)}.btn[disabled]{opacity:.6}
nav a.btn{padding:3px 12px;color:#fff}
h1{font-size:1.7rem;line-height:1.25;margin:1.2rem 0 .4rem}h2{font-size:1.2rem;margin:1.6rem 0 .5rem}
.crumbs{font-size:.85rem;color:var(--mut);margin-top:12px}.lead{color:var(--mut)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px 14px}.card a{font-weight:600;text-decoration:none}
.vend{border:1px solid var(--bd);border-radius:10px;margin:12px 0;overflow:hidden}
.vend h3{margin:0;padding:8px 14px;background:var(--card);font-size:1rem;display:flex;justify-content:space-between;gap:8px}
.vend h3 small{color:var(--mut);font-weight:400}
pre{margin:0;padding:12px 14px;background:var(--code);color:var(--codefg);overflow-x:auto;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:left}
table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid var(--bd);padding:8px 10px;text-align:start;vertical-align:top;font-size:.93rem}th{background:var(--card)}
td code{font:13px ui-monospace,Menlo,Consolas,monospace;direction:ltr;unicode-bidi:embed}
.note{border-inline-start:4px solid var(--ac);background:var(--card);padding:10px 14px;border-radius:8px;margin:14px 0}
.tag{display:inline-block;font-size:.75rem;border:1px solid var(--bd);border-radius:99px;padding:0 8px;color:var(--mut)}
.badge-live{color:var(--ok);border-color:var(--ok)}
.ad{margin:18px 0;min-height:90px}
form.box,.panel{max-width:440px;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:18px;margin:16px 0}
label{display:block;margin:10px 0 4px;font-size:.9rem}
input{width:100%;padding:9px 11px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit}
.msg{margin:12px 0;padding:9px 12px;border-radius:8px;border:1px solid var(--bd)}.msg.ok{color:var(--ok);border-color:var(--ok)}.msg.err{color:var(--err);border-color:var(--err)}
.iban{font:600 1.15rem ui-monospace,Menlo,Consolas,monospace;direction:ltr;unicode-bidi:embed;word-break:break-all}
footer{padding:24px 16px 40px;color:var(--mut);font-size:.85rem;border-top:1px solid var(--bd);margin-top:32px}
"""

NAV_SWAP_JS = (
    "try{var k=Object.keys(localStorage).filter(function(x){return /^sb-.*-auth-token$/.test(x)});"
    "if(k.length){var l=document.getElementById('nav-login'),s=document.getElementById('nav-signup');"
    "if(l){l.href=l.getAttribute('data-acc-href');l.textContent=l.getAttribute('data-acc-text');}"
    "if(s){s.style.display='none';}}}catch(e){}"
)

AUTH_JS = """
(function(){
var C=__CFG__;
var box=document.getElementById('msg');
function show(t,ok){box.textContent=t;box.className='msg '+(ok?'ok':'err');box.hidden=false;}
var f=document.getElementById('f');
if(!C.url||!C.key||!window.supabase){show(C.t.auth_unavailable,false);if(f){f.hidden=true;}return;}
var sb=window.supabase.createClient(C.url,C.key);
function val(id){var e=document.getElementById(id);return e?e.value:'';}
if(C.kind==='signup'){
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var b=document.getElementById('btn');b.disabled=true;box.hidden=true;
    sb.auth.signUp({email:val('email').trim(),password:val('password'),
      options:{data:{display_name:val('name').trim(),lang:C.lang},emailRedirectTo:location.origin+C.loginPath}
    }).then(function(r){
      b.disabled=false;
      if(r.error){show(r.error.message||C.t.generic_err,false);return;}
      show(C.t.signup_ok,true);f.reset();
    }).catch(function(){b.disabled=false;show(C.t.generic_err,false);});
  });
}
if(C.kind==='login'){
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var b=document.getElementById('btn');b.disabled=true;box.hidden=true;
    sb.auth.signInWithPassword({email:val('email').trim(),password:val('password')}).then(function(r){
      b.disabled=false;
      if(r.error){show(/invalid/i.test(r.error.message||'')?C.t.login_err:(r.error.message||C.t.generic_err),false);return;}
      location.href=C.accountPath;
    }).catch(function(){b.disabled=false;show(C.t.generic_err,false);});
  });
}
if(C.kind==='account'){
  var info=document.getElementById('info');
  sb.auth.getSession().then(function(r){
    var s=r.data&&r.data.session;
    if(!s){location.href=C.loginPath;return;}
    document.getElementById('acc-email').textContent=s.user.email||'';
    document.getElementById('acc-name').textContent=(s.user.user_metadata&&s.user.user_metadata.display_name)||'';
    info.hidden=false;
    sb.from('profiles').select('display_name').eq('id',s.user.id).maybeSingle().then(function(p){
      if(p.data&&p.data.display_name){document.getElementById('acc-name').textContent=p.data.display_name;}
    });
  }).catch(function(){show(C.t.generic_err,false);});
  document.getElementById('logout').addEventListener('click',function(){
    sb.auth.signOut().then(function(){location.href=C.loginPath;});
  });
}
})();
"""

ROOT_JS = (
    "var l=(navigator.language||'tr').toLowerCase();"
    "var t=l.indexOf('ar')===0?'ar':(l.indexOf('en')===0?'en':'tr');"
    "location.replace('__BASE__/'+t+'/');"
)

I18N = {}
SITECFG = {}
PROJECTS = []


def esc(s):
    return html.escape(str(s), quote=True)


def slugify(s):
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    s = s.translate(tr).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def T(lang, key, **kw):
    s = I18N["ui"][lang][key]
    return s.format(**kw) if kw else s


def lurl(lang, path=""):
    return "{}/{}/{}".format(BASE_PATH, lang, path)


def full(path):
    return "{}/{}".format(BASE_URL, path.lstrip("/"))


def item_title(it, lang):
    return it["title"] if lang == "tr" else I18N["items"][it["slug"]][lang]["title"]


def item_note(it, lang):
    return it["note"] if lang == "tr" else I18N["items"][it["slug"]][lang]["note"]


def cat_name(cat, lang):
    return cat if lang == "tr" else I18N["cats"][cat][lang]


def code_block(cmds):
    return '<pre dir="ltr"><code>' + esc("\n".join(cmds)) + "</code></pre>"


def ad_slot():
    return '<div class="ad" aria-hidden="true"></div>' if ADSENSE else ""


def load_json(name):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        log.error("%s okunamadı: %s", name, e)
        sys.exit(1)


def load():
    global I18N, SITECFG, PROJECTS
    items = load_json("commands.json")
    I18N = load_json("i18n.json")
    SITECFG = load_json("site.json")
    PROJECTS = load_json("projects.json")

    base_keys = set(I18N["ui"]["tr"])
    for lang in LANGS:
        missing = base_keys ^ set(I18N["ui"][lang])
        if missing:
            log.error("UI anahtarı uyuşmazlığı (%s): %s", lang, sorted(missing))
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
        tr = I18N["items"].get(it["slug"], {})
        for lang in ("en", "ar"):
            if not tr.get(lang, {}).get("title") or not tr.get(lang, {}).get("note"):
                log.error("Çeviri eksik: %s/%s", it["slug"], lang)
                sys.exit(1)
        for lang in ("en", "ar"):
            if lang not in I18N["cats"].get(it["cat"], {}):
                log.error("Kategori çevirisi eksik: %s/%s", it["cat"], lang)
                sys.exit(1)
    return items


def write(path, content):
    p = OUT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def header(lang, path):
    t = lambda k: esc(T(lang, k))
    langs = "".join(
        '<a href="{}" hreflang="{}" lang="{}"{}>{}</a>'.format(
            lurl(l, path), l, l, " aria-current=\"true\"" if l == lang else "", LANG_NAMES[l]
        )
        for l in LANGS
    )
    return (
        '<header><a class="logo" href="{home}">{site}</a>'
        "<nav>"
        '<a href="{home}">{n_home}</a>'
        '<a href="{proj}">{n_proj}</a>'
        '<a href="{sup}">{n_sup}</a>'
        '<a id="nav-login" href="{login}" data-acc-href="{acc}" data-acc-text="{acc_t}">{n_login}</a>'
        '<a id="nav-signup" class="btn" href="{signup}">{n_signup}</a>'
        '</nav><div class="langs">{langs}</div></header>'
    ).format(
        home=lurl(lang), site=esc(SITE), n_home=t("nav_home"),
        proj=lurl(lang, "projects/"), n_proj=t("nav_projects"),
        sup=lurl(lang, "support/"), n_sup=t("nav_support"),
        login=lurl(lang, "login/"), acc=lurl(lang, "account/"), acc_t=t("nav_account"),
        n_login=t("nav_login"), signup=lurl(lang, "signup/"), n_signup=t("nav_signup"),
        langs=langs,
    )


def page(lang, title, desc, path, body, jsonld=None, noindex=False, head_extra="", script=""):
    canonical = full("{}/{}".format(lang, path))
    alts = ""
    for l in LANGS:
        alts += '<link rel="alternate" hreflang="{}" href="{}">'.format(l, esc(full("{}/{}".format(l, path))))
    alts += '<link rel="alternate" hreflang="x-default" href="{}">'.format(esc(full("tr/" + path)))
    ads = (
        '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={}" crossorigin="anonymous"></script>'.format(esc(ADSENSE))
        if ADSENSE
        else ""
    )
    ld = '<script type="application/ld+json">{}</script>'.format(json.dumps(jsonld, ensure_ascii=False)) if jsonld else ""
    robots = '<meta name="robots" content="noindex">' if noindex else ""
    return (
        '<!doctype html>\n<html lang="{lang}" dir="{dir}"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>{title}</title>"
        '<meta name="description" content="{desc}">{robots}'
        '<link rel="canonical" href="{canon}">{alts}'
        '<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">'
        '<meta property="og:type" content="article"><meta property="og:url" content="{canon}">'
        "<style>{css}</style>{ads}{ld}{head_extra}</head><body>"
        "{header}<main>{body}</main>"
        "<footer>{site} · {footer} {upd}: {today}</footer>"
        "<script>{nav_js}</script>{script}</body></html>"
    ).format(
        lang=lang, dir=DIRS[lang], title=esc(title), desc=esc(desc), robots=robots,
        canon=esc(canonical), alts=alts, css=CSS, ads=ads, ld=ld, head_extra=head_extra,
        header=header(lang, path), body=body, site=esc(SITE),
        footer=esc(T(lang, "footer")), upd=esc(T(lang, "updated")), today=TODAY,
        nav_js=NAV_SWAP_JS, script=script,
    )


def tech_ld(title, desc, lang):
    return {
        "@context": "https://schema.org", "@type": "TechArticle", "headline": title,
        "description": desc, "inLanguage": lang, "dateModified": TODAY,
    }


def related(items, cur, n=6):
    same = [i for i in items if i["cat"] == cur["cat"] and i["slug"] != cur["slug"]]
    rest = [i for i in items if i["cat"] != cur["cat"]]
    return (same + rest)[:n]


def build_command(lang, it, items, paths):
    path = "cmd/{}/".format(it["slug"])
    title_it = item_title(it, lang)
    vend_html, rows = "", ""
    for v, meta in VENDORS.items():
        d = it[v]
        vend_html += '<div class="vend"><h3>{} <small>{} · {}</small></h3>{}</div>'.format(
            meta["name"], esc(meta["os"]), esc(d["mode"]), code_block(d["cmds"])
        )
        rows += "<tr><th>{}</th><td><code>{}</code></td><td>{}</td></tr>".format(
            meta["name"], esc(" ; ".join(d["cmds"])), esc(d["mode"])
        )
    pair_links = " · ".join(
        '<a href="{}">{} → {}</a>'.format(lurl(lang, "{}-{}/{}/".format(a, b, it["slug"])), VENDORS[a]["name"], VENDORS[b]["name"])
        for a, b in permutations(VENDORS, 2)
    )
    rel = "".join(
        '<div class="card"><a href="{}">{}</a></div>'.format(lurl(lang, "cmd/{}/".format(r["slug"])), esc(item_title(r, lang)))
        for r in related(items, it)
    )
    title = T(lang, "cmd_title", title=title_it)
    desc = T(lang, "cmd_desc", title=title_it, c=it["cisco"]["cmds"][0], h=it["huawei"]["cmds"][0], a=it["aruba"]["cmds"][0])
    body = (
        '<div class="crumbs"><a href="{home}">{crumb}</a> › <a href="{cat_url}">{cat}</a></div>'
        "<h1>{h1}</h1>"
        '<p class="lead"><span class="tag">{cat}</span> {lead}</p>'
        "{ad}{vend}<h2>{table_h}</h2>"
        "<table><tr><th>{th_v}</th><th>{th_c}</th><th>{th_m}</th></tr>{rows}</table>"
        '<div class="note"><strong>{note_l}</strong> {note}</div>'
        "<h2>{tr_h}</h2><p>{pairs}</p><h2>{rel_h}</h2><div class=\"grid\">{rel}</div>"
    ).format(
        home=lurl(lang), crumb=esc(T(lang, "crumb_home")),
        cat_url=lurl(lang, "category/{}/".format(slugify(it["cat"]))), cat=esc(cat_name(it["cat"], lang)),
        h1=esc(T(lang, "cmd_h1", title=title_it)), lead=esc(T(lang, "cmd_lead")),
        ad=ad_slot(), vend=vend_html, table_h=esc(T(lang, "table_h")),
        th_v=esc(T(lang, "th_vendor")), th_c=esc(T(lang, "th_cmd")), th_m=esc(T(lang, "th_mode")),
        rows=rows, note_l=esc(T(lang, "note_label")), note=esc(item_note(it, lang)),
        tr_h=esc(T(lang, "translate_h")), pairs=pair_links, rel_h=esc(T(lang, "related_h")), rel=rel,
    )
    write("{}/{}index.html".format(lang, path), page(lang, title, desc, path, body, tech_ld(title, desc, lang)))
    paths.add(path)


def build_pair(lang, it, a, b, paths):
    path = "{}-{}/{}/".format(a, b, it["slug"])
    A, B = VENDORS[a], VENDORS[b]
    da, db = it[a], it[b]
    title_it = item_title(it, lang)
    title = T(lang, "pair_title", A=A["name"], B=B["name"], cmd=da["cmds"][0])
    desc = T(lang, "pair_desc", A=A["name"], B=B["name"], Aos=A["os"], Bos=B["os"], cmd=da["cmds"][0], bcmd=db["cmds"][0])
    body = (
        '<div class="crumbs"><a href="{home}">{crumb}</a> › <a href="{cmd_url}">{t_it}</a></div>'
        "<h1>{h1}</h1><p class=\"lead\">{lead}</p>{ad}"
        '<div class="vend"><h3>{an} <small>{aos} · {am}</small></h3>{ac}</div>'
        '<div class="vend"><h3>{bn} <small>{bos} · {bm}</small></h3>{bc}</div>'
        '<div class="note"><strong>{warn}</strong> {note}</div>'
        '<p>{all} <a href="{cmd_url}">{t_it}</a></p>'
    ).format(
        home=lurl(lang), crumb=esc(T(lang, "crumb_home")), cmd_url=lurl(lang, "cmd/{}/".format(it["slug"])),
        t_it=esc(title_it), h1=esc(title),
        lead=esc(T(lang, "pair_lead", title=title_it, A=A["name"], B=B["name"])), ad=ad_slot(),
        an=A["name"], aos=esc(A["os"]), am=esc(da["mode"]), ac=code_block(da["cmds"]),
        bn=B["name"], bos=esc(B["os"]), bm=esc(db["mode"]), bc=code_block(db["cmds"]),
        warn=esc(T(lang, "warn_label")), note=esc(item_note(it, lang)), all=esc(T(lang, "pair_all")),
    )
    write("{}/{}index.html".format(lang, path), page(lang, title, desc, path, body, tech_ld(title, desc, lang)))
    paths.add(path)


def build_categories(lang, items, paths):
    cats = {}
    for it in items:
        cats.setdefault(it["cat"], []).append(it)
    for cat, lst in cats.items():
        path = "category/{}/".format(slugify(cat))
        cname = cat_name(cat, lang)
        cards = "".join(
            '<div class="card"><a href="{}">{}</a><br><small dir="ltr">{} · {}</small></div>'.format(
                lurl(lang, "cmd/{}/".format(i["slug"])), esc(item_title(i, lang)),
                esc(i["cisco"]["cmds"][0]), esc(i["huawei"]["cmds"][0]),
            )
            for i in lst
        )
        title = T(lang, "cat_title", cat=cname)
        desc = T(lang, "cat_desc", cat=cname, n=len(lst))
        body = '<h1>{}</h1><p class="lead">{}</p>{}<div class="grid">{}</div>'.format(
            esc(T(lang, "cat_h1", cat=cname)), esc(T(lang, "cmd_count", n=len(lst))), ad_slot(), cards
        )
        write("{}/{}index.html".format(lang, path), page(lang, title, desc, path, body))
        paths.add(path)
    return cats


def build_home(lang, items, cats, paths):
    cat_links = " ".join(
        '<a class="tag" href="{}">{} ({})</a>'.format(lurl(lang, "category/{}/".format(slugify(c))), esc(cat_name(c, lang)), len(l))
        for c, l in cats.items()
    )
    cards = "".join(
        '<div class="card"><a href="{}">{}</a><br><span class="tag">{}</span></div>'.format(
            lurl(lang, "cmd/{}/".format(i["slug"])), esc(item_title(i, lang)), esc(cat_name(i["cat"], lang))
        )
        for i in items
    )
    body = '<h1>{}</h1><p class="lead">{}</p><p>{}</p>{}<div class="grid">{}</div>'.format(
        esc(T(lang, "home_h1")), esc(T(lang, "home_lead")), cat_links, ad_slot(), cards
    )
    write("{}/index.html".format(lang), page(lang, T(lang, "home_title"), T(lang, "home_desc"), "", body))
    paths.add("")


def build_projects(lang, paths):
    cards = ""
    for p in PROJECTS:
        live = p["status"] == "live"
        badge = '<span class="tag badge-live">{}</span>'.format(esc(T(lang, "status_live"))) if live else '<span class="tag">{}</span>'.format(esc(T(lang, "status_soon")))
        link = '<p><a class="btn sec" href="{}">{}</a></p>'.format(lurl(lang, p.get("url", "")), esc(T(lang, "open"))) if live else ""
        cards += '<div class="card"><h3 style="margin:0 0 4px">{} {}</h3><p style="margin:0">{}</p>{}</div>'.format(
            esc(p["name"][lang]), badge, esc(p["desc"][lang]), link
        )
    body = '<h1>{}</h1><p class="lead">{}</p><div class="grid">{}</div><p style="margin-top:20px"><a class="btn" href="{}">{}</a> {}</p>'.format(
        esc(T(lang, "projects_title")), esc(T(lang, "projects_lead")), cards,
        lurl(lang, "signup/"), esc(T(lang, "nav_signup")), esc(T(lang, "projects_cta")),
    )
    write("{}/projects/index.html".format(lang), page(lang, T(lang, "projects_title") + " | " + SITE, T(lang, "projects_lead"), "projects/", body))
    paths.add("projects/")


def build_support(lang, paths):
    iban = SITECFG.get("iban", "").replace(" ", "").upper()
    if iban:
        spaced = " ".join(iban[i:i + 4] for i in range(0, len(iban), 4))
        rows = ""
        if SITECFG.get("holder"):
            rows += "<p><strong>{}:</strong> {}</p>".format(esc(T(lang, "holder_label")), esc(SITECFG["holder"]))
        if SITECFG.get("bank"):
            rows += "<p><strong>{}:</strong> {}</p>".format(esc(T(lang, "bank_label")), esc(SITECFG["bank"]))
        panel = (
            '<div class="panel"><p><strong>{lbl}</strong></p><p class="iban" id="iban-raw" data-v="{raw}">{sp}</p>'
            '{rows}<button class="btn" id="copy" type="button" data-done="{done}">{copy}</button></div><p>{note}</p>'
        ).format(
            lbl=esc(T(lang, "iban_label")), raw=esc(iban), sp=esc(spaced), rows=rows,
            done=esc(T(lang, "copied")), copy=esc(T(lang, "copy")), note=esc(T(lang, "support_note")),
        )
        script = "<script>{}</script>".format(
            "(function(){var b=document.getElementById('copy');if(!b)return;"
            "b.addEventListener('click',function(){var t=document.getElementById('iban-raw').getAttribute('data-v');"
            "var done=function(){var o=b.textContent;b.textContent=b.getAttribute('data-done');setTimeout(function(){b.textContent=o;},1500);};"
            "if(navigator.clipboard){navigator.clipboard.writeText(t).then(done);}});})();"
        )
    else:
        panel = '<div class="panel">{}</div>'.format(esc(T(lang, "support_soon")))
        script = ""
    body = '<h1>{}</h1><p class="lead">{}</p>{}'.format(esc(T(lang, "support_title")), esc(T(lang, "support_lead")), panel)
    write(
        "{}/support/index.html".format(lang),
        page(lang, T(lang, "support_title") + " | " + SITE, T(lang, "support_lead"), "support/", body, script=script),
    )
    paths.add("support/")


def auth_script(lang, kind):
    keys = ["auth_unavailable", "generic_err", "signup_ok", "login_err"]
    cfg = {
        "url": SITECFG.get("supabase_url", ""), "key": SITECFG.get("supabase_key", ""),
        "kind": kind, "lang": lang,
        "loginPath": lurl(lang, "login/"), "accountPath": lurl(lang, "account/"),
        "t": {k: T(lang, k) for k in keys},
    }
    js = AUTH_JS.replace("__CFG__", json.dumps(cfg, ensure_ascii=False).replace("</", "<\\/"))
    return (
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script>{}</script>'.format(js)
    )


def build_auth(lang, paths):
    t = lambda k: esc(T(lang, k))
    signup = (
        '<h1>{h}</h1><p class="lead">{lead}</p>'
        '<form class="box" id="f"><label for="name">{fn}</label><input id="name" autocomplete="name" required>'
        '<label for="email">{fe}</label><input id="email" type="email" autocomplete="email" required>'
        '<label for="password">{fp}</label><input id="password" type="password" minlength="8" autocomplete="new-password" required>'
        '<p><button class="btn" id="btn" type="submit">{b}</button></p></form>'
        '<div id="msg" class="msg" hidden></div><p>{have} <a href="{login}">{nl}</a></p>'
    ).format(
        h=t("signup_title"), lead=t("signup_lead"), fn=t("f_name"), fe=t("f_email"), fp=t("f_password"),
        b=t("btn_signup"), have=t("have_account"), login=lurl(lang, "login/"), nl=t("nav_login"),
    )
    login = (
        '<h1>{h}</h1>'
        '<form class="box" id="f"><label for="email">{fe}</label><input id="email" type="email" autocomplete="email" required>'
        '<label for="password">{fp}</label><input id="password" type="password" autocomplete="current-password" required>'
        '<p><button class="btn" id="btn" type="submit">{b}</button></p></form>'
        '<div id="msg" class="msg" hidden></div><p>{no} <a href="{su}">{ns}</a></p>'
    ).format(
        h=t("login_title"), fe=t("f_email"), fp=esc(re.sub(r"\s*\(.*$", "", T(lang, "f_password"))),
        b=t("btn_login"), no=t("no_account"), su=lurl(lang, "signup/"), ns=t("nav_signup"),
    )
    account = (
        '<h1>{h}</h1><div id="msg" class="msg" hidden></div>'
        '<div class="panel" id="info" hidden><p><strong>{le}:</strong> <span id="acc-email"></span></p>'
        '<p><strong>{ln}:</strong> <span id="acc-name"></span></p>'
        '<p><button class="btn sec" id="logout" type="button">{lo}</button></p></div>'
    ).format(h=t("account_title"), le=t("acc_email"), ln=t("acc_name"), lo=t("btn_logout"))

    for kind, body, title_key in (
        ("signup", signup, "signup_title"), ("login", login, "login_title"), ("account", account, "account_title"),
    ):
        path = kind + "/"
        write(
            "{}/{}index.html".format(lang, path),
            page(lang, T(lang, title_key) + " | " + SITE, T(lang, "signup_lead"), path, body, noindex=True, script=auth_script(lang, kind)),
        )
        paths.add(path)


def write_meta(sitemap_paths):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for p in sorted(sitemap_paths):
        for lang in LANGS:
            lines.append("<url><loc>{}</loc><lastmod>{}</lastmod>".format(esc(full("{}/{}".format(lang, p))), TODAY))
            for l in LANGS:
                lines.append('<xhtml:link rel="alternate" hreflang="{}" href="{}"/>'.format(l, esc(full("{}/{}".format(l, p)))))
            lines.append('<xhtml:link rel="alternate" hreflang="x-default" href="{}"/></url>'.format(esc(full("tr/" + p))))
    lines.append("</urlset>")
    write("sitemap.xml", "\n".join(lines))
    write("robots.txt", "User-agent: *\nAllow: /\nSitemap: {}/sitemap.xml\n".format(BASE_URL))
    write(".nojekyll", "")
    if ADSENSE:
        write("ads.txt", "google.com, {}, DIRECT, f08c47fec0942fa0\n".format(ADSENSE.replace("ca-", "")))

    links = "".join('<p><a href="{}/{}/">{}</a></p>'.format(BASE_PATH, l, LANG_NAMES[l]) for l in LANGS)
    alts = "".join('<link rel="alternate" hreflang="{}" href="{}">'.format(l, esc(full(l + "/"))) for l in LANGS)
    alts += '<link rel="alternate" hreflang="x-default" href="{}">'.format(esc(full("tr/")))
    root = (
        '<!doctype html><html lang="tr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>{site}</title>{alts}<style>{css}</style></head><body><main>"
        "<h1>{site}</h1>{links}</main><script>{js}</script></body></html>"
    ).format(
        site=esc(SITE), alts=alts, css=CSS, links=links,
        js=ROOT_JS.replace("__BASE__", BASE_PATH),
    )
    write("index.html", root)
    nf = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title><style>{css}</style></head>'
        '<body><main><h1>404</h1><p>{t} · {e} · {a}</p>{links}</main></body></html>'
    ).format(
        css=CSS, t=esc(T("tr", "not_found")), e=esc(T("en", "not_found")), a=esc(T("ar", "not_found")), links=links
    )
    write("404.html", nf)


def main():
    items = load()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    sitemap_paths = set()
    total = 0
    for lang in LANGS:
        paths = set()
        for it in items:
            build_command(lang, it, items, paths)
            for a, b in permutations(VENDORS, 2):
                build_pair(lang, it, a, b, paths)
        cats = build_categories(lang, items, paths)
        build_home(lang, items, cats, paths)
        build_projects(lang, paths)
        build_support(lang, paths)
        build_auth(lang, paths)
        total += len(paths)
        # arama motoru için: auth sayfaları (noindex) sitemap dışında
        sitemap_paths |= {p for p in paths if p not in ("signup/", "login/", "account/")}
    write_meta(sitemap_paths)
    log.info("Tamam: %d sayfa (%d dil) -> %s (BASE_URL=%s)", total, len(LANGS), OUT, BASE_URL)


if __name__ == "__main__":
    main()
