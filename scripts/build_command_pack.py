from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, KeepTogether
from reportlab.lib.units import mm
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "products" / "network-command-pack"
OUT = ROOT / "dist" / "network-command-pack"
OUT.mkdir(parents=True, exist_ok=True)

def render(source: Path, target: Path, language: str):
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="PackTitle", parent=styles["Title"], fontSize=19, leading=23, textColor=colors.HexColor("#17324d")))
    styles.add(ParagraphStyle(name="PackH2", parent=styles["Heading2"], fontSize=12, leading=15, textColor=colors.HexColor("#17324d"), spaceBefore=10))
    styles.add(ParagraphStyle(name="PackH3", parent=styles["Heading3"], fontSize=9, leading=11, textColor=colors.HexColor("#245b78"), spaceBefore=7, keepWithNext=True))
    styles.add(ParagraphStyle(name="PackBody", parent=styles["BodyText"], fontSize=8, leading=11, spaceAfter=4))
    styles.add(ParagraphStyle(name="PackCode", fontName="Courier", fontSize=7, leading=9, leftIndent=7, backColor=colors.HexColor("#eef3f7"), borderPadding=5, spaceBefore=2, spaceAfter=5))
    story, code, in_code = [], [], False
    for raw in source.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            if in_code:
                story.append(Preformatted("\n".join(code), styles["PackCode"]))
                code, in_code = [], False
            else:
                in_code = True
            continue
        if in_code:
            code.append(line)
            continue
        if not line.strip():
            story.append(Spacer(1, 2))
        elif line.startswith("# "):
            story.append(Paragraph(line[2:], styles["PackTitle"]))
        elif line.startswith("## "):
            story.append(Paragraph(line[3:], styles["PackH2"]))
        elif line.startswith("### "):
            story.append(Paragraph(line[4:], styles["PackH3"]))
        elif line.startswith("**") and line.endswith("**"):
            story.append(Paragraph("<b>" + line[2:-2] + "</b>", styles["PackBody"]))
        else:
            safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            safe = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe)
            safe = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", safe)
            story.append(Paragraph(safe, styles["PackBody"]))
    if code:
        story.append(Preformatted("\n".join(code), styles["PackCode"]))
    SimpleDocTemplate(str(target), pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=15*mm, bottomMargin=15*mm, title=target.stem).build(story)

tr = SRC / "COMMANDS-TR.md"
en = SRC / "COMMANDS-EN.md"
tr_pdf = OUT / "NetCmd_Ag_Komut_Paketi_TR.pdf"
en_pdf = OUT / "NetCmd_Network_Command_Pack_EN.pdf"
render(tr, tr_pdf, "tr")
render(en, en_pdf, "en")
archive = OUT / "NetCmd_Network_Command_Pack_v1.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as z:
    for path in (tr_pdf, en_pdf, tr, en, SRC / "PRODUCT-SPEC.md", SRC / "README.md"):
        if path.exists():
            z.write(path, path.name)
print(f"Generated: {tr_pdf.stat().st_size} bytes; {en_pdf.stat().st_size} bytes; {archive.stat().st_size} bytes")

# Build ten focused bilingual product packs from products/catalog.json.
import json
CATALOG = ROOT / "products" / "catalog.json"
if CATALOG.exists():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    for product in catalog.get("products", []):
        slug = product["slug"]
        product_out = ROOT / "dist" / "products" / slug
        product_out.mkdir(parents=True, exist_ok=True)
        for lang in ("tr", "en"):
            title = product["title_tr" if lang == "tr" else "title_en"]
            subtitle = product["subtitle_tr" if lang == "tr" else "subtitle_en"]
            lines = ["# " + title, "", subtitle, "",
                     ("Fiyat: 19 USD — tek seferlik" if lang == "tr" else "Price: USD 19 — one-time"),
                     "", "## Kapsam" if lang == "tr" else "## Coverage"]
            lines.extend(["- " + topic for topic in product["topics"]])
            lines += ["", "## Komut referansı" if lang == "tr" else "## Command reference", ""]
            for idx, command in enumerate(product["commands"], 1):
                lines += ["### {}. {}".format(idx, command["name"]),
                          "", "**Cisco IOS / IOS-XE**", "\x60\x60\x60text", command["cisco"], "\x60\x60\x60",
                          "", "**Huawei VRP**", "\x60\x60\x60text", command["huawei"], "\x60\x60\x60",
                          "", "**Aruba (AOS-S / AOS-CX)**", "\x60\x60\x60text", command["aruba"], "\x60\x60\x60", ""]
                risk = command.get("risk", "read")
                risk_tr = {"read":"Salt okunur", "test":"Test/teşhis", "change":"Yapılandırma değişikliği"}
                risk_en = {"read":"Read-only", "test":"Test/diagnostic", "change":"Configuration change"}
                lines.append("**Risk:** " + (risk_tr if lang == "tr" else risk_en).get(risk, risk))
                lines.append("")
            caveat = ("Önemli: Komut sözdizimi cihaz modeli ve yazılım sürümüne göre değişebilir. Aruba AOS-S ve AOS-CX komutları aynı değildir. Üretim ortamında uygulamadan önce tam model/sürüm üzerinde ve laboratuvarda doğrulayın. Yapılandırma değiştiren komutları bakım penceresi ve geri dönüş planı olmadan uygulamayın."
                      if lang == "tr" else
                      "Important: Syntax varies by device model and software release. Aruba AOS-S and AOS-CX are not interchangeable. Validate on the exact model/release and in a lab before production use. Do not apply configuration-changing commands without a maintenance window and rollback plan.")
            lines += ["## Güvenlik ve uyumluluk notu" if lang == "tr" else "## Safety and compatibility note", "", caveat, ""]
            md_path = product_out / ("COMMANDS-TR.md" if lang == "tr" else "COMMANDS-EN.md")
            md_path.write_text("\\n".join(lines), encoding="utf-8")
            pdf_path = product_out / ("NetCmd_{}_{}.pdf".format(slug, lang.upper()))
            render(md_path, pdf_path, lang)
        readme = product_out / "README.txt"
        readme.write_text("{}\\n{}\\nUSD 19 one-time. Draft reference: verify syntax against exact hardware and software before production use.\\n".format(product["title_en"], product["subtitle_en"]), encoding="utf-8")
        zip_path = product_out / ("NetCmd_{}_TR-EN.zip".format(slug))
        with ZipFile(zip_path, "w", ZIP_DEFLATED) as z:
            for file in sorted(product_out.iterdir()):
                if file.is_file() and file != zip_path:
                    z.write(file, file.name)
        print("Generated product pack:", slug, "files:", len(list(product_out.iterdir())))
